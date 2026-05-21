/**
 * Content Generator — Assign Hero Image depuis l'image-bank (B.6 P0-4 P1.5).
 *
 * Doctrine [[feedback_no_dalle_images]] : 0 image IA generative. Toutes les
 * images proviennent de l'image-bank curee par Will (ImageAsset.isAiGenerated
 * = false strict).
 *
 * Algorithme de scoring (sans embeddings — simple ranking suffisant pour V1) :
 *   +10  module match (audit/interventions-formations/...)
 *   +5   targetCity match (anchorVilleSlug)
 *   +5   targetRegion match (anchorRegionSlug)
 *   +3   keywordsPrimary contient un token du keyword
 *   +2   targetSector match (kbSectorTagSlugs)
 *   +1   has translation in target language (FR)
 *   +0.5 isFeatured
 *
 * Filtres durs :
 *   - isActive = true
 *   - isAiGenerated = false (doctrine)
 *   - deletedAt IS NULL
 *
 * Si aucune image match → retourne null + le worker logue `pending_image`.
 * Pas de fallback Unsplash (doctrine : on prefere `null` qu'un fallback IA).
 */

import { prisma } from "@/lib/prisma";

// ── Mapping vertical (ServiceSector) → ImageAsset.module ────────────────────
//
// L'image-bank stocke le module au format KeywordModule slug (audit,
// interventions-formations, ...). Le worker fournit vertical au format
// ServiceSector enum (audits, interventions_formations, ...). On mappe.

const VERTICAL_TO_IMAGE_MODULE: Record<string, string> = {
  audits: "audit",
  interventions_formations: "interventions-formations",
  implementations: "implementation",
  un_a_un: "coaching-1-to-1",
  sites_web_augmentes: "codage-developpement",
  // transversal/aucun → on n'applique pas de filtre module.
};

export interface AssignHeroImageInput {
  readonly vertical?: string;
  readonly primaryKeyword?: string;
  readonly anchorVilleSlug?: string;
  readonly anchorRegionSlug?: string;
  readonly kbSectorTagSlugs?: ReadonlyArray<string>;
}

export interface AssignedHeroImage {
  readonly assetId: string;
  readonly filePath: string;
  readonly thumbnailPath: string | null;
  readonly avifPath: string | null;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
  readonly slug: string;
}

interface ScoredAsset {
  readonly id: string;
  readonly filePath: string;
  readonly thumbnailPath: string | null;
  readonly avifPath: string | null;
  readonly width: number;
  readonly height: number;
  readonly slug: string;
  readonly keywordsPrimary: string | null;
  readonly module: string | null;
  readonly targetCity: string | null;
  readonly targetRegion: string | null;
  readonly targetSector: string | null;
  readonly isFeatured: boolean;
  readonly alt: string;
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

function scoreAsset(asset: ScoredAsset, input: AssignHeroImageInput): number {
  let score = 0;

  const imageModule = input.vertical ? VERTICAL_TO_IMAGE_MODULE[input.vertical] : undefined;
  if (imageModule && asset.module === imageModule) score += 10;

  if (input.anchorVilleSlug && asset.targetCity === input.anchorVilleSlug) score += 5;
  if (input.anchorRegionSlug && asset.targetRegion === input.anchorRegionSlug) score += 5;

  if (input.primaryKeyword && asset.keywordsPrimary) {
    const kwTokens = new Set(tokenize(input.primaryKeyword));
    const imgTokens = new Set(tokenize(asset.keywordsPrimary));
    let overlap = 0;
    for (const t of kwTokens) if (imgTokens.has(t)) overlap += 1;
    if (overlap > 0) score += 3;
  }

  if (input.kbSectorTagSlugs && input.kbSectorTagSlugs.length > 0 && asset.targetSector) {
    if (input.kbSectorTagSlugs.includes(asset.targetSector)) score += 2;
  }

  if (asset.isFeatured) score += 0.5;

  return score;
}

/**
 * Selectionne la meilleure image-bank image pour un article.
 *
 * Retourne `null` si :
 *  - 0 image active + non-IA disponible dans la verticale demandee,
 *  - DB unavailable (build SSG, tests sans DB) : ne throw pas, retourne null.
 *
 * Le worker logue `pending_image` quand `null` est retourne — la publication
 * peut continuer sans hero (Article.featuredImage = null) ou Will assigne
 * manuellement via admin.
 */
export async function assignHeroImage(
  input: AssignHeroImageInput,
): Promise<AssignedHeroImage | null> {
  try {
    const imageModule = input.vertical ? VERTICAL_TO_IMAGE_MODULE[input.vertical] : undefined;

    // Pre-filtre DB : si on a un module, on filtre dessus (sinon on ramene
    // toutes les images actives non-IA — limit 100 pour eviter scan large).
    const where: Record<string, unknown> = {
      isActive: true,
      isAiGenerated: false,
      deletedAt: null,
    };
    if (imageModule) where["module"] = imageModule;

    const candidates = await prisma.imageAsset.findMany({
      where,
      select: {
        id: true,
        filePath: true,
        thumbnailPath: true,
        avifPath: true,
        width: true,
        height: true,
        slug: true,
        keywordsPrimary: true,
        module: true,
        targetCity: true,
        targetRegion: true,
        targetSector: true,
        isFeatured: true,
        translations: {
          where: { languageCode: "fr" },
          select: { alt: true, title: true },
          take: 1,
        },
      },
      take: 100,
    });

    if (candidates.length === 0) return null;

    const scored = candidates.map((c) => {
      const alt = c.translations[0]?.alt ?? c.translations[0]?.title ?? c.slug.replace(/-/g, " ");
      const asset: ScoredAsset = {
        id: c.id,
        filePath: c.filePath,
        thumbnailPath: c.thumbnailPath,
        avifPath: c.avifPath,
        width: c.width,
        height: c.height,
        slug: c.slug,
        keywordsPrimary: c.keywordsPrimary,
        module: c.module,
        targetCity: c.targetCity,
        targetRegion: c.targetRegion,
        targetSector: c.targetSector,
        isFeatured: c.isFeatured,
        alt,
      };
      return { asset, score: scoreAsset(asset, input) };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (!best || best.score <= 0) return null;

    const a = best.asset;
    return {
      assetId: a.id,
      filePath: a.filePath,
      thumbnailPath: a.thumbnailPath,
      avifPath: a.avifPath,
      width: a.width,
      height: a.height,
      alt: a.alt,
      slug: a.slug,
    };
  } catch {
    // DB unavailable (build SSG, tests) → null silent. Worker logue pending_image.
    return null;
  }
}

/**
 * Test-only helper : score un asset isolement (utilise par les specs).
 */
export const __testInternals = { scoreAsset, VERTICAL_TO_IMAGE_MODULE };
