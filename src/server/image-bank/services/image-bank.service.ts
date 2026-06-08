// Template : src/server/image-bank/services/image-bank.service.ts
//
// CRUD service principal pour ImageAsset + translations.
// Toutes les constantes (cache tags, gates SEO, defaults) viennent de
// `../constants` — SSOT du module.

import { revalidateTag } from "next/cache";
import type {
  ImageAsset,
  ImageAssetTranslation,
  Prisma,
} from "../../../../prisma/generated/client";

import { prisma } from "@/lib/prisma";
import { contentIndexNowQueue } from "@/server/queue/queues";

import {
  CACHE_TAGS,
  DEFAULT_COPYRIGHT_HOLDER,
  DEFAULT_LICENSE_TYPE,
  DEFAULT_LICENSE_URL,
  USAGE_COUNTER_FIELD,
  detectAiReferrerSource,
  type ImageBankLocale,
  type Orientation,
  type SourceType,
} from "../constants";
import { ensureAsciiSlug } from "../utils/slug";

export interface CreateImageInput {
  categoryId?: string;
  filePath: string;
  thumbnailPath?: string;
  avifPath?: string;
  lqipDataUri?: string;
  fileFormat?: string;
  fileSize: number;
  width: number;
  height: number;
  orientation: Orientation;
  aspectRatio?: string;
  srcset?: string;
  fileHash: string;
  slug: string;
  keywordsPrimary?: string;
  keywordsSecondary?: string[];
  targetCountries?: string[];
  targetLanguages?: string[];
  geoRegion?: string;
  geoPlacename?: string;
  geoPosition?: string;
  licenseType?: string;
  licenseUrl?: string;
  copyrightHolder?: string;
  photographerName?: string;
  photographerUrl?: string;
  sourceUrl?: string;
  sourceType?: SourceType;
  aiModel?: string;
  isAiGenerated?: boolean;
  module?: string;
  targetPersona?: string;
  targetCity?: string;
}

export interface CreateTranslationInput {
  imageId: string;
  languageCode: ImageBankLocale;
  title: string;
  slug: string;
  /** Alt text FR. Peut être vide "" — Claude Vision le génère via enrich worker. */
  alt: string;
  caption?: string;
  description?: string;
  metaTitle?: string;
  metaDescription?: string;
  ogTitle?: string;
  ogDescription?: string;
  aiSummary?: string;
  embedTitle?: string;
}

export class ImageBankService {
  /**
   * Crée un ImageAsset + 1 translation initiale dans une transaction.
   * Slug ASCII garanti (centralisé via `ensureAsciiSlug`).
   */
  async create(
    image: CreateImageInput,
    initialTranslation: Omit<CreateTranslationInput, "imageId">,
  ): Promise<ImageAsset & { translations: ImageAssetTranslation[] }> {
    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.imageAsset.create({
        data: {
          ...image,
          licenseType: image.licenseType ?? DEFAULT_LICENSE_TYPE,
          licenseUrl: image.licenseUrl ?? DEFAULT_LICENSE_URL,
          copyrightHolder: image.copyrightHolder ?? DEFAULT_COPYRIGHT_HOLDER,
          sourceType: image.sourceType ?? "local",
          targetLanguages: image.targetLanguages ?? [initialTranslation.languageCode],
          isActive: true,
          isFeatured: false,
          sortOrder: 0,
        },
      });

      const safeSlug = ensureAsciiSlug(initialTranslation.slug, initialTranslation.languageCode);
      const tr = await tx.imageAssetTranslation.create({
        data: {
          ...initialTranslation,
          slug: safeSlug,
          imageId: created.id,
          isPublished: false,
        },
      });

      return { ...created, translations: [tr] };
    });

    // Auto-enrichissement SEO/AEO/GEO FR via BullMQ (fire-and-forget, non-bloquant).
    // Déclenché pour toute image importée via admin ou API.
    // Le worker image-bank-enrich lit l'image depuis NEXT_PUBLIC_SITE_URL + filePath.
    void (async () => {
      try {
        const { enqueueImageBankEnrich } = await import("@/server/queue/queues");
        await enqueueImageBankEnrich({ imageId: result.id });
      } catch {
        // Non-bloquant — enrichissement relançable via scripts/enrich-seeded-images.mts
      }
    })();

    return result;
  }

  async update(id: string, data: Partial<Omit<CreateImageInput, "fileHash">>) {
    const updated = await prisma.imageAsset.update({ where: { id }, data });
    revalidateTag(CACHE_TAGS.root, "default");
    return updated;
  }

  async upsertTranslation(input: CreateTranslationInput) {
    const slug = ensureAsciiSlug(input.slug, input.languageCode);
    const tr = await prisma.imageAssetTranslation.upsert({
      where: {
        imageId_languageCode: {
          imageId: input.imageId,
          languageCode: input.languageCode,
        },
      },
      update: { ...input, slug },
      create: { ...input, slug, isPublished: false },
    });

    revalidateTag(CACHE_TAGS.image(slug), "default");
    revalidateTag(CACHE_TAGS.byLang(input.languageCode), "default");
    return tr;
  }

  async publish(imageId: string, lang: ImageBankLocale) {
    const tr = await prisma.imageAssetTranslation.update({
      where: { imageId_languageCode: { imageId, languageCode: lang } },
      data: { isPublished: true, publishedAt: new Date() },
    });

    await prisma.imageAsset.updateMany({
      where: { id: imageId, publishedAt: null },
      data: { publishedAt: new Date() },
    });

    revalidateTag(CACHE_TAGS.image(tr.slug), "default");
    revalidateTag(CACHE_TAGS.byLang(lang), "default");
    revalidateTag(CACHE_TAGS.galleryByLang(lang), "default");
    revalidateTag(CACHE_TAGS.sitemap, "default");

    // IndexNow — ping Bing/Yandex immédiatement après publication.
    // Fail silencieux : IndexNow down ne doit jamais bloquer une publication.
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
    const segment = lang === "fr" ? "galerie" : "gallery";
    const imageUrl = `${siteUrl}/${lang}/${segment}/${tr.slug}`;
    if (contentIndexNowQueue) {
      await contentIndexNowQueue
        .add(`indexnow-image-${tr.slug}`, { urls: [imageUrl], origin: "image-bank-publish" })
        .catch((err) => console.warn("[image-bank.publish] IndexNow enqueue failed:", err));
    }

    return tr;
  }

  async unpublish(imageId: string, lang: ImageBankLocale) {
    const tr = await prisma.imageAssetTranslation.update({
      where: { imageId_languageCode: { imageId, languageCode: lang } },
      data: { isPublished: false },
    });
    revalidateTag(CACHE_TAGS.image(tr.slug), "default");
    revalidateTag(CACHE_TAGS.byLang(lang), "default");
    revalidateTag(CACHE_TAGS.galleryByLang(lang), "default");
    revalidateTag(CACHE_TAGS.sitemap, "default");
    return tr;
  }

  /**
   * Soft delete + invalidation cache.
   * Hard delete fichiers/S3 par cron `retention-purge-worker` après 90 jours (RGPD).
   */
  async softDelete(imageId: string) {
    await prisma.imageAsset.update({
      where: { id: imageId },
      data: { deletedAt: new Date(), isActive: false },
    });
    await prisma.imageAssetTranslation.updateMany({
      where: { imageId },
      data: { isPublished: false },
    });
    revalidateTag(CACHE_TAGS.root, "default");
    revalidateTag(CACHE_TAGS.sitemap, "default");
  }

  async findBySlug(slug: string, lang: ImageBankLocale) {
    return prisma.imageAssetTranslation.findFirst({
      where: { slug, languageCode: lang, isPublished: true },
      include: {
        image: {
          include: {
            translations: { where: { isPublished: true } },
            category: { include: { translations: true } },
            tags: { include: { tag: { include: { translations: true } } } },
          },
        },
      },
    });
  }

  /**
   * Images liées pour la page détail `/galerie/[slug]`.
   *
   * Objectif SEO : casser le clustering « Page en double » de Google en
   * (1) différenciant chaque page détail par un set d'images voisines unique
   * et (2) créant du maillage interne entre pages galerie (chemins de crawl).
   * Priorité au même module métier ; complète avec les plus récentes/populaires
   * si le module ne fournit pas assez d'images. Exclut toujours l'image courante.
   */
  async findRelatedImages(opts: {
    imageId: string;
    lang: ImageBankLocale;
    module?: string | null;
    limit?: number;
  }): Promise<(ImageAsset & { translations: ImageAssetTranslation[] })[]> {
    const { imageId, lang, module, limit = 10 } = opts;

    const base: Prisma.ImageAssetWhereInput = {
      isActive: true,
      deletedAt: null,
      publishedAt: { not: null },
      translations: { some: { languageCode: lang, isPublished: true } },
    };
    const orderBy: Prisma.ImageAssetOrderByWithRelationInput[] = [
      { isFeatured: "desc" },
      { embedCount: "desc" },
      { publishedAt: "desc" },
    ];

    const sameModule = module
      ? await prisma.imageAsset.findMany({
          where: { ...base, module, id: { not: imageId } },
          include: { translations: { where: { languageCode: lang }, take: 1 } },
          orderBy,
          take: limit,
        })
      : [];

    if (sameModule.length >= limit) return sameModule;

    const excludeIds = [imageId, ...sameModule.map((i) => i.id)];
    const filler = await prisma.imageAsset.findMany({
      where: { ...base, id: { notIn: excludeIds } },
      include: { translations: { where: { languageCode: lang }, take: 1 } },
      orderBy,
      take: limit - sameModule.length,
    });

    return [...sameModule, ...filler];
  }

  async listGallery(opts: {
    lang: ImageBankLocale;
    page?: number;
    pageSize?: number;
    categorySlug?: string;
    orientation?: Orientation;
    country?: string;
    search?: string;
  }) {
    const { lang, page = 1, pageSize = 24, categorySlug, orientation, country, search } = opts;

    const where: Prisma.ImageAssetWhereInput = {
      isActive: true,
      deletedAt: null,
      publishedAt: { not: null },
      translations: { some: { languageCode: lang, isPublished: true } },
      ...(categorySlug && {
        category: {
          translations: { some: { languageCode: lang, slug: categorySlug } },
        },
      }),
      ...(orientation && { orientation }),
      ...(country && {
        targetCountries: {
          array_contains: country.toUpperCase() as Prisma.InputJsonValue,
        },
      }),
      ...(search && {
        translations: {
          some: {
            languageCode: lang,
            isPublished: true,
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { alt: { contains: search, mode: "insensitive" } },
              { caption: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      }),
    };

    const [items, total] = await Promise.all([
      prisma.imageAsset.findMany({
        where,
        include: { translations: { where: { languageCode: lang } } },
        orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.imageAsset.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Track usage (view, download, embed, share).
   *
   * Auto-détecte les AI referrers (Perplexity, ChatGPT Search, Claude.ai,
   * Bing Copilot, Gemini, etc.) et tag `countryCode` avec `AI-{source}` —
   * permet analytics AEO/GEO ROI (combien de visites viennent des LLMs).
   */
  async trackUsage(input: {
    imageId: string;
    action: keyof typeof USAGE_COUNTER_FIELD;
    referrerUrl?: string;
    userAgent?: string;
    ipHash?: string;
    language?: string;
    countryCode?: string;
  }) {
    // Auto-tag AI referrers (AEO/GEO analytics).
    // Si referrerUrl matche un agent IA, on remplace countryCode par "AI-{source}"
    // (perplexity, chatgpt, claude, copilot, gemini, you, mistral, poe, duck-assist).
    // Permet `SELECT count(*) WHERE country_code LIKE 'AI-%'` pour analytics.
    const aiSource = detectAiReferrerSource(input.referrerUrl);
    const enriched = aiSource ? { ...input, countryCode: `AI-${aiSource}` } : input;

    await prisma.imageUsageLog.create({ data: enriched });

    const counterField = USAGE_COUNTER_FIELD[input.action];
    if (counterField) {
      await prisma.imageAsset.update({
        where: { id: input.imageId },
        data: { [counterField]: { increment: 1 } },
      });
    }
  }
}

export const imageBankService = new ImageBankService();
