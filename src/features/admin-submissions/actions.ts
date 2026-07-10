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
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { adminPath } from "@/lib/admin-path";
import { decryptPii } from "@/lib/pii-crypto";
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

const listSubmissionsSchema = z.object({
  type: z.enum(["audit", "implementation", "intervention", "contact", "all"]).default("all"),
  /** Filtre fin sur details.unifiedType (ex « recrutement » → onglet Commercial). */
  unifiedType: z.string().optional(),
  /**
   * Filtre multi-types sur details.unifiedType (ex onglet « Clients » = audit +
   * implementation + formation + un_a_un + devis + support_client). Prioritaire
   * sur `unifiedType` si fourni.
   */
  unifiedTypeIn: z.array(z.string()).optional(),
  status: z.enum(["new", "in_progress", "processed", "archived", "all"]).default("all"),
  locale: z.enum(["fr", "en", "all"]).default("all"),
  search: z.string().optional(),
  /** ISO date YYYY-MM-DD inclusif. */
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
  /**
   * Sprint Notif Infra 2026-05-26 / fix P0-2 audit 2026-05-27 — par défaut on
   * masque les submissions archivées (archivedAt non null). L'admin peut
   * activer le toggle pour les voir.
   */
  includeArchived: z.coerce.boolean().default(false),
  /**
   * Sprint Notif Infra 2026-05-26 / fix P1-2 audit 2026-05-27 — filtre
   * sur le statut réponse (computed depuis replyCount + dernière deliveryStatus).
   */
  replyStatus: z.enum(["all", "unanswered", "answered", "failed"]).default("all"),
  /**
   * Corbeille (2026-07-10) — `false` (défaut) masque les messages soft-deleted
   * (deletedAt non null). `true` = onglet « Corbeille » : n'affiche QUE les
   * soft-deleted (le filtre archivés est alors ignoré).
   */
  deleted: z.coerce.boolean().default(false),
});
export type ListSubmissionsInput = z.infer<typeof listSubmissionsSchema>;

export interface SubmissionListItem {
  id: string;
  type: SubmissionType;
  status: SubmissionStatus;
  locale: Locale;
  companyName: string;
  contactName: string;
  contactEmail: string;
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

  const where: Parameters<typeof prisma.submission.findMany>[0] extends infer T
    ? T extends { where?: infer W }
      ? W
      : never
    : never = {};

  if (parsed.type !== "all") where.type = parsed.type;
  // Filtre par catégorie (details.unifiedType en JSON Postgres). `unifiedTypeIn`
  // (onglet « Clients » = plusieurs types) → OR de equals ; sinon type unique.
  // NB : `where.OR` est libre ici (la recherche est filtrée EN MÉMOIRE après
  // déchiffrement, cf. plus bas — elle ne pose plus de clause OR SQL).
  if (parsed.unifiedTypeIn && parsed.unifiedTypeIn.length > 0) {
    (where as { OR?: unknown }).OR = parsed.unifiedTypeIn.map((t) => ({
      details: { path: ["unifiedType"], equals: t },
    }));
  } else if (parsed.unifiedType) {
    (where as { details?: unknown }).details = {
      path: ["unifiedType"],
      equals: parsed.unifiedType,
    };
  }
  if (parsed.status !== "all") where.status = parsed.status;
  if (parsed.locale !== "all") where.locale = parsed.locale;

  // Corbeille (2026-07-10) — l'onglet « Corbeille » n'affiche QUE les
  // soft-deleted et ignore le filtre archivés ; sinon on masque toujours les
  // soft-deleted (deletedAt non null).
  if (parsed.deleted) {
    where.deletedAt = { not: null };
  } else {
    where.deletedAt = null;
    // Sprint Notif Infra 2026-05-26 / fix P0-2 audit 2026-05-27 — masque les
    // archivés par défaut. L'admin peut les ré-inclure via toggle.
    if (!parsed.includeArchived) {
      where.archivedAt = null;
    }
  }

  // Sprint Notif Infra 2026-05-26 / fix P1-2 audit 2026-05-27 — filtre
  // par statut réponse. "unanswered" = needsAttention=true (par défaut à la
  // création de la Submission), "answered" = replyCount>0, "failed" = a au
  // moins une reply avec deliveryStatus ∈ {failed, bounced}.
  if (parsed.replyStatus === "unanswered") {
    where.needsAttention = true;
  } else if (parsed.replyStatus === "answered") {
    where.replyCount = { gt: 0 };
  } else if (parsed.replyStatus === "failed") {
    where.replies = {
      some: { deliveryStatus: { in: ["failed", "bounced"] } },
    };
  }

  if (parsed.dateFrom || parsed.dateTo) {
    where.submittedAt = {};
    if (parsed.dateFrom) (where.submittedAt as { gte?: Date }).gte = new Date(parsed.dateFrom);
    if (parsed.dateTo) {
      const to = new Date(parsed.dateTo);
      to.setUTCHours(23, 59, 59, 999);
      (where.submittedAt as { lte?: Date }).lte = to;
    }
  }

  // NB : la recherche par email/nom N'EST PAS un filtre SQL. `contactEmail` /
  // `contactName` sont chiffrés au repos (AES-GCM, IV aléatoire → non
  // déterministe), donc un `contains` SQL ne matche jamais. On filtre en mémoire
  // après déchiffrement (voir plus bas). `companyName` reste en clair.

  // Sélection partagée liste + recherche.
  const select = {
    id: true,
    type: true,
    status: true,
    locale: true,
    companyName: true,
    contactName: true,
    contactEmail: true,
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
    return {
      id: s.id,
      type: s.type,
      status: s.status,
      locale: s.locale,
      companyName: s.companyName,
      contactName: decryptPii(s.contactName),
      contactEmail: decryptPii(s.contactEmail),
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
    };
  };

  const searchQ =
    parsed.search && parsed.search.trim().length >= 2 ? parsed.search.trim().toLowerCase() : null;

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
    const filtered = scanned
      .map(mapRow)
      .filter(
        (r) =>
          (r.contactEmail ?? "").toLowerCase().includes(searchQ) ||
          (r.contactName ?? "").toLowerCase().includes(searchQ) ||
          (r.companyName ?? "").toLowerCase().includes(searchQ),
      );
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

export async function exportSubmissionsCsvAction(
  input: Partial<ListSubmissionsInput> = {},
): Promise<{ filename: string; csv: string }> {
  // Sprint 15 fix Fork 2 C2-2 : RGPD — export PII reservé super_admin/admin
  const session = await requireAdminWriteSession();
  const parsed = listSubmissionsSchema.parse({ ...input, pageSize: 100, page: 1 });

  // Activity log d'audit RGPD
  const exportFilters: { type: string; status: string; locale: string } = {
    type: parsed.type,
    status: parsed.status,
    locale: parsed.locale,
  };
  await prisma.activityLog.create({
    data: {
      adminUserId: session.userId,
      action: "submission.exported",
      targetType: "submission",
      changes: exportFilters,
      ipAddress: await getClientIp(),
    },
  });

  const where: Record<string, unknown> = {};
  if (parsed.type !== "all") where.type = parsed.type;
  if (parsed.status !== "all") where.status = parsed.status;
  if (parsed.locale !== "all") where.locale = parsed.locale;

  // Cap export a 5000 lignes pour ne pas saturer la RAM admin V1.
  const rows = await prisma.submission.findMany({
    where,
    orderBy: { submittedAt: "desc" },
    take: 5000,
    select: {
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
    },
  });

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
  ];
  const escape = (v: unknown): string => {
    if (v == null) return "";
    const s = String(v);
    if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = rows.map((raw) => {
    // Déchiffre le PII (enc:v1) pour un export lisible. No-op sur le clair.
    const r: Record<string, unknown> = {
      ...raw,
      contactName: decryptPii(raw.contactName),
      contactEmail: decryptPii(raw.contactEmail),
      contactPhone: decryptPii(raw.contactPhone),
      address: decryptPii(raw.address),
    };
    return headers.map((h) => escape(r[h])).join(";");
  });
  // BOM UTF-8 + CRLF (Windows Excel friendly)
  const csv = "﻿" + headers.join(";") + "\r\n" + lines.join("\r\n");
  const filename = `axion-ia-submissions-${new Date().toISOString().slice(0, 10)}.csv`;

  return { filename, csv };
}
