/**
 * Backfill des images hero Unsplash — logique partagée.
 *
 * Source de vérité unique appelée par :
 *   • le script CLI `src/scripts/backfill-hero-images.ts` (local / one-shot) ;
 *   • l'action serveur admin `hero-backfill.ts` (bouton console → tourne DANS
 *     le conteneur prod, accès Prisma direct, AUCUNE exposition réseau de la DB).
 *
 * Doctrine « Unsplash uniquement » (Will 2026-06-21/24) : on ne pose QUE des
 * photos Unsplash réelles (0 IA) + crédit photographe (CGU §6). On n'accepte
 * jamais une image-bank en sortie (`source === "unsplash"` filtré).
 *
 * Idempotent : un article déjà en Unsplash n'est jamais retouché (le filtre
 * `featuredImage` l'exclut). Re-lançable → sert de filet de garantie.
 *
 * Imports volontairement RELATIFS (et non `@/…`) pour rester résolvables aussi
 * bien sous Next que sous `tsx` (le script CLI n'a pas le résolveur d'alias).
 */

import { prisma } from "../../../lib/prisma";
import { selectHeroImage } from "./select-hero-image";
import type { Prisma } from "../../../../prisma/generated/client";

const KEYWORD_KEYS = ["primaryKeyword", "targetKeyword", "keyword", "resolvedKeyword"] as const;

export interface BackfillHeroOptions {
  /** true = simulation, aucune écriture en base. */
  dryRun?: boolean;
  /**
   * true = remplace AUSSI les anciens héros image-bank (chemin local, non `http`)
   * par une photo Unsplash ; préserve toujours les URLs Unsplash déjà posées.
   * false (défaut) = ne traite que les articles SANS image.
   */
  replaceBank?: boolean;
  /** Plafond d'articles traités sur cet appel (batch). Omis = tous. */
  limit?: number;
  /** Pause entre articles en ms (CLI = 1500 ; action = 0, le provider throttle). */
  throttleMs?: number;
  /** Callback de progression ligne par ligne (logs CLI). */
  onItem?: (line: string) => void;
}

export interface BackfillHeroItem {
  slug: string;
  action: "new" | "replace" | "skip";
  url?: string;
  photographer?: string | null;
  reason?: string;
}

export interface BackfillHeroResult {
  /** Nombre d'articles candidats traités sur cet appel (après plafond `limit`). */
  total: number;
  updated: number;
  skipped: number;
  items: BackfillHeroItem[];
}

/**
 * Compte les articles publiés restant à illustrer (sans déclencher Unsplash).
 * Sert au bouton admin pour afficher « N articles concernés » avant action.
 */
export async function countHeroBackfillTargets(replaceBank: boolean): Promise<number> {
  const where = buildWhere(replaceBank);
  return prisma.article.count({ where });
}

function buildWhere(replaceBank: boolean): Prisma.ArticleWhereInput {
  return replaceBank
    ? {
        status: "published",
        OR: [{ featuredImage: null }, { NOT: { featuredImage: { startsWith: "http" } } }],
      }
    : { status: "published", featuredImage: null };
}

export async function backfillHeroImages(
  opts: BackfillHeroOptions = {},
): Promise<BackfillHeroResult> {
  const { dryRun = false, replaceBank = false, limit, throttleMs = 0, onItem } = opts;

  const articles = await prisma.article.findMany({
    where: buildWhere(replaceBank),
    select: {
      id: true,
      featuredImage: true,
      generatedByJobId: true,
      mentionedCities: true,
      translations: { where: { locale: "fr" }, select: { slug: true, title: true }, take: 1 },
    },
    orderBy: { publishedAt: "asc" },
    ...(limit ? { take: limit } : {}),
  });

  const result: BackfillHeroResult = {
    total: articles.length,
    updated: 0,
    skipped: 0,
    items: [],
  };

  for (const a of articles) {
    const t = a.translations[0];
    const slug = t?.slug ?? a.id;
    let primaryKeyword = (t?.title ?? "").trim();
    let contentType = "blog_article";

    // Mot-clé : on préfère celui du job générateur (le plus pertinent
    // visuellement) ; fallback = titre FR de l'article.
    if (a.generatedByJobId) {
      const job = await prisma.contentGenJob
        .findUnique({
          where: { id: a.generatedByJobId },
          select: { inputPayload: true, contentType: true },
        })
        .catch(() => null);
      if (job?.contentType) contentType = job.contentType;
      const payload = (job?.inputPayload ?? {}) as Record<string, unknown>;
      const kw = KEYWORD_KEYS.map((k) => payload[k]).find(
        (v): v is string => typeof v === "string" && v.trim().length > 0,
      );
      if (kw) primaryKeyword = kw.trim();
    }

    if (!primaryKeyword) {
      result.skipped++;
      result.items.push({ slug, action: "skip", reason: "aucun mot-clé exploitable" });
      onItem?.(`SKIP ${slug} — aucun mot-clé exploitable`);
      continue;
    }

    // exactOptionalPropertyTypes : n'inclure anchorVilleSlug que s'il est défini.
    const anchorVilleSlug = a.mentionedCities?.[0];
    const hero = await selectHeroImage({
      jobId: a.generatedByJobId ?? `backfill-${a.id}`,
      contentType,
      primaryKeyword,
      ...(anchorVilleSlug ? { anchorVilleSlug } : {}),
    });

    // Doctrine : on n'accepte QUE de l'Unsplash (jamais image-bank ici).
    if (!hero || hero.source !== "unsplash") {
      result.skipped++;
      result.items.push({ slug, action: "skip", reason: "Unsplash sans résultat" });
      onItem?.(`SKIP ${slug} — Unsplash sans résultat (kw="${primaryKeyword}")`);
      continue;
    }

    const isReplace = Boolean(a.featuredImage);

    if (!dryRun) {
      await prisma.article.update({
        where: { id: a.id },
        data: {
          featuredImage: hero.url,
          featuredImageAltFr: hero.alt,
          ...(hero.photographerName
            ? {
                featuredImagePhotographerName: hero.photographerName,
                featuredImagePhotographerUrl: hero.photographerUrl,
              }
            : {}),
        },
      });
    }

    result.updated++;
    result.items.push({
      slug,
      action: isReplace ? "replace" : "new",
      url: hero.url,
      photographer: hero.photographerName,
    });
    onItem?.(
      `${dryRun ? "DRY " : "OK  "}${isReplace ? "REPLACE bank→unsplash" : "NEW"} ${slug} → ${hero.url}  (📷 ${hero.photographerName ?? "?"})`,
    );

    if (throttleMs > 0) await new Promise((r) => setTimeout(r, throttleMs));
  }

  return result;
}
