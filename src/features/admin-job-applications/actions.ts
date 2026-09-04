// Server Actions admin /contacts/candidatures — candidatures aux offres d'emploi.
// PII déchiffrées à la lecture (RBAC). Download CV via route dédiée (cv/route.ts).
// Suppression = purge CV disque + delete (droit à l'effacement).

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { adminPath } from "@/lib/admin-path";
import { estSuperAdmin } from "@/server/auth/habilitations";
import { deleteCv } from "@/server/careers/cv-storage";
import { CANDIDATURE_COMMERCIALE_SUBTYPE } from "@/lib/commercial-application/model";
// La lecture SANS session, et les trois valeurs qu'un module `"use server"` ne
// peut pas exporter (statuts, schéma, déchiffrement tolérant). Une seule
// écriture : elles ne sont pas dupliquées ici.
import { STATUSES, safeDecrypt, listApplications } from "./reads";
import { consignerEvenement, resumeChangementStatut } from "./journal";
import {
  LIBELLE_STATUT,
  LIBELLE_MOTIF_REFUS,
  MOTIFS_REFUS,
  estUneDecision,
  incoherenceDeLaDecision,
} from "@/content/recrutement/statuts";
// Les deux gardes de session vivent hors de ce fichier : un module
// `"use server"` ne peut pas les exporter sans en faire des points d'entrée
// réseau, et le module des gestes en masse doit les partager plutôt que les
// recopier.
import { requireAdminWrite, requireAdminRead } from "./session";
import type { ListApplicationsInput } from "./reads";
export type {
  ListApplicationsInput,
  JobApplicationListItem,
  JobApplicationListResult,
} from "./reads";
import type {
  JobApplicationStatus,
  JobRejectionReason,
  Locale,
} from "../../../prisma/generated/client";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  // Lot 6 — geste irréversible : le prédicat du SSOT, même périmètre qu'avant.
  if (!estSuperAdmin((session.user as { role?: string }).role)) throw new Error("forbidden");
  return { userId: session.user.id };
}

// ============================================================ list

/**
 * ⚠️ **LA GARDE EST INTACTE.** Le corps a été déplacé dans `./reads` — mot pour
 *    mot — pour qu'un appelant SANS session de navigateur (le handler
 *    `/api/mcp`, qui porte un secret partagé) puisse lire. Ce fichier est
 *    `"use server"` : **chaque export y devient un point d'entrée réseau**, donc
 *    la lecture nue ne peut pas y vivre.
 */
export async function listApplicationsAction(input: Partial<ListApplicationsInput> = {}) {
  // `requireAdminRead()` a déjà refusé tout rôle hors du prédicat commun. On lui
  // repasse néanmoins le RÔLE, pas un `true` : la lecture réapplique le prédicat,
  // et les deux étages ne peuvent pas diverger.
  const acteur = await requireAdminRead();
  return listApplications(input, { role: acteur.role, acteurId: acteur.userId });
}

// ============================================================ vues fusionnées
// Onglets « Toutes » et « Mémo Isère » (demande Will 2026-08-13). Les
// candidatures commerciales du tunnel /devenir-commercial-ia/candidature
// (annonce Mémorial de l'Isère, cf. groupe Telegram commercial-memo) sont des
// `Submission` avec `details.subType = "candidature-commerciale"`, PAS des
// `JobApplication`. « Toutes » fusionne les deux tables triées par date ;
// « Mémo Isère » ne liste que le flux commercial.

const unifiedListSchema = z.object({
  scope: z.enum(["toutes", "memo"]),
  /**
   * Filtre par canal d'annonce (`leboncoin`, `memorial-isere`…), pour les
   * sous-onglets de la vue apporteurs. Chaîne LIBRE et non `z.enum` : les
   * sources sont dérivées des données, pas d'une liste figée — un canal ajouté
   * à `SOURCE_OPTIONS` doit être filtrable sans qu'on touche ce schéma.
   */
  source: z.string().min(1).max(60).optional(),
  onlyAttention: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(50),
});

export interface CandidatureUnifieeItem {
  id: string;
  /** "emploi" = JobApplication (détail /contacts/candidatures/[id]) ;
   *  "commerciale" = Submission du tunnel commercial (détail /contacts/commercial/[id]). */
  source: "emploi" | "commerciale";
  offerLabel: string;
  /**
   * 🔴 `null` quand le rôle n'ouvre pas le dossier de candidat. L'écran le rend
   * alors « masqué » — jamais une chaîne vide, qui se lirait comme un candidat
   * sans nom. Cf. `reads.ts`, `AccesDossierCandidat`.
   */
  contactName: string | null;
  contactEmail: string | null;
  /** JobApplicationStatus (emploi) ou SubmissionStatus (commerciale). */
  status: string;
  /** null = sans objet (le tunnel commercial ne collecte pas de CV). */
  hasCv: boolean | null;
  needsAttention: boolean;
  submittedAt: Date;
}

export async function listCandidaturesUnifieesAction(input: {
  scope: "toutes" | "memo";
  /** Canal d'annonce — n'a de sens qu'avec `scope: "memo"`. */
  source?: string;
  onlyAttention?: boolean;
  page?: number;
  pageSize?: number;
}) {
  await requireAdminRead();
  const parsed = unifiedListSchema.parse(input);
  const skip = (parsed.page - 1) * parsed.pageSize;

  // 🔴 `AND` explicite, et pas deux clés `details` dans le même objet : la
  // seconde écraserait silencieusement la première, et le filtre par canal
  // remplacerait le filtre de sous-type. On lirait alors TOUTES les
  // submissions du site sous l'onglet apporteurs — sans aucune erreur.
  const whereCommerciale = {
    AND: [
      { details: { path: ["subType"], equals: CANDIDATURE_COMMERCIALE_SUBTYPE } },
      // Le chemin JSON est celui où la Server Action ÉCRIT la source
      // (`details.candidature.sourceConnaissance`). Un chemin approximatif ne
      // lèverait aucune erreur : il renverrait zéro résultat, et on conclurait
      // qu'une annonce ne rapporte rien.
      ...(parsed.source
        ? [{ details: { path: ["candidature", "sourceConnaissance"], equals: parsed.source } }]
        : []),
    ],
    deletedAt: null,
    ...(parsed.onlyAttention ? { needsAttention: true } : {}),
  };
  const selectCommerciale = {
    id: true,
    contactName: true,
    contactEmail: true,
    status: true,
    needsAttention: true,
    submittedAt: true,
    details: true,
  };
  const mapCommerciale = (s: {
    id: string;
    contactName: string;
    contactEmail: string;
    status: string;
    needsAttention: boolean;
    submittedAt: Date;
    details: unknown;
  }): CandidatureUnifieeItem => {
    const details =
      s.details && typeof s.details === "object" && !Array.isArray(s.details)
        ? (s.details as Record<string, unknown>)
        : null;
    const ville = details && typeof details.ville === "string" ? details.ville : null;
    return {
      id: s.id,
      source: "commerciale",
      offerLabel: ville ? `Commercial Mémo Isère · ${ville}` : "Commercial Mémo Isère",
      contactName: safeDecrypt(s.contactName),
      contactEmail: safeDecrypt(s.contactEmail),
      status: s.status,
      hasCv: null,
      needsAttention: s.needsAttention,
      submittedAt: s.submittedAt,
    };
  };

  if (parsed.scope === "memo") {
    const [total, rows] = await Promise.all([
      prisma.submission.count({ where: whereCommerciale }),
      prisma.submission.findMany({
        where: whereCommerciale,
        orderBy: { submittedAt: "desc" },
        skip,
        take: parsed.pageSize,
        select: selectCommerciale,
      }),
    ]);
    return {
      items: rows.map(mapCommerciale),
      total,
      page: parsed.page,
      pageSize: parsed.pageSize,
      totalPages: Math.max(1, Math.ceil(total / parsed.pageSize)),
    };
  }

  // Fusion des deux tables : pagination par fenêtre (take = skip + pageSize
  // de chaque côté, tri mémoire, découpe). Le déchiffrement PII n'est fait
  // QUE sur la page finale, pas sur toute la fenêtre.
  const whereEmploi: Record<string, unknown> = {};
  if (parsed.onlyAttention) whereEmploi.needsAttention = true;
  const windowTake = skip + parsed.pageSize;

  const [totalEmploi, totalCommerciale, emploiRows, commercialeRows] = await Promise.all([
    prisma.jobApplication.count({ where: whereEmploi }),
    prisma.submission.count({ where: whereCommerciale }),
    prisma.jobApplication.findMany({
      where: whereEmploi,
      orderBy: { submittedAt: "desc" },
      take: windowTake,
      select: {
        id: true,
        offerTitleSnap: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
        cvStoragePath: true,
        needsAttention: true,
        submittedAt: true,
      },
    }),
    prisma.submission.findMany({
      where: whereCommerciale,
      orderBy: { submittedAt: "desc" },
      take: windowTake,
      select: selectCommerciale,
    }),
  ]);

  const merged: Array<{ at: number; make: () => CandidatureUnifieeItem }> = [
    ...emploiRows.map((r) => ({
      at: r.submittedAt.getTime(),
      make: (): CandidatureUnifieeItem => ({
        id: r.id,
        source: "emploi",
        offerLabel: r.offerTitleSnap,
        contactName: `${safeDecrypt(r.firstName)} ${safeDecrypt(r.lastName)}`.trim(),
        contactEmail: safeDecrypt(r.email),
        status: r.status,
        hasCv: Boolean(r.cvStoragePath),
        needsAttention: r.needsAttention,
        submittedAt: r.submittedAt,
      }),
    })),
    ...commercialeRows.map((r) => ({
      at: r.submittedAt.getTime(),
      make: () => mapCommerciale(r),
    })),
  ];
  merged.sort((a, b) => b.at - a.at);
  const total = totalEmploi + totalCommerciale;

  return {
    items: merged.slice(skip, windowTake).map((m) => m.make()),
    total,
    page: parsed.page,
    pageSize: parsed.pageSize,
    totalPages: Math.max(1, Math.ceil(total / parsed.pageSize)),
  };
}

// ============================================================ detail
export interface JobApplicationDetail {
  id: string;
  /**
   * `null` quand l'offre a été supprimée (lot 6 : elle n'emporte plus le
   * dossier) ou quand la candidature est spontanée. `offerTitleSnap` reste
   * renseigné dans les deux cas.
   */
  offerId: string | null;
  offerTitleSnap: string;
  status: JobApplicationStatus;
  civility: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string | null;
  motivation: string | null;
  currentRole: string | null;
  experienceBand: string | null;
  availability: string | null;
  linkedinUrl: string | null;
  hasDriverLicense: boolean | null;
  hasVehicle: boolean | null;
  answers: Record<string, string>;
  hasCv: boolean;
  cvOriginalName: string | null;
  salaryExpectation: string | null;
  hasPhoto: boolean;
  photoOriginalName: string | null;
  /**
   * Type de la photo. Sert à savoir si un navigateur sait l'AFFICHER : le
   * téléversement accepte le HEIC (format par défaut des iPhone), qu'aucun
   * navigateur hors Safari ne sait rendre. Sans cette information, la console
   * afficherait une image cassée au lieu de proposer le téléchargement.
   */
  photoMimeType: string | null;
  internalNotes: string | null;
  assignedTo: string | null;
  /** Motif de sortie — jamais nul quand le statut est `rejected` ou `withdrawn`. */
  rejectionReason: JobRejectionReason | null;
  /** Quand la décision a été prise. Distinct d'`updatedAt`, que toute note bouge. */
  decidedAt: Date | null;
  hiredAt: Date | null;
  needsAttention: boolean;
  locale: Locale;
  submittedAt: Date;
}

export async function getApplicationDetailAction(id: string): Promise<JobApplicationDetail | null> {
  const acteur = await requireAdminRead();
  const a = await prisma.jobApplication.findUnique({ where: { id } });
  if (!a) return null;
  // 🔑 La TRACE, pas la liste de rôles, est ce qui rend cet accès défendable
  // devant la CNIL. Une liste de rôles dit qui A LE DROIT ; seul le journal dit
  // qui A OUVERT le dossier de Madame X, et quand.
  //
  // Journalisé ICI et pas dans `requireAdminRead` à dessein : c'est l'ouverture
  // d'un dossier NOMMÉ qui constitue l'accès individualisé. Les deux actions de
  // liste partagent la même garde, mais parcourir un tableau paginé à chaque
  // rendu d'écran produirait un journal de volume sans en dire davantage — et un
  // journal qu'on ne peut plus lire ne prouve plus rien.
  //
  // ⚠️ Écrit DIRECTEMENT sur `prisma.activityLog`, et non via le helper partagé
  // du générateur éditorial — son isolation est vérifiée en CI (§ 4.1bis) et
  // rien du dossier d'un candidat n'y appartient. C'est aussi l'idiome réel du
  // dépôt partout ailleurs (`admin-blog`, `admin-faq`, `gdpr-erase`, `auth.ts`).
  //
  // Best-effort : un journal indisponible ne doit pas priver le recruteur du
  // dossier.
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: acteur.userId,
        action: "careers.candidature.dossier.ouvert",
        targetType: "JobApplication",
        targetId: a.id,
        ipAddress: await getClientIp(),
      },
    });
  } catch {
    // silence volontaire : cf. ci-dessus
  }
  const answers =
    a.answers && typeof a.answers === "object" && !Array.isArray(a.answers)
      ? (a.answers as Record<string, string>)
      : {};
  return {
    id: a.id,
    offerId: a.offerId,
    offerTitleSnap: a.offerTitleSnap,
    status: a.status,
    civility: a.civility,
    firstName: safeDecrypt(a.firstName),
    lastName: safeDecrypt(a.lastName),
    email: safeDecrypt(a.email),
    phone: safeDecrypt(a.phone),
    city: a.city,
    motivation: a.motivation,
    currentRole: a.currentRole,
    experienceBand: a.experienceBand,
    availability: a.availability,
    linkedinUrl: a.linkedinUrl,
    hasDriverLicense: a.hasDriverLicense,
    hasVehicle: a.hasVehicle,
    answers,
    hasCv: Boolean(a.cvStoragePath),
    cvOriginalName: a.cvOriginalName,
    salaryExpectation: a.salaryExpectation,
    hasPhoto: Boolean(a.photoStoragePath),
    photoOriginalName: a.photoOriginalName,
    photoMimeType: a.photoMimeType,
    internalNotes: a.internalNotes,
    assignedTo: a.assignedTo,
    // Sans ce champ, le formulaire rouvrait toujours sur « — Choisir un motif — »
    // et le premier enregistrement d'une note ÉCRASAIT le motif déjà décidé.
    rejectionReason: a.rejectionReason,
    decidedAt: a.decidedAt,
    hiredAt: a.hiredAt,
    needsAttention: a.needsAttention,
    locale: a.locale,
    submittedAt: a.submittedAt,
  };
}

// ============================================================ update status
const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(STATUSES),
  internalNotes: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().max(4000).optional(),
  ),
  assignedTo: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().max(100).optional(),
  ),
  /**
   * Le motif de sortie. Facultatif ICI parce que le schéma ne connaît pas le
   * statut visé au moment où il valide un champ ; la cohérence des deux est
   * vérifiée juste après, par `verifierLaCoherenceDeLaDecision`.
   */
  rejectionReason: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.enum(MOTIFS_REFUS).optional(),
  ),
  needsAttention: z.preprocess((v) => v === "true" || v === "on", z.boolean()),
});
export type UpdateApplicationState = { ok: true } | { ok: false; error: string };

export async function updateApplicationStatusAction(
  _prev: UpdateApplicationState,
  formData: FormData,
): Promise<UpdateApplicationState> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Permission insuffisante." };
  }
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    internalNotes: formData.get("internalNotes"),
    assignedTo: formData.get("assignedTo"),
    rejectionReason: formData.get("rejectionReason"),
    needsAttention: formData.get("needsAttention"),
  });
  if (!parsed.success) return { ok: false, error: "Champs invalides." };

  const incoherence = incoherenceDeLaDecision(parsed.data.status, parsed.data.rejectionReason);
  if (incoherence) return { ok: false, error: incoherence };

  // L'état AVANT, lu pour deux raisons : écrire la transition dans la frise, et
  // ne dater la décision QUE si elle vient d'être prise.
  const avant = await prisma.jobApplication.findUnique({
    where: { id: parsed.data.id },
    select: { status: true, decidedAt: true, hiredAt: true },
  });
  if (!avant) return { ok: false, error: "Candidature introuvable." };

  const statutChange = avant.status !== parsed.data.status;
  const maintenant = new Date();

  // 🔴 LE STATUT ET SA TRACE SONT ÉCRITS DANS LA MÊME TRANSACTION.
  // Même raison qu'au composeur de réponse : une décision sans trace est
  // exactement le défaut que ce chantier ferme.
  try {
    await prisma.$transaction(async (tx) => {
      await tx.jobApplication.update({
        where: { id: parsed.data.id },
        data: {
          status: parsed.data.status,
          internalNotes: parsed.data.internalNotes ?? null,
          assignedTo: parsed.data.assignedTo ?? null,
          // `?? null` et non `?? undefined` : repasser un dossier écarté en
          // « en revue » doit EFFACER le motif, sinon la contrainte le refuse —
          // et l'écran afficherait un état en cours portant un motif de sortie.
          rejectionReason: parsed.data.rejectionReason ?? null,
          needsAttention: parsed.data.needsAttention,
          // La date de décision est posée à la PREMIÈRE entrée dans un état
          // décisif, et n'est pas rafraîchie par un enregistrement ultérieur :
          // `updatedAt` bouge à chaque note, elle ne dirait rien de la décision.
          ...(estUneDecision(parsed.data.status) && statutChange
            ? { decidedAt: maintenant, decidedById: session.userId }
            : {}),
          // Sortir d'un état décisif efface la date : un dossier « en revue »
          // qui garderait une date de décision se lirait comme clos.
          ...(!estUneDecision(parsed.data.status) && statutChange
            ? { decidedAt: null, decidedById: null }
            : {}),
          ...(parsed.data.status === "hired" && avant.hiredAt === null
            ? { hiredAt: maintenant }
            : {}),
        },
      });

      if (statutChange) {
        const motif = parsed.data.rejectionReason;
        await consignerEvenement(
          {
            applicationId: parsed.data.id,
            // `decision` pour ce qui referme le dossier, `statut_change` pour
            // une avancée. La frise n'affiche pas les deux de la même façon :
            // confondre un pas de plus et une fin rendrait l'historique plat.
            type: estUneDecision(parsed.data.status) ? "decision" : "statut_change",
            authorId: session.userId,
            authorName: session.nom,
            summary: resumeChangementStatut(
              avant.status,
              parsed.data.status,
              (st) => LIBELLE_STATUT[st as JobApplicationStatus] ?? st,
            ),
            body: motif ? `Motif : ${LIBELLE_MOTIF_REFUS[motif]}` : null,
            ...(motif ? { meta: { motif } } : {}),
          },
          tx,
        );
      }
    });
  } catch {
    // Le message Postgres de la contrainte n'apprend rien à un recruteur ; le
    // contrôle en amont a déjà nommé le cas prévisible.
    return { ok: false, error: "Enregistrement refusé — vérifiez le statut et son motif." };
  }

  await prisma.activityLog.create({
    data: {
      adminUserId: session.userId,
      action: "jobapplication.updated",
      targetType: "job_application",
      targetId: parsed.data.id,
      ipAddress: await getClientIp(),
    },
  });
  revalidatePath(adminPath("fr", "contacts/candidatures"));
  // La fiche PORTE la frise : sans cette seconde revalidation, la décision
  // s'enregistre et l'historique continue d'afficher l'état précédent.
  revalidatePath(adminPath("fr", `contacts/candidatures/${parsed.data.id}`));
  return { ok: true };
}

// ============================================================ delete (RGPD)
export async function deleteApplicationAction(
  _prev: UpdateApplicationState,
  formData: FormData,
): Promise<UpdateApplicationState> {
  let session;
  try {
    session = await requireSuperAdmin();
  } catch {
    return { ok: false, error: "Réservé au super-administrateur." };
  }
  const id = formData.get("id");
  if (typeof id !== "string") return { ok: false, error: "ID invalide." };

  const a = await prisma.jobApplication.findUnique({
    where: { id },
    select: { cvStoragePath: true, photoStoragePath: true },
  });
  if (!a) return { ok: false, error: "Candidature introuvable." };

  await deleteCv(a.cvStoragePath); // purge CV AVANT le delete
  await deleteCv(a.photoStoragePath); // purge photo AVANT le delete (RGPD)
  await prisma.jobApplication.delete({ where: { id } });
  await prisma.activityLog.create({
    data: {
      adminUserId: session.userId,
      action: "jobapplication.deleted",
      targetType: "job_application",
      targetId: id,
      ipAddress: await getClientIp(),
    },
  });
  revalidatePath(adminPath("fr", "contacts/candidatures"));
  return { ok: true };
}
