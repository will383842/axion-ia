/**
 * Knowledge Base — query builders Prisma typés.
 *
 * Spec : `_AUDIT/KNOWLEDGE-BASE-2026/04-API-ACTIONS.md` (Agent 4).
 * V1 minimal — helpers étendus dans Sprints KB-3, KB-4, KB-7.
 *
 * Convention : tous les helpers excluent `deletedAt IS NOT NULL` par défaut
 * (soft-delete pattern). Surcharge via `includeDeleted: true`.
 */

import type { KbAudience, KbStatus, KbType, Prisma } from "../../../prisma/generated/client";
import { isVisibleStatus } from "@/content/knowledge/statuses";

/** Conditions Prisma "entrée vivante" (pas soft-deleted). */
export const ALIVE_WHERE: Pick<Prisma.KnowledgeEntryWhereInput, "deletedAt"> = {
  deletedAt: null,
};

/**
 * Conditions Prisma "entrée publique consultable".
 * Visible côté SSR public + sitemap : status visible + audience public + alive.
 */
export const PUBLIC_VISIBLE_WHERE: Prisma.KnowledgeEntryWhereInput = {
  deletedAt: null,
  audience: "public",
  status: { in: ["published", "deprecated"] },
};

/**
 * Conditions Prisma "entrée client connecté" (public OU client + status visible).
 */
export const CLIENT_VISIBLE_WHERE: Prisma.KnowledgeEntryWhereInput = {
  deletedAt: null,
  audience: { in: ["public", "client"] },
  status: { in: ["published", "deprecated"] },
};

/** Conditions Prisma "entrée admin éditeur" (toutes audiences sauf will_only). */
export function adminVisibleWhere(allowWillOnly: boolean): Prisma.KnowledgeEntryWhereInput {
  if (allowWillOnly) {
    return { deletedAt: null };
  }
  return {
    deletedAt: null,
    audience: { in: ["public", "client", "team"] },
  };
}

/** Statut visible côté front public. */
export function isFrontVisible(status: KbStatus, audience: KbAudience): boolean {
  return isVisibleStatus(status) && audience === "public";
}

/**
 * Construit la condition `where` pour lister les entrées d'un type donné
 * en respectant audience visibility + status visible.
 */
export function buildListWhere(opts: {
  type?: KbType | KbType[];
  audience: KbAudience | "all";
  statuses?: KbStatus[];
  domain?: string;
  tagSlugs?: string[];
  search?: string;
  includeDeleted?: boolean;
}): Prisma.KnowledgeEntryWhereInput {
  const where: Prisma.KnowledgeEntryWhereInput = {};

  if (!opts.includeDeleted) {
    where.deletedAt = null;
  }

  if (opts.type) {
    where.type = Array.isArray(opts.type) ? { in: opts.type } : opts.type;
  }

  if (opts.audience !== "all") {
    where.audience = opts.audience;
  }

  if (opts.statuses && opts.statuses.length > 0) {
    where.status = { in: opts.statuses };
  }

  if (opts.domain) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where.domain = opts.domain as any;
  }

  if (opts.tagSlugs && opts.tagSlugs.length > 0) {
    where.tags = {
      some: {
        tag: { slug: { in: opts.tagSlugs } },
      },
    };
  }

  if (opts.search) {
    // Recherche basique titre/excerpt côté translation. FTS complet en Sprint KB-7.
    where.translations = {
      some: {
        OR: [
          { title: { contains: opts.search, mode: "insensitive" } },
          { excerpt: { contains: opts.search, mode: "insensitive" } },
        ],
      },
    };
  }

  return where;
}

/** Inclut les relations courantes pour rendu d'une entrée (admin ou public). */
export const COMMON_ENTRY_INCLUDE = {
  translations: true,
  tags: { include: { tag: true } },
  coverImage: true,
} as const satisfies Prisma.KnowledgeEntryInclude;

/** Inclut relations détaillées (admin édition — tabs Versions/Relations). */
export const DETAILED_ENTRY_INCLUDE = {
  translations: { include: { ogImage: true } },
  tags: { include: { tag: true } },
  coverImage: true,
  outgoingRelations: { include: { toEntry: true } },
  incomingRelations: { include: { fromEntry: true } },
  reviewerAssignments: true,
} as const satisfies Prisma.KnowledgeEntryInclude;
