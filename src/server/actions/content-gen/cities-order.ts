/**
 * Content Generator — Cities order server actions (Sprint v7 Phase 1 commit 2).
 *
 * Gère la file globale `CityGenerationOrder` partagée par les campagnes en
 * mode `villeScopeMode=global_queue`. Will peut réordonner manuellement, pin
 * en tête de file, et consulter la couverture d'une ville (3 buckets D13
 * prompt v7 : editorial / landings / RSS).
 *
 * Doctrine § 4.1bis : tout effet de bord côté admin DOIT passer par une
 * Server Action. Pattern obligatoire (cf. prompt v7 §9.2 + audit A10 SOC2) :
 *   - "use server"
 *   - Inputs Zod-validés strict
 *   - requireAdminWriteRateLimited sur mutations
 *   - try/catch + Sentry.captureException + tags
 *   - logActivity audit trail
 *   - revalidatePath sur paths admin impactés
 */

"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { logActivity } from "@/server/content-gen/shared/activity-log";

import { requireAdmin, requireAdminWriteRateLimited } from "./_auth";

// ─── Helpers ────────────────────────────────────────────────────────────────

function adminBase(): string {
  return `/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/cities-order`;
}

// ─── Bucket ContentType (D13 prompt v7) ─────────────────────────────────────

// Editorial = blog + guides + comparison + Q/A + FAQ (contenu informationnel/comparatif)
const EDITORIAL_CONTENT_TYPES = [
  "blog_article",
  "blog_from_keywords",
  "blog_from_title",
  "comparison",
  "guide_pilier",
  "qa_derived",
  "faq_standalone",
] as const;

const LANDING_CONTENT_TYPE = "landing_ville" as const;
const RSS_CONTENT_TYPE = "blog_from_rss" as const;

// ─── Zod schemas ────────────────────────────────────────────────────────────

const FiltersSchema = z
  .object({
    regionSlug: z.string().min(1).max(64).optional(),
    deptCode: z.string().min(1).max(8).optional(),
    tier: z.enum(["T1", "T2", "T3", "T4"]).optional(),
    pinned: z.boolean().optional(),
  })
  .strict();

const ListOptsSchema = z
  .object({
    page: z.number().int().min(1).max(1000).optional(),
    pageSize: z.number().int().min(1).max(2500).optional(),
    filters: FiltersSchema.optional(),
  })
  .strict();

const ReorderSchema = z
  .object({
    slugs: z.array(z.string().min(1).max(120)).min(1).max(2200),
  })
  .strict();

const PinSchema = z
  .object({
    slug: z.string().min(1).max(120),
    pinned: z.boolean(),
  })
  .strict();

const VilleSlugSchema = z.string().min(1).max(120);

// ─── Types publics ──────────────────────────────────────────────────────────

export interface CityRow {
  readonly villeSlug: string;
  readonly rank: number;
  readonly pinned: boolean;
  readonly pinnedAt: Date | null;
  readonly regionSlug: string;
  readonly deptCode: string;
  readonly tier: string;
  readonly pop: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CityOrderPage {
  readonly rows: ReadonlyArray<CityRow>;
  readonly total: number;
}

export interface CoverageStats {
  readonly coveredEditorial: number;
  readonly coveredLandings: number;
  readonly coveredRss: number;
}

export interface ListOpts {
  readonly page?: number;
  readonly pageSize?: number;
  readonly filters?: {
    readonly regionSlug?: string;
    readonly deptCode?: string;
    readonly tier?: "T1" | "T2" | "T3" | "T4";
    readonly pinned?: boolean;
  };
}

// ============================================================
// Action 1 — getCityGenerationOrder (lecture paginée + filtres)
// ============================================================

export async function getCityGenerationOrder(rawOpts?: unknown): Promise<CityOrderPage> {
  await requireAdmin();
  const parsed = rawOpts === undefined ? {} : ListOptsSchema.parse(rawOpts);
  const page = parsed.page ?? 1;
  const pageSize = parsed.pageSize ?? 100;
  const filters = parsed.filters ?? {};

  const where = {
    ...(filters.regionSlug ? { regionSlug: filters.regionSlug } : {}),
    ...(filters.deptCode ? { deptCode: filters.deptCode } : {}),
    ...(filters.tier ? { tier: filters.tier } : {}),
    ...(filters.pinned !== undefined ? { pinned: filters.pinned } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.cityGenerationOrder.findMany({
      where,
      // Pinned en tête (pinnedAt DESC), puis rank ASC
      orderBy: [{ pinned: "desc" }, { pinnedAt: { sort: "desc", nulls: "last" } }, { rank: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.cityGenerationOrder.count({ where }),
  ]);

  return { rows, total };
}

// ============================================================
// Action 2 — reorderCities (batch atomic transaction + rate-limit)
// ============================================================
//
// Pattern 2-pass pour éviter @unique rank conflict :
//   Pass 1 : set rank = -(1_000_000 + i) — neutralise toutes les rangées
//            avec des valeurs négatives uniques temporaires.
//   Pass 2 : set rank = i + 1 — applique le nouvel ordre 1..N.
//
// Sans ce 2-pass, swapper rank entre 2 villes throw Prisma @unique violation
// dès le 1er update (intermediate state collide).
//
// Rate-limit : 30 reorders/min/admin (cap UI humain, bloque scripts).

export async function reorderCities(rawInput: unknown): Promise<void> {
  const session = await requireAdminWriteRateLimited("cities-reorder", {
    limit: 30,
    windowSec: 60,
  });
  const { slugs } = ReorderSchema.parse(rawInput);

  // Unicité requête (pas de doublons dans slugs[])
  if (new Set(slugs).size !== slugs.length) {
    throw new Error("duplicate_slugs");
  }

  try {
    // Pre-check existence : tous les slugs doivent exister sinon transaction
    // throw P2025 au 1er update (rollback) — meilleur DX avec message clair.
    const existingCount = await prisma.cityGenerationOrder.count({
      where: { villeSlug: { in: slugs } },
    });
    if (existingCount !== slugs.length) {
      throw new Error("slugs_not_found");
    }

    await prisma.$transaction(async (tx) => {
      // Pass 1 — neutralise via valeurs négatives uniques temporaires
      for (let i = 0; i < slugs.length; i++) {
        const slug = slugs[i];
        if (!slug) continue; // narrow noUncheckedIndexedAccess (loop bounded)
        await tx.cityGenerationOrder.update({
          where: { villeSlug: slug },
          data: { rank: -(1_000_000 + i) },
        });
      }
      // Pass 2 — applique le nouvel ordre 1..N
      for (let i = 0; i < slugs.length; i++) {
        const slug = slugs[i];
        if (!slug) continue;
        await tx.cityGenerationOrder.update({
          where: { villeSlug: slug },
          data: { rank: i + 1 },
        });
      }
    });

    revalidatePath(adminBase());

    await logActivity({
      session,
      action: "content-gen.cities-order.reorder",
      targetType: "CityGenerationOrder",
      targetId: null,
      changes: { count: slugs.length, first10: slugs.slice(0, 10) },
    });
  } catch (e) {
    Sentry.captureException(e, {
      tags: { area: "content-gen", action: "reorderCities" },
    });
    throw e;
  }
}

// ============================================================
// Action 3 — pinCity (toggle pinned + pinnedAt now/null)
// ============================================================

export async function pinCity(rawInput: unknown): Promise<void> {
  const session = await requireAdminWriteRateLimited("city-pin", {
    limit: 60,
    windowSec: 60,
  });
  const { slug, pinned } = PinSchema.parse(rawInput);

  try {
    await prisma.cityGenerationOrder.update({
      where: { villeSlug: slug },
      data: {
        pinned,
        pinnedAt: pinned ? new Date() : null,
      },
    });

    revalidatePath(adminBase());

    await logActivity({
      session,
      action: pinned ? "content-gen.cities-order.pin" : "content-gen.cities-order.unpin",
      targetType: "CityGenerationOrder",
      targetId: slug,
      changes: { pinned },
    });
  } catch (e) {
    Sentry.captureException(e, {
      tags: { area: "content-gen", action: "pinCity" },
    });
    throw e;
  }
}

// ============================================================
// Action 4 — getCoverageStats (D13 prompt v7 — 3 buckets distincts)
// ============================================================
//
// Compteurs distincts par bucket ContentType pour distinguer la couverture
// éditoriale (blog/guide/comparison/qa/faq), landings (landing_ville) et RSS
// (blog_from_rss). Permet à l'UI de signaler les manques par bucket :
// p. ex. ville avec 5 editorial mais 0 landing_ville → CTA "créer la landing".
//
// Source : `contentGenJob` filtré par status='published' + anchorVilleSlug=X
// (cohérent avec city-equity.ts). 3 queries en parallèle (Promise.all).

export async function getCoverageStats(rawVilleSlug: unknown): Promise<CoverageStats> {
  await requireAdmin();
  const villeSlug = VilleSlugSchema.parse(rawVilleSlug);

  const [coveredEditorial, coveredLandings, coveredRss] = await Promise.all([
    prisma.contentGenJob.count({
      where: {
        status: "published",
        anchorVilleSlug: villeSlug,
        contentType: { in: [...EDITORIAL_CONTENT_TYPES] },
      },
    }),
    prisma.contentGenJob.count({
      where: {
        status: "published",
        anchorVilleSlug: villeSlug,
        contentType: LANDING_CONTENT_TYPE,
      },
    }),
    prisma.contentGenJob.count({
      where: {
        status: "published",
        anchorVilleSlug: villeSlug,
        contentType: RSS_CONTENT_TYPE,
      },
    }),
  ]);

  return { coveredEditorial, coveredLandings, coveredRss };
}
