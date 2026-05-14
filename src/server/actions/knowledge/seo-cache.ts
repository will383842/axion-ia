/**
 * KB V4 (Sprint KB-14) — Service cache SEO/AEO/GEO.
 *
 * Hook appelé après publish/republish d'une traduction :
 * - Compute (seoTitle, seoDescription, faqQA, geoEntities) via seo-generator stub V1
 * - Upsert dans `knowledge_seo_cache` (unique sur translationId + provider + version)
 * - Si KnowledgeTranslation.metaTitle/metaDescription vides : copie depuis cache
 *
 * Idempotent : ré-appel sur même traduction = upsert.
 */

"use server";

import { prisma } from "@/lib/prisma";
import {
  detectGeoEntities,
  extractFaqQA,
  generateSeoMeta,
  SEO_PROVIDER_STUB,
  SEO_PROVIDER_VERSION,
} from "@/lib/knowledge/seo-generator";
import type { Prisma } from "../../../../prisma/generated/client";

export interface SeoCacheResult {
  readonly translationId: string;
  readonly cacheId: string;
  readonly seoTitle: string;
  readonly seoDescription: string;
  readonly faqCount: number;
  readonly geoCount: number;
}

/**
 * Régénère et upsert le cache SEO/AEO/GEO pour une traduction.
 *
 * @param translationId UUID translation KB
 */
export async function refreshSeoCacheForTranslation(
  translationId: string,
): Promise<SeoCacheResult> {
  const translation = await prisma.knowledgeTranslation.findUnique({
    where: { id: translationId },
    select: {
      id: true,
      locale: true,
      title: true,
      excerpt: true,
      bodyText: true,
      metaTitle: true,
      metaDescription: true,
    },
  });
  if (!translation) {
    throw new Error(`Translation ${translationId} introuvable`);
  }

  const seoMeta = generateSeoMeta({
    title: translation.title,
    excerpt: translation.excerpt,
    bodyText: translation.bodyText,
    locale: translation.locale,
  });

  const faqQA = extractFaqQA(translation.bodyText, translation.title);
  const geoEntities = detectGeoEntities(translation.bodyText, translation.title);

  // Upsert cache (translationId + provider + version unique)
  const cache = await prisma.knowledgeSeoCache.upsert({
    where: {
      translationId_provider_providerVersion: {
        translationId: translation.id,
        provider: SEO_PROVIDER_STUB,
        providerVersion: SEO_PROVIDER_VERSION,
      },
    },
    create: {
      translationId: translation.id,
      locale: translation.locale,
      provider: SEO_PROVIDER_STUB,
      providerVersion: SEO_PROVIDER_VERSION,
      seoTitle: seoMeta.seoTitle,
      seoDescription: seoMeta.seoDescription,
      aeoFaqJson: faqQA as unknown as Prisma.InputJsonValue,
      geoEntitiesJson: geoEntities as unknown as Prisma.InputJsonValue,
      costCents: 0, // stub V1 = gratuit
    },
    update: {
      seoTitle: seoMeta.seoTitle,
      seoDescription: seoMeta.seoDescription,
      aeoFaqJson: faqQA as unknown as Prisma.InputJsonValue,
      geoEntitiesJson: geoEntities as unknown as Prisma.InputJsonValue,
      generatedAt: new Date(),
    },
    select: { id: true },
  });

  // Si metaTitle/metaDescription vides, copie depuis cache (best effort)
  const updates: Prisma.KnowledgeTranslationUpdateInput = {};
  if (!translation.metaTitle || translation.metaTitle.trim().length === 0) {
    updates.metaTitle = seoMeta.seoTitle.slice(0, 70);
  }
  if (!translation.metaDescription || translation.metaDescription.trim().length === 0) {
    updates.metaDescription = seoMeta.seoDescription.slice(0, 160);
  }
  if (Object.keys(updates).length > 0) {
    await prisma.knowledgeTranslation.update({
      where: { id: translation.id },
      data: updates,
    });
  }

  return {
    translationId: translation.id,
    cacheId: cache.id,
    seoTitle: seoMeta.seoTitle,
    seoDescription: seoMeta.seoDescription,
    faqCount: faqQA.length,
    geoCount: geoEntities.length,
  };
}

/**
 * Récupère le cache pour render JSON-LD côté page publique.
 * Retourne null si pas de cache (page publique fallback meta brutes).
 */
export async function getSeoCacheForTranslation(translationId: string) {
  return prisma.knowledgeSeoCache.findFirst({
    where: {
      translationId,
      provider: SEO_PROVIDER_STUB,
      providerVersion: SEO_PROVIDER_VERSION,
    },
    select: {
      seoTitle: true,
      seoDescription: true,
      aeoFaqJson: true,
      geoEntitiesJson: true,
      generatedAt: true,
    },
  });
}
