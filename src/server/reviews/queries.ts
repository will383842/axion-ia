// Couche de lecture publique des avis clients.
//
// ⚠️ TOUTES les requêtes filtrent `status: "published"` → un avis non modéré
// n'apparaît jamais côté public ni dans l'indexation.
// ⚠️ Stub-aware : au build GH Actions (DATABASE_URL=stub.invalid), retourne des
// valeurs vides sans call DB (contrat ADR 0026). L'ISR repeuple en prod.
// ⚠️ Ne sélectionne JAMAIS les champs RGPD (email chiffré, ipHash, storagePath).

import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma, ServiceSector } from "../../../prisma/generated/client";
import { RATING_BEST } from "@/lib/reviews/config";

function isStubBuild(): boolean {
  return process.env.DATABASE_URL?.includes("stub.invalid") ?? false;
}

/** Champs exposables publiquement (jamais de PII). */
export const PUBLIC_REVIEW_SELECT = {
  id: true,
  slug: true,
  authorFirstName: true,
  authorLastInitial: true,
  companyName: true,
  clientSector: true,
  citySlug: true,
  cityName: true,
  departmentCode: true,
  regionSlug: true,
  serviceLine: true,
  rating: true,
  title: true,
  comment: true,
  photoKind: true,
  photoUrl: true,
  photoAlt: true,
  replyBody: true,
  repliedAt: true,
  isVerified: true,
  featured: true,
  publishedAt: true,
  createdAt: true,
} satisfies Prisma.CustomerReviewSelect;

export type PublicReview = Prisma.CustomerReviewGetPayload<{
  select: typeof PUBLIC_REVIEW_SELECT;
}>;

export type ReviewSort = "recent" | "rating_desc" | "rating_asc" | "featured";

export interface ReviewFilters {
  rating?: number;
  serviceLine?: ServiceSector;
  clientSector?: string;
  citySlug?: string;
  departmentCode?: string;
  regionSlug?: string;
  verifiedOnly?: boolean;
  withPhoto?: boolean;
  withReply?: boolean;
  search?: string;
  sort?: ReviewSort;
  page?: number;
  pageSize?: number;
}

function buildWhere(filters: ReviewFilters): Prisma.CustomerReviewWhereInput {
  const where: Prisma.CustomerReviewWhereInput = { status: "published" };
  if (filters.rating) where.rating = filters.rating;
  if (filters.serviceLine) where.serviceLine = filters.serviceLine;
  if (filters.clientSector) where.clientSector = filters.clientSector;
  if (filters.citySlug) where.citySlug = filters.citySlug;
  if (filters.departmentCode) where.departmentCode = filters.departmentCode;
  if (filters.regionSlug) where.regionSlug = filters.regionSlug;
  if (filters.verifiedOnly) where.isVerified = true;
  if (filters.withPhoto) where.photoUrl = { not: null };
  if (filters.withReply) where.replyBody = { not: null };
  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim().slice(0, 80);
    where.OR = [
      { comment: { contains: q, mode: "insensitive" } },
      { title: { contains: q, mode: "insensitive" } },
      { companyName: { contains: q, mode: "insensitive" } },
    ];
  }
  return where;
}

function orderByFor(sort: ReviewSort | undefined): Prisma.CustomerReviewOrderByWithRelationInput[] {
  switch (sort) {
    case "rating_desc":
      return [{ rating: "desc" }, { publishedAt: "desc" }];
    case "rating_asc":
      return [{ rating: "asc" }, { publishedAt: "desc" }];
    case "featured":
      return [{ featured: "desc" }, { publishedAt: "desc" }];
    case "recent":
    default:
      return [{ publishedAt: "desc" }, { createdAt: "desc" }];
  }
}

export interface PublishedReviewsResult {
  items: PublicReview[];
  total: number;
  page: number;
  pageSize: number;
}

/** Liste paginée d'avis publiés selon des filtres. Stub-aware. */
export async function getPublishedReviews(
  filters: ReviewFilters = {},
): Promise<PublishedReviewsResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, filters.pageSize ?? 12));
  if (isStubBuild()) return { items: [], total: 0, page, pageSize };

  const where = buildWhere(filters);
  const [total, items] = await Promise.all([
    prisma.customerReview.count({ where }),
    prisma.customerReview.findMany({
      where,
      orderBy: orderByFor(filters.sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: PUBLIC_REVIEW_SELECT,
    }),
  ]);
  return { items, total, page, pageSize };
}

/** Un avis publié par slug (null si absent ou non publié). Stub-aware. */
export async function getReviewBySlug(slug: string): Promise<PublicReview | null> {
  if (isStubBuild()) return null;
  return prisma.customerReview.findFirst({
    where: { slug, status: "published" },
    select: PUBLIC_REVIEW_SELECT,
  });
}

/** Avis liés (même service > même secteur > même ville), hors l'avis courant. */
export async function getRelatedReviews(review: PublicReview, limit = 3): Promise<PublicReview[]> {
  if (isStubBuild()) return [];
  const or: Prisma.CustomerReviewWhereInput[] = [];
  if (review.serviceLine) or.push({ serviceLine: review.serviceLine });
  if (review.clientSector) or.push({ clientSector: review.clientSector });
  if (review.regionSlug) or.push({ regionSlug: review.regionSlug });
  if (or.length === 0) return [];
  return prisma.customerReview.findMany({
    where: { status: "published", id: { not: review.id }, OR: or },
    orderBy: [{ featured: "desc" }, { publishedAt: "desc" }],
    take: limit,
    select: PUBLIC_REVIEW_SELECT,
  });
}

export interface AggregateRatingData {
  ratingValue: number;
  reviewCount: number;
  /** Répartition des notes 1★→5★. */
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>;
  bestRating: number;
}

/** Portée d'un agrégat (global si vide, ou par service/secteur/ville/région). */
export type AggregateScope = Pick<
  ReviewFilters,
  "serviceLine" | "clientSector" | "citySlug" | "departmentCode" | "regionSlug"
>;

/** Note agrégée + répartition sur les avis publiés. null si aucun avis. Stub-aware. */
export async function getAggregateRating(
  scope: AggregateScope = {},
): Promise<AggregateRatingData | null> {
  if (isStubBuild()) return null;
  const where = buildWhere(scope);
  const [agg, grouped] = await Promise.all([
    prisma.customerReview.aggregate({ where, _avg: { rating: true }, _count: { _all: true } }),
    prisma.customerReview.groupBy({ by: ["rating"], where, _count: { _all: true } }),
  ]);
  const reviewCount = agg._count._all;
  if (reviewCount === 0 || agg._avg.rating == null) return null;
  const breakdown: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const g of grouped) {
    const r = g.rating as 1 | 2 | 3 | 4 | 5;
    if (r >= 1 && r <= 5) breakdown[r] = g._count._all;
  }
  return {
    ratingValue: Math.round(agg._avg.rating * 10) / 10,
    reviewCount,
    breakdown,
    bestRating: RATING_BEST,
  };
}

export interface ReviewFacet {
  key: string;
  count: number;
}

/** Compte d'avis publiés par valeur d'une facette (ville / secteur / service / dept / région). */
async function facetCounts(
  field: "citySlug" | "clientSector" | "serviceLine" | "departmentCode" | "regionSlug",
): Promise<ReviewFacet[]> {
  if (isStubBuild()) return [];
  const grouped = await prisma.customerReview.groupBy({
    by: [field],
    where: { status: "published", [field]: { not: null } },
    _count: { _all: true },
  });
  return grouped
    .map((g) => ({ key: (g[field] ?? "") as string, count: g._count._all }))
    .filter((f) => f.key)
    .sort((a, b) => b.count - a.count);
}

export const getCityFacets = () => facetCounts("citySlug");
export const getSectorFacets = () => facetCounts("clientSector");
export const getServiceFacets = () => facetCounts("serviceLine");
export const getDepartmentFacets = () => facetCounts("departmentCode");
