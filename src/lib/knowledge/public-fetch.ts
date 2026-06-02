/**
 * Helpers public-safe pour exposer la KB V4 sur `/connaissances`.
 *
 * P1-18 audit E2E NAV+CTA 2026-05-15 — la KB V4 est interne par défaut
 * (`audience=team`, `confidentiality=internal`). Pour exposer publiquement,
 * triple filtre strict côté server :
 *   - `status = 'published'`
 *   - `audience = 'public'`
 *   - `confidentiality = 'public'`
 * + `deletedAt IS NULL` (soft-delete)
 * + `publishedAt <= now()` (anti-leak de scheduled posts pas encore live)
 * + `embargoUntil IS NULL OR embargoUntil <= now()` (respect embargo)
 *
 * Si UN seul filtre est oublié → fuite drafts/team. Centralisé ici pour
 * que toute route publique appelle ces helpers et jamais `prisma.knowledgeEntry`
 * directement.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../prisma/generated/client";

const FR_LOCALE = "fr" as const;

/**
 * Filtre anti-leak public — SSOT. Toute lecture publique de la KB DOIT passer
 * par ce prédicat (status=published + audience=public + confidentiality=public
 * + deletedAt null + publishedAt <= now + embargo respecté). Centralisé ici
 * pour qu'un nouveau reader (ex. maillage KB→KB) ne puisse pas diverger et
 * fuiter des drafts/team. Cf. en-tête de fichier.
 */
export function publicEntryFilter(now: Date): Prisma.KnowledgeEntryWhereInput {
  return {
    status: "published",
    audience: "public",
    confidentiality: "public",
    deletedAt: null,
    publishedAt: { lte: now },
    OR: [{ embargoUntil: null }, { embargoUntil: { lte: now } }],
  };
}

interface PublicKbItem {
  slug: string;
  title: string;
  excerpt: string | null;
  type: string;
  publishedAt: Date | null;
  readingTime: number | null;
}

export async function fetchPublicKbList(opts: { take?: number } = {}): Promise<PublicKbItem[]> {
  const take = opts.take ?? 48;
  const now = new Date();
  try {
    const rows = await prisma.knowledgeEntry.findMany({
      where: publicEntryFilter(now),
      orderBy: [{ pinned: "desc" }, { featured: "desc" }, { publishedAt: "desc" }],
      take,
      select: {
        type: true,
        publishedAt: true,
        translations: {
          where: { locale: FR_LOCALE },
          select: { slug: true, title: true, excerpt: true, readingTime: true },
          take: 1,
        },
      },
    });
    return rows
      .map((row) => {
        const t = row.translations[0];
        if (!t || !t.slug) return null;
        return {
          slug: t.slug,
          title: t.title,
          excerpt: t.excerpt,
          type: String(row.type),
          publishedAt: row.publishedAt,
          readingTime: t.readingTime,
        };
      })
      .filter((x): x is PublicKbItem => x !== null);
  } catch {
    // Table absente bootstrap → fail-soft listing vide
    return [];
  }
}

interface PublicKbDetail {
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  type: string;
  publishedAt: Date | null;
  updatedAt: Date;
  readingTime: number | null;
  wordCount: number | null;
  metaTitle: string | null;
  metaDescription: string | null;
}

/**
 * Fetch detail KB par slug FR. Renvoie `null` si introuvable OU si l'entry
 * ne respecte pas le triple filtre public (drafts, team, etc).
 */
export async function fetchPublicKbBySlug(slugFr: string): Promise<PublicKbDetail | null> {
  const now = new Date();
  try {
    const translation = await prisma.knowledgeTranslation.findFirst({
      where: {
        locale: FR_LOCALE,
        slug: slugFr,
        // Triple filter sur l'entry parent — la garantie anti-leak (SSOT).
        entry: publicEntryFilter(now),
      },
      select: {
        slug: true,
        title: true,
        excerpt: true,
        body: true,
        metaTitle: true,
        metaDescription: true,
        readingTime: true,
        wordCount: true,
        updatedAt: true,
        entry: {
          select: { type: true, publishedAt: true },
        },
      },
    });
    if (!translation) return null;
    return {
      slug: translation.slug,
      title: translation.title,
      excerpt: translation.excerpt,
      body: translation.body,
      type: String(translation.entry.type),
      publishedAt: translation.entry.publishedAt,
      updatedAt: translation.updatedAt,
      readingTime: translation.readingTime,
      wordCount: translation.wordCount,
      metaTitle: translation.metaTitle,
      metaDescription: translation.metaDescription,
    };
  } catch {
    return null;
  }
}
