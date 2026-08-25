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
import { decryptPii } from "@/lib/pii-crypto";
import { peutOuvrirDossierCandidat } from "@/server/auth/habilitations";
import { deleteCv } from "@/server/careers/cv-storage";
import { CANDIDATURE_COMMERCIALE_SUBTYPE } from "@/lib/commercial-application/model";
import { VIDEO_EDITOR_OFFER_SLUG } from "@/lib/careers/video-editor-offer";
import type { JobApplicationStatus, Locale } from "../../../prisma/generated/client";

const STATUSES = ["new", "reviewing", "shortlisted", "rejected", "hired", "archived"] as const;

/** Déchiffrement tolérant : un ciphertext corrompu ne casse pas la page entière. */
function safeDecrypt(v: string): string {
  try {
    return decryptPii(v);
  } catch {
    return "[déchiffrement échoué]";
  }
}

async function requireAdminWrite() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role;
  if (role !== "super_admin" && role !== "admin" && role !== "editor") {
    throw new Error("forbidden");
  }
  return { userId: session.user.id, role };
}
/**
 * Ouvrir un dossier de candidature — identite comprise.
 *
 * 🔴 Cette garde ne testait AUCUN role : elle verifiait la seule presence d'une
 * session. Or les trois actions qui l'appellent rendent les PII DECHIFFREES
 * (nom, e-mail, telephone) via `decryptPii`. Un compte `reader` — le role de
 * consultation, explicitement exclu de l'ecriture — lisait donc l'identite
 * complete de chaque candidat.
 *
 * Le CV, lui, etait garde. La piece jointe etait mieux protegee que l'identite
 * a laquelle elle appartient : proteger la porte en laissant la fenetre ouverte
 * n'est pas de la prudence.
 *
 * La liste des roles vit au SSOT (`auth/habilitations.ts`), avec le CV et la
 * photo qui la partagent. Une liste recopiee ici divergerait — le depot vient
 * d'en solder vingt-neuf copies du predicat d'ecriture.
 */
async function requireAdminRead(): Promise<{ userId: string; email: string; role: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role ?? "reader";
  if (!peutOuvrirDossierCandidat(role)) throw new Error("forbidden");
  return { userId: session.user.id, email: session.user.email ?? "", role };
}
async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  if ((session.user as { role?: string }).role !== "super_admin") throw new Error("forbidden");
  return { userId: session.user.id };
}

// ============================================================ list
const listSchema = z.object({
  offerId: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().uuid().optional(),
  ),
  status: z.enum([...STATUSES, "all"]).default("all"),
  // Vues séparées (demande Will 2026-08-12) : la vue standard EXCLUT l'offre
  // monteur vidéo freelance, qui a son propre onglet. L'onglet « Toutes »
  // (demande Will 2026-08-13) passe `all` : aucune contrainte d'offre.
  // Le défaut reste `standard` — la boîte de réception unifiée appelle cette
  // action sans `view` et son canal Candidatures ne doit pas changer de
  // périmètre en silence.
  view: z.enum(["standard", "monteur", "all"]).default("standard"),
  onlyAttention: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(50),
});
export type ListApplicationsInput = z.infer<typeof listSchema>;

export interface JobApplicationListItem {
  id: string;
  offerId: string;
  offerTitleSnap: string;
  contactName: string;
  contactEmail: string;
  status: JobApplicationStatus;
  hasCv: boolean;
  needsAttention: boolean;
  submittedAt: Date;
}

export async function listApplicationsAction(input: Partial<ListApplicationsInput> = {}) {
  await requireAdminRead();
  const parsed = listSchema.parse(input);
  const where: Record<string, unknown> = {};
  if (parsed.offerId) where.offerId = parsed.offerId;
  if (parsed.status !== "all") where.status = parsed.status;
  if (parsed.onlyAttention) where.needsAttention = true;
  if (parsed.view === "monteur") {
    where.offer = { slug: VIDEO_EDITOR_OFFER_SLUG };
  } else if (parsed.view === "standard" && !parsed.offerId) {
    // Vue standard sans filtre d'offre explicite : les candidatures monteur
    // vidéo restent dans leur onglet. Un `offerId` explicite (lien depuis la
    // fiche offre) garde la priorité et n'est pas amputé.
    where.offer = { slug: { not: VIDEO_EDITOR_OFFER_SLUG } };
  }

  const [total, rows] = await Promise.all([
    prisma.jobApplication.count({ where }),
    prisma.jobApplication.findMany({
      where,
      orderBy: [{ submittedAt: "desc" }],
      skip: (parsed.page - 1) * parsed.pageSize,
      take: parsed.pageSize,
      select: {
        id: true,
        offerId: true,
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
  ]);

  const items: JobApplicationListItem[] = rows.map((r) => ({
    id: r.id,
    offerId: r.offerId,
    offerTitleSnap: r.offerTitleSnap,
    contactName: `${safeDecrypt(r.firstName)} ${safeDecrypt(r.lastName)}`.trim(),
    contactEmail: safeDecrypt(r.email),
    status: r.status,
    hasCv: Boolean(r.cvStoragePath),
    needsAttention: r.needsAttention,
    submittedAt: r.submittedAt,
  }));

  return {
    items,
    total,
    page: parsed.page,
    pageSize: parsed.pageSize,
    totalPages: Math.max(1, Math.ceil(total / parsed.pageSize)),
  };
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
  contactName: string;
  contactEmail: string;
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
  offerId: string;
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
    needsAttention: formData.get("needsAttention"),
  });
  if (!parsed.success) return { ok: false, error: "Champs invalides." };

  await prisma.jobApplication.update({
    where: { id: parsed.data.id },
    data: {
      status: parsed.data.status,
      internalNotes: parsed.data.internalNotes ?? null,
      assignedTo: parsed.data.assignedTo ?? null,
      needsAttention: parsed.data.needsAttention,
    },
  });
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
