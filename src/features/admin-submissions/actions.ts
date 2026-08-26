// Server Actions admin /soumissions (M9 Tier 1 section 1).
//
// Doctrine CLAUDE.md §14 : tous les forms publics sont stockes en table
// `submissions`. Cette section permet a l'admin de :
//  - lister avec filtres (type / status / locale / date / search)
//  - voir le detail (incluant bookings lies si type='intervention')
//  - mettre a jour status + internalNotes + assignedTo
//  - exporter en CSV UTF-8 BOM (Excel-compatible)

"use server";

import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { adminPath } from "@/lib/admin-path";
import { decryptPii } from "@/lib/pii-crypto";
import { csvEscape } from "@/lib/csv";
import { ROI_DETAILS_KEYS as K } from "@/lib/roi/submission-details";
import {
  listSubmissionsSchema,
  buildSubmissionsWhere,
  normalizeSearch,
  matchSubmissionSearch,
  exportedScope,
  type ListSubmissionsInput,
} from "./query";
import type {
  SubmissionType,
  SubmissionStatus,
  Locale,
  Prisma,
} from "../../../prisma/generated/client";

// ============================================================
// AUTH guard helper (RBAC simple V1 : super_admin/admin/editor)
// ============================================================

async function requireAdminWriteSession() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role;
  if (role !== "super_admin" && role !== "admin" && role !== "editor") {
    throw new Error("forbidden");
  }
  return { userId: session.user.id, role };
}

async function requireAdminReadSession() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  return session.user.id;
}

// ============================================================
// listSubmissions — filtres + pagination
// ============================================================
//
// Le schéma de filtres et la construction du `where` vivent dans `./query`
// (module NON `"use server"`, puisqu'il exporte des fonctions synchrones). Ils
// y ont été déplacés le 2026-08-18 parce que le listing et l'export en avaient
// chacun leur version, et que celle de l'export oubliait quatre clauses — dont
// la corbeille.

export type { ListSubmissionsInput } from "./query";

export interface SubmissionListItem {
  id: string;
  type: SubmissionType;
  status: SubmissionStatus;
  locale: Locale;
  companyName: string;
  contactName: string;
  contactEmail: string;
  /** Téléphone déchiffré (2026-08-13 — colonne Téléphone du listing). Null si absent. */
  contactPhone: string | null;
  /** Extrait du contenu (details.message, tronqué à 300 caractères) pour
   *  l'afficher directement dans le listing (demande Will 2026-08-13). */
  messageExtrait: string | null;
  sector: string | null;
  assignedTo: string | null;
  submittedAt: Date;
  // Sprint Notif Infra 2026-05-26 / fix P1-2 — champs reply system pour
  // afficher les badges Sans réponse / Répondu (N) / Échec dans le listing.
  replyCount: number;
  needsAttention: boolean;
  archivedAt: Date | null;
  /** Corbeille (2026-07-10) — non null = soft-deleted (dans la corbeille). */
  deletedAt: Date | null;
  lastRepliedAt: Date | null;
  /** Status delivery de la DERNIÈRE reply (null si aucune). */
  lastReplyStatus: string | null;
  /** Form v2 (2026-05-28) — type fin extrait de details.unifiedType. Les 5
   * nouveaux types (presse, recrutement, speaker, investisseur, support_client)
   * sont stockés en DB comme SubmissionType.contact + details.unifiedType. */
  unifiedType: string | null;
  /** details.subType — le slug de la formation (devis express des fiches) ou la
   * granularité fine (audit-flash, chatbot…). C'est LE contexte que la boîte de
   * réception affichait « — » alors qu'il était en base (relevé P1-08). */
  subType: string | null;
}

export interface SubmissionListResult {
  items: SubmissionListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listSubmissionsAction(
  input: Partial<ListSubmissionsInput> = {},
): Promise<SubmissionListResult> {
  await requireAdminReadSession();
  const parsed = listSubmissionsSchema.parse(input);

  // Un SEUL constructeur de `where`, partagé avec l'export CSV (cf. `./query`).
  //
  // NB : la recherche par email/nom N'EST PAS un filtre SQL. `contactEmail` /
  // `contactName` sont chiffrés au repos (AES-GCM, IV aléatoire → non
  // déterministe), donc un `contains` SQL ne matche jamais. On filtre en mémoire
  // après déchiffrement (voir plus bas). `companyName` reste en clair.
  const where = buildSubmissionsWhere(parsed);

  // Sélection partagée liste + recherche.
  const select = {
    id: true,
    type: true,
    status: true,
    locale: true,
    companyName: true,
    contactName: true,
    contactEmail: true,
    contactPhone: true,
    sector: true,
    assignedTo: true,
    submittedAt: true,
    replyCount: true,
    needsAttention: true,
    archivedAt: true,
    deletedAt: true,
    lastRepliedAt: true,
    // Form v2 — `details` JSON contient unifiedType (le champ `type` DB n'a que
    // 5 valeurs enum, vs 12 types unifiés).
    details: true,
    // Dernière reply → lastReplyStatus (badge "Échec envoi").
    replies: {
      orderBy: { repliedAt: "desc" },
      take: 1,
      select: { deliveryStatus: true },
    },
  } satisfies Prisma.SubmissionSelect;

  // Mappe une ligne DB → SubmissionListItem. DÉCHIFFRE le PII : contactName /
  // contactEmail sont stockés chiffrés (enc:v1) par le formulaire ; decryptPii
  // est un no-op sur les valeurs en clair (leads chatbot) → sûr partout.
  const mapRow = (s: Prisma.SubmissionGetPayload<{ select: typeof select }>) => {
    const details =
      s.details && typeof s.details === "object" && !Array.isArray(s.details)
        ? (s.details as Record<string, unknown>)
        : null;
    const unifiedType =
      details && typeof details.unifiedType === "string" ? details.unifiedType : null;
    const subType = details && typeof details.subType === "string" ? details.subType : null;
    const rawMessage = details && typeof details.message === "string" ? details.message.trim() : "";
    return {
      id: s.id,
      type: s.type,
      status: s.status,
      locale: s.locale,
      companyName: s.companyName,
      contactName: decryptPii(s.contactName),
      contactEmail: decryptPii(s.contactEmail),
      contactPhone: s.contactPhone ? decryptPii(s.contactPhone) : null,
      messageExtrait: rawMessage
        ? rawMessage.length > 300
          ? `${rawMessage.slice(0, 300)}…`
          : rawMessage
        : null,
      sector: s.sector,
      assignedTo: s.assignedTo,
      submittedAt: s.submittedAt,
      replyCount: s.replyCount,
      needsAttention: s.needsAttention,
      archivedAt: s.archivedAt,
      deletedAt: s.deletedAt,
      lastRepliedAt: s.lastRepliedAt,
      lastReplyStatus: s.replies[0]?.deliveryStatus ?? null,
      unifiedType,
      subType,
    };
  };

  const searchQ = normalizeSearch(parsed.search);

  let mapped: ReturnType<typeof mapRow>[];
  let total: number;
  if (searchQ) {
    // Scan borné des plus récents (matchant les AUTRES filtres) → déchiffre →
    // filtre + pagine en mémoire. Une boîte admin dépasse rarement ce plafond.
    const SEARCH_SCAN_CAP = 2000;
    const scanned = await prisma.submission.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      take: SEARCH_SCAN_CAP,
      select,
    });
    const filtered = scanned.map(mapRow).filter((r) => matchSubmissionSearch(r, searchQ));
    total = filtered.length;
    const start = (parsed.page - 1) * parsed.pageSize;
    mapped = filtered.slice(start, start + parsed.pageSize);
  } else {
    const [count, items] = await Promise.all([
      prisma.submission.count({ where }),
      prisma.submission.findMany({
        where,
        orderBy: { submittedAt: "desc" },
        skip: (parsed.page - 1) * parsed.pageSize,
        take: parsed.pageSize,
        select,
      }),
    ]);
    total = count;
    mapped = items.map(mapRow);
  }

  return {
    items: mapped,
    total,
    page: parsed.page,
    pageSize: parsed.pageSize,
    totalPages: Math.max(1, Math.ceil(total / parsed.pageSize)),
  };
}

// ============================================================
// getSubmissionDetail
// ============================================================

export async function getSubmissionDetailAction(id: string) {
  await requireAdminReadSession();
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      bookings: {
        select: {
          id: true,
          interventionType: true,
          bookingDate: true,
          participantsCount: true,
          status: true,
          pricePaidCents: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!submission) return submission;
  // Déchiffre le PII stocké chiffré (enc:v1). No-op sur les valeurs en clair.
  return {
    ...submission,
    contactName: decryptPii(submission.contactName),
    contactEmail: decryptPii(submission.contactEmail),
    contactPhone: decryptPii(submission.contactPhone),
    address: decryptPii(submission.address),
  };
}

// ============================================================
// updateSubmission — status + internalNotes + assignedTo
// ============================================================

const updateSubmissionSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["new", "in_progress", "processed", "archived"]).optional(),
  internalNotes: z.string().max(5000).nullable().optional(),
  assignedTo: z.string().max(100).nullable().optional(),
});
export type UpdateSubmissionState = { ok: true } | { ok: false; error: string };

export async function updateSubmissionAction(
  _prev: UpdateSubmissionState,
  formData: FormData,
): Promise<UpdateSubmissionState> {
  let session;
  try {
    session = await requireAdminWriteSession();
  } catch {
    return { ok: false, error: "Permission insuffisante." };
  }

  const parsed = updateSubmissionSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status") || undefined,
    internalNotes: formData.get("internalNotes") || null,
    assignedTo: formData.get("assignedTo") || null,
  });
  if (!parsed.success) return { ok: false, error: "Champs invalides." };

  const ip = await getClientIp();
  const data: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.internalNotes !== undefined) data.internalNotes = parsed.data.internalNotes;
  if (parsed.data.assignedTo !== undefined) data.assignedTo = parsed.data.assignedTo;

  await prisma.$transaction([
    prisma.submission.update({ where: { id: parsed.data.id }, data }),
    prisma.activityLog.create({
      data: {
        adminUserId: session.userId,
        action: "submission.updated",
        targetType: "submission",
        targetId: parsed.data.id,
        changes: data as Record<string, string | null>,
        ipAddress: ip,
      },
    }),
  ]);
  revalidatePath(adminPath("fr", "submissions"));
  return { ok: true };
}

// ============================================================
// eraseSubmission — droit a l'effacement RGPD (Sprint 24 / D1)
// ============================================================
//
// Suppression hard du Submission. Conserve une trace dans activity_log avec
// l'action `submission.erased` (RGPD-grade : audit trail de la demande
// d'effacement préservé sans réintroduire les PII supprimées).
// Reservé super_admin uniquement (RGPD écrasement = haute responsabilité).

const eraseSubmissionSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(3).max(500),
});
export type EraseSubmissionState = { ok: true } | { ok: false; error: string };

export async function eraseSubmissionAction(
  _prev: EraseSubmissionState,
  formData: FormData,
): Promise<EraseSubmissionState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Permission insuffisante." };
  const role = (session.user as { role?: string }).role;
  if (role !== "super_admin") {
    return { ok: false, error: "Effacement RGPD réservé super_admin." };
  }
  const parsed = eraseSubmissionSchema.safeParse({
    id: formData.get("id"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides." };
  }

  const ip = await getClientIp();

  await prisma.$transaction(async (tx) => {
    const sub = await tx.submission.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, type: true, contactEmail: true },
    });
    if (!sub) throw new Error("submission_not_found");

    // Detache les bookings (Submission.id devient null sur Booking.submissionId)
    // pour ne pas casser la referentielle. Le Booking lui-même reste (donnée
    // contractuelle conservée 5 ans, obligation comptable EE).
    await tx.booking.updateMany({
      where: { submissionId: parsed.data.id },
      data: { submissionId: null },
    });

    await tx.submission.delete({ where: { id: parsed.data.id } });

    // Activity log RGPD : on ne re-stocke pas l'email supprimé en clair, on
    // conserve uniquement le hash + reason + targetId pour traçabilité.
    const emailHash = await hashEmailForAudit(sub.contactEmail);
    await tx.activityLog.create({
      data: {
        adminUserId: session.user.id,
        action: "submission.erased",
        targetType: "submission",
        targetId: parsed.data.id,
        changes: {
          reason: parsed.data.reason,
          submissionType: sub.type,
          contactEmailHash: emailHash,
        },
        ipAddress: ip,
      },
    });
  });

  revalidatePath(adminPath("fr", "submissions"));
  return { ok: true };
}

// Hash email SHA-256 hex pour audit trail RGPD (Sprint 24 / D1).
// Permet de prouver qu'une demande d'effacement a porté sur une donnée
// précise, sans réintroduire l'email en clair dans activity_log.
async function hashEmailForAudit(email: string): Promise<string> {
  const data = new TextEncoder().encode(email.toLowerCase().trim());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ============================================================
// exportSubmissionsCsv — UTF-8 BOM (Excel compatible)
// ============================================================
//
// 🔴 CE QUI A CHANGÉ LE 2026-08-18 (préalable CRM, ligne 13)
// ----------------------------------------------------------
// 1. LE PLAFOND ÉTAIT MUET. `take: 5000` tronquait sans rien dire : ni en-tête,
//    ni ligne, ni journal. Un opérateur téléchargeait 5 000 lignes en croyant
//    tenir la totalité, et c'est aussi l'outil de réponse à une demande d'accès
//    RGPD — une troncature muette y est une réponse FAUSSE.
//    Il est remplacé par une pagination interne par curseur : l'export rend
//    désormais N lignes pour N soumissions. Un garde-fou dur subsiste
//    (`PLAFOND_EXPORT`), mais il est BRUYANT (ligne visible dans le fichier,
//    Sentry, journal RGPD) et fixé dix fois plus haut — voir sa justification.
//
// 2. LE PÉRIMÈTRE DIVERGEAIT. Le `where` était reconstruit ici, en oubliant la
//    corbeille, les archives, la plage de dates et le statut réponse : l'export
//    ressortait des messages supprimés et ignorait les filtres de l'écran. Il
//    n'y a plus qu'un constructeur, dans `./query`.
//
// 3. `parsed.pageSize` / `parsed.page` étaient posés à 100 / 1 pour satisfaire
//    Zod et n'étaient JAMAIS relus. Le raccourci est resté, mais il est nommé.

/**
 * Taille d'une page lue en base pendant l'export.
 *
 * 500 lignes × ~400 octets de champs sélectionnés ≈ 200 ko en vol. La mémoire
 * de la requête est donc bornée par la page, pas par la taille de la base.
 */
const TAILLE_PAGE_EXPORT = 500;

/**
 * Garde-fou dur, VOLONTAIREMENT conservé — et le chiffre est motivé.
 *
 * Une Server Action ne peut pas diffuser en flux : elle retourne le CSV en une
 * seule chaîne, qui est ensuite recopiée par la sérialisation RSC. Le coût
 * mémoire est donc proportionnel au TOTAL, pas à la page.
 *
 * Mesure sur une ligne réelle de cet export (22 colonnes, `details` non
 * sérialisé — seules des clés dérivées en sortent) : ~250 à 400 octets. À
 * 50 000 lignes : ~20 Mo de CSV, soit ~40 Mo en UTF-16 côté V8, plus le tableau
 * de lignes et la copie RSC — de l'ordre de 100 à 150 Mo au pic. C'est tenable
 * dans le conteneur ; 200 000 lignes ne le seraient pas.
 *
 * 50 000 correspond à ~137 soumissions PAR JOUR pendant un an. Le volume réel
 * est de l'ordre de quelques unités par jour : ce plafond n'est pas atteignable
 * à l'échelle du produit. S'il l'était, le remède n'est pas de l'augmenter mais
 * de diffuser depuis le route handler (`api/admin/submissions/export`), ce que
 * l'action ne peut structurellement pas faire.
 */
const PLAFOND_EXPORT = 50_000;

export async function exportSubmissionsCsvAction(
  input: Partial<ListSubmissionsInput> = {},
): Promise<{ filename: string; csv: string }> {
  // Sprint 15 fix Fork 2 C2-2 : RGPD — export PII reservé super_admin/admin
  const session = await requireAdminWriteSession();
  // `page` / `pageSize` ne servent qu'à satisfaire le schéma partagé avec le
  // listing : l'export ne pagine pas pour l'utilisateur, il pagine en interne.
  const parsed = listSubmissionsSchema.parse({ ...input, pageSize: 100, page: 1 });

  const where = buildSubmissionsWhere(parsed);
  const searchQ = normalizeSearch(parsed.search);

  const selection = {
    id: true,
    type: true,
    status: true,
    locale: true,
    companyName: true,
    sector: true,
    contactName: true,
    contactRole: true,
    contactEmail: true,
    contactPhone: true,
    employeesCount: true,
    address: true,
    assignedTo: true,
    internalNotes: true,
    submittedAt: true,
    // `details` porte le type métier fin, l'attribution publicitaire et — pour
    // les leads du simulateur — le gain estimé. Il n'était pas sélectionné :
    // l'export était donc inutilisable pour prioriser un rappel ou alimenter
    // un CRM, alors que la donnée existe en base depuis le premier jour.
    details: true,
  } as const;

  const headers = [
    "id",
    "type",
    "status",
    "locale",
    "companyName",
    "sector",
    "contactName",
    "contactRole",
    "contactEmail",
    "contactPhone",
    "employeesCount",
    "address",
    "assignedTo",
    "internalNotes",
    "submittedAt",
    // Type métier fin : `type` ne connaît que 5 valeurs d'enum, l'essentiel de
    // la distinction vit dans `details.unifiedType`.
    "categorie",
    // Attribution publicitaire — sans elle, impossible de rapprocher un lead
    // de la campagne qui l'a payé.
    "utmSource",
    "utmMedium",
    "utmCampaign",
    // Spécifique simulateur : vide pour les autres formulaires.
    "gainEstimeEurAn",
    "heuresEstimeesAn",
    "maturiteNumerique",
    "lienRapport",
  ];
  // 🔴 L'échappement local ne protégeait QUE le séparateur et les guillemets ;
  // il laissait passer un champ commençant par `=`, `+`, `-` ou `@`, que le
  // tableur ÉVALUE à l'ouverture. Le helper partagé (`@/lib/csv`) neutralise ce
  // préfixe, comme le fait déjà l'export public de l'observatoire.
  const escape = csvEscape;
  // `details` est un Json libre : on y pioche défensivement, une clé absente
  // ne doit jamais faire échouer l'export entier.
  const lire = (source: unknown, ...chemin: string[]): unknown => {
    let courant = source;
    for (const cle of chemin) {
      if (typeof courant !== "object" || courant === null) return undefined;
      courant = (courant as Record<string, unknown>)[cle];
    }
    return courant;
  };

  /** Une ligne DB → une ligne CSV, PII déchiffré. */
  const versLigne = (
    raw: Prisma.SubmissionGetPayload<{ select: typeof selection }>,
  ): {
    csv: string;
    recherche: { contactEmail: string; contactName: string; companyName: string };
  } => {
    const d = raw.details;
    // Déchiffre le PII (enc:v1) pour un export lisible. No-op sur le clair.
    const r: Record<string, unknown> = {
      ...raw,
      contactName: decryptPii(raw.contactName),
      contactEmail: decryptPii(raw.contactEmail),
      contactPhone: decryptPii(raw.contactPhone),
      address: decryptPii(raw.address),
      // Les noms de clés viennent de `ROI_DETAILS_KEYS`, partagé avec
      // l'écriture : un renommage côté simulateur casse le typecheck au lieu
      // de vider ces colonnes en silence.
      categorie: lire(d, K.categorie),
      utmSource: lire(d, K.funnel, "utm", "utm_source"),
      utmMedium: lire(d, K.funnel, "utm", "utm_medium"),
      utmCampaign: lire(d, K.funnel, "utm", "utm_campaign"),
      gainEstimeEurAn: lire(d, K.gain),
      heuresEstimeesAn: lire(d, K.heures),
      maturiteNumerique: lire(d, K.maturite),
      lienRapport: lire(d, K.rapport),
    };
    return {
      csv: headers.map((h) => escape(r[h])).join(";"),
      recherche: {
        contactEmail: String(r["contactEmail"] ?? ""),
        contactName: String(r["contactName"] ?? ""),
        companyName: String(r["companyName"] ?? ""),
      },
    };
  };

  // ── Lecture paginée par CURSEUR ─────────────────────────────────────────────
  //
  // Curseur et non `skip`/`take` : l'ordre est `submittedAt desc`, et une
  // soumission qui arrive PENDANT l'export décalerait toute la fenêtre — avec
  // `skip`, la même ligne serait rendue deux fois et une autre sautée. Le
  // couple (`submittedAt`, `id`) rend l'ordre total, donc le curseur stable.
  const lines: string[] = [];
  let curseur: string | null = null;
  let tronque = false;
  for (;;) {
    const page: Prisma.SubmissionGetPayload<{ select: typeof selection }>[] =
      await prisma.submission.findMany({
        where,
        orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
        take: TAILLE_PAGE_EXPORT,
        ...(curseur ? { cursor: { id: curseur }, skip: 1 } : {}),
        select: selection,
      });
    if (page.length === 0) break;
    for (const raw of page) {
      const l = versLigne(raw);
      // La recherche libre porte sur des champs CHIFFRÉS : elle ne peut pas
      // être une clause SQL, elle s'applique après déchiffrement — ligne à
      // ligne, donc sans le plafond de scan de 2 000 lignes du listing.
      if (searchQ && !matchSubmissionSearch(l.recherche, searchQ)) continue;
      lines.push(l.csv);
      if (lines.length >= PLAFOND_EXPORT) {
        tronque = true;
        break;
      }
    }
    if (tronque || page.length < TAILLE_PAGE_EXPORT) break;
    curseur = page[page.length - 1]!.id;
  }

  // Compté AVANT l'éventuelle ligne d'avertissement : le journal RGPD doit dire
  // combien de soumissions sont sorties, pas combien de lignes contient le
  // fichier.
  const lignesDonnees = lines.length;

  // Une troncature ne doit JAMAIS être muette : elle se voit dans le fichier,
  // dans Sentry, et dans le journal RGPD (plus bas).
  if (tronque) {
    const avertissement =
      `EXPORT TRONQUÉ à ${PLAFOND_EXPORT} lignes — ` +
      `le fichier est INCOMPLET. Restreindre la plage de dates ou les filtres.`;
    lines.push(escape(`### ${avertissement}`));
    Sentry.captureMessage(`[submissions:export] ${avertissement}`, "warning");
  }

  // Journal d'audit RGPD — écrit APRÈS la lecture pour pouvoir consigner ce qui
  // a réellement été rendu (nombre de lignes, troncature éventuelle). Il ne
  // portait que trois filtres sur onze : il ne permettait pas de dire de quel
  // extrait une demande d'accès avait fait l'objet.
  await prisma.activityLog.create({
    data: {
      adminUserId: session.userId,
      action: "submission.exported",
      targetType: "submission",
      changes: { ...exportedScope(parsed), lignes: lignesDonnees, tronque },
      ipAddress: await getClientIp(),
    },
  });

  // BOM UTF-8 + CRLF (Windows Excel friendly)
  const csv = "﻿" + headers.join(";") + "\r\n" + lines.join("\r\n");
  const filename = `axion-ia-submissions-${new Date().toISOString().slice(0, 10)}.csv`;

  return { filename, csv };
}
