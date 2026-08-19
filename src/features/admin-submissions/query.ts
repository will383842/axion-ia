/**
 * Périmètre des soumissions — schéma de filtres et construction du `where`.
 *
 * POURQUOI CE MODULE EXISTE (2026-08-18)
 * --------------------------------------
 * Le listing et l'export CSV construisaient chacun LEUR `where`, à deux endroits
 * de `actions.ts`. Celui de l'export en avait oublié quatre clauses :
 *
 *   · `deletedAt` — il ressortait les messages mis à la CORBEILLE ;
 *   · `archivedAt` — et les archivés, que l'écran masque ;
 *   · `submittedAt` — la plage de dates de l'écran était ignorée ;
 *   · `replyStatus` — le filtre « statut réponse » aussi.
 *
 * Un commentaire de `actions.ts` disait pourtant, à propos d'un autre filtre :
 * « un CSV qui ne correspond pas à ce qu'on regarde est pire qu'un export
 * absent ». La règle était juste, elle n'était appliquée qu'une fois sur cinq.
 *
 * Deux `where` séparés divergent toujours. Il n'y en a plus qu'un.
 *
 * ⚠️ Ce fichier n'est PAS un module `"use server"` : il exporte des fonctions
 * synchrones, ce que Next.js interdit dans un fichier de Server Actions.
 */

import { z } from "zod";
import type { Prisma } from "../../../prisma/generated/client";

export const listSubmissionsSchema = z.object({
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

/**
 * Traduit les filtres de l'écran en clause Prisma.
 *
 * 🔴 SEULE la recherche libre (`search`) n'est PAS ici, et c'est structurel :
 * `contactEmail` / `contactName` sont chiffrés avec un IV aléatoire, donc aucun
 * `contains` SQL ne peut matcher. Elle est appliquée EN MÉMOIRE après
 * déchiffrement, par l'appelant. Voir `matchSubmissionSearch`.
 */
export function buildSubmissionsWhere(parsed: ListSubmissionsInput): Prisma.SubmissionWhereInput {
  const where: Prisma.SubmissionWhereInput = {};

  if (parsed.type !== "all") where.type = parsed.type;

  // Filtre par catégorie (details.unifiedType en JSON Postgres). `unifiedTypeIn`
  // (onglet « Clients » = plusieurs types) → OR de equals ; sinon type unique.
  // NB : `where.OR` est libre (la recherche est filtrée en mémoire, elle ne pose
  // plus de clause OR SQL).
  if (parsed.unifiedTypeIn && parsed.unifiedTypeIn.length > 0) {
    where.OR = parsed.unifiedTypeIn.map((t) => ({
      details: { path: ["unifiedType"], equals: t },
    }));
  } else if (parsed.unifiedType) {
    where.details = { path: ["unifiedType"], equals: parsed.unifiedType };
  }

  if (parsed.status !== "all") where.status = parsed.status;
  if (parsed.locale !== "all") where.locale = parsed.locale;

  // Corbeille — l'onglet « Corbeille » n'affiche QUE les soft-deleted et ignore
  // le filtre archivés ; sinon on masque toujours les soft-deleted.
  if (parsed.deleted) {
    where.deletedAt = { not: null };
  } else {
    where.deletedAt = null;
    if (!parsed.includeArchived) where.archivedAt = null;
  }

  // Statut réponse. « unanswered » = needsAttention (défaut à la création),
  // « answered » = replyCount > 0, « failed » = au moins une reply en échec.
  if (parsed.replyStatus === "unanswered") {
    where.needsAttention = true;
  } else if (parsed.replyStatus === "answered") {
    where.replyCount = { gt: 0 };
  } else if (parsed.replyStatus === "failed") {
    where.replies = { some: { deliveryStatus: { in: ["failed", "bounced"] } } };
  }

  if (parsed.dateFrom || parsed.dateTo) {
    const plage: { gte?: Date; lte?: Date } = {};
    if (parsed.dateFrom) plage.gte = new Date(parsed.dateFrom);
    if (parsed.dateTo) {
      const to = new Date(parsed.dateTo);
      // Borne INCLUSIVE : « jusqu'au 31 » doit garder le 31 en entier.
      to.setUTCHours(23, 59, 59, 999);
      plage.lte = to;
    }
    where.submittedAt = plage;
  }

  return where;
}

/** Terme de recherche normalisé, ou `null` si trop court pour être utile. */
export function normalizeSearch(search: string | undefined): string | null {
  const s = search?.trim().toLowerCase();
  return s && s.length >= 2 ? s : null;
}

/**
 * Recherche libre, appliquée APRÈS déchiffrement (cf. `buildSubmissionsWhere`).
 * Partagée par le listing et l'export : sans elle, exporter depuis un écran
 * filtré par nom ramenait toute la boîte.
 */
export function matchSubmissionSearch(
  row: { contactEmail: string | null; contactName: string | null; companyName: string | null },
  terme: string,
): boolean {
  return (
    (row.contactEmail ?? "").toLowerCase().includes(terme) ||
    (row.contactName ?? "").toLowerCase().includes(terme) ||
    (row.companyName ?? "").toLowerCase().includes(terme)
  );
}

/**
 * Périmètre consigné au journal RGPD (`activity_logs.action = 'submission.exported'`).
 *
 * Il doit décrire ce qui a RÉELLEMENT été exporté : il ne portait que trois
 * champs sur onze, ce qui rendait le journal incapable de dire de quel extrait
 * une demande d'accès avait fait l'objet.
 */
export function exportedScope(parsed: ListSubmissionsInput): Record<string, unknown> {
  return {
    type: parsed.type,
    status: parsed.status,
    locale: parsed.locale,
    replyStatus: parsed.replyStatus,
    deleted: parsed.deleted,
    includeArchived: parsed.includeArchived,
    ...(parsed.unifiedType ? { unifiedType: parsed.unifiedType } : {}),
    ...(parsed.unifiedTypeIn?.length ? { unifiedTypeIn: parsed.unifiedTypeIn } : {}),
    ...(parsed.dateFrom ? { dateFrom: parsed.dateFrom } : {}),
    ...(parsed.dateTo ? { dateTo: parsed.dateTo } : {}),
    // 🔴 Le TERME de recherche n'est jamais consigné : un opérateur cherche par
    // adresse e-mail, et `activity_logs` est justement l'endroit où ce dépôt
    // s'interdit de réintroduire une PII en clair (cf. `hashEmailForAudit`).
    // Savoir QU'UNE recherche restreignait l'extrait suffit à l'audit.
    ...(normalizeSearch(parsed.search) ? { rechercheAppliquee: true } : {}),
  };
}
