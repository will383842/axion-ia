/**
 * P1-17 (audit re-run 2026-05-15 AGENT 3) — Route Handler markdown brut.
 *
 * Sert le contenu d'un article factory en `text/markdown; charset=utf-8`
 * pour ingestion directe par Cursor / Claude Code / Perplexity Spaces /
 * ChatGPT plugins. Évite que les LLM doivent parser le HTML (coût
 * d'ingestion +30-50 % vs markdown brut + perte d'information structurée).
 *
 * URL canonique : `/api/markdown/{type}/{slug}`
 *   - type : "blog" | "actualites" | "cas-concrets" | "centre-aide" | "faq"
 *   - slug : slug FR canonique
 *
 * Découvrabilité : les pages HTML correspondantes émettent un
 * `<link rel="alternate" type="text/markdown" href="/api/markdown/...">`
 * pour que les LLM crawlers découvrent automatiquement le format MD.
 *
 * Output format :
 *   ```
 *   # <title>
 *
 *   > <excerpt or TL;DR>
 *
 *   <body markdown>
 *
 *   ---
 *
 *   Source : https://axion-ia.com/<locale>/<segment>/<slug>
 *   Last modified : <ISO 8601>
 *   ```
 *
 * Si `bodyText` est présent (Sprint 24 / C4 — Tiptap text plain rendu côté
 * worker), on l'utilise tel quel. Sinon, on prend `body` HTML brut (les
 * LLM tolèrent du HTML mais markdown brut reste préféré V2).
 *
 * Cache : public 1h fresh + 24h SWR + 7j stale-if-error (idem feeds RSS).
 * Sitemap : non listé (sert d'alternate format, pas de URL canonique).
 */

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";

interface RouteParams {
  params: Promise<{ type: string; slug: string }>;
}

const ALLOWED_TYPES = new Set(["blog", "actualites", "cas-concrets", "centre-aide", "faq"]);

interface MarkdownContent {
  readonly title: string;
  readonly excerpt: string | null;
  readonly body: string;
  readonly updatedAt: Date;
  readonly canonicalSegment: string;
}

/**
 * Stripe HTML tags pour produire un markdown best-effort. V1 garde du HTML
 * inline (les LLM le tolèrent). V2 utilisera `bodyJson` Tiptap rendu en
 * markdown via un helper dédié (Turndown ou remark-rehype-stringify).
 */
function htmlToMarkdownLite(html: string): string {
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gis, "\n# $1\n")
    .replace(/<h2[^>]*>(.*?)<\/h2>/gis, "\n## $1\n")
    .replace(/<h3[^>]*>(.*?)<\/h3>/gis, "\n### $1\n")
    .replace(/<h4[^>]*>(.*?)<\/h4>/gis, "\n#### $1\n")
    .replace(/<strong[^>]*>(.*?)<\/strong>/gis, "**$1**")
    .replace(/<b>(.*?)<\/b>/gis, "**$1**")
    .replace(/<em[^>]*>(.*?)<\/em>/gis, "*$1*")
    .replace(/<i>(.*?)<\/i>/gis, "*$1*")
    .replace(/<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gis, "[$2]($1)")
    .replace(/<li[^>]*>(.*?)<\/li>/gis, "- $1\n")
    .replace(/<\/?(ul|ol)[^>]*>/gi, "\n")
    .replace(/<p[^>]*>(.*?)<\/p>/gis, "\n$1\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "") // Strip remaining tags
    .replace(/\n{3,}/g, "\n\n") // Collapse triple newlines
    .trim();
}

async function loadContent(type: string, slug: string): Promise<MarkdownContent | null> {
  // Blog et actualites partagent le modèle Article (isNews flag).
  if (type === "blog" || type === "actualites") {
    const isNews = type === "actualites";
    const translation = await prisma.articleTranslation.findFirst({
      where: {
        locale: "fr",
        slug,
        article: { isNews, status: "published" },
      },
      include: { article: true },
    });
    if (!translation) return null;
    return {
      title: translation.title,
      excerpt: translation.excerpt,
      body: translation.bodyText ?? translation.body,
      updatedAt: translation.updatedAt,
      canonicalSegment: type,
    };
  }

  if (type === "cas-concrets") {
    const translation = await prisma.caseStudyTranslation.findFirst({
      where: {
        locale: "fr",
        slug,
        caseStudy: { status: "published" },
      },
      include: { caseStudy: true },
    });
    if (!translation) return null;
    return {
      title: translation.title,
      // CaseStudyTranslation peut ne pas avoir d'excerpt — fallback null
      excerpt: (translation as unknown as { excerpt?: string | null }).excerpt ?? null,
      body:
        (translation as unknown as { bodyText?: string | null }).bodyText ??
        (translation as unknown as { body?: string }).body ??
        "",
      updatedAt: translation.updatedAt,
      canonicalSegment: "cas-concrets",
    };
  }

  if (type === "centre-aide") {
    const translation = await prisma.helpArticleTranslation.findFirst({
      where: {
        locale: "fr",
        slug,
        helpArticle: { status: "published" },
      },
      include: { helpArticle: true },
    });
    if (!translation) return null;
    return {
      title: translation.title,
      excerpt: translation.excerpt,
      body: translation.bodyText ?? translation.body,
      updatedAt: translation.updatedAt,
      canonicalSegment: "centre-aide",
    };
  }

  if (type === "faq") {
    const faq = await prisma.fAQ.findFirst({
      where: { slug, status: "published" },
    });
    if (!faq) return null;
    return {
      title: faq.questionFr,
      excerpt: null,
      body: faq.answerFr,
      updatedAt: faq.updatedAt,
      canonicalSegment: "faq",
    };
  }

  return null;
}

function buildMarkdown(content: MarkdownContent, slug: string, type: string): string {
  const bodyMd = htmlToMarkdownLite(content.body);
  const canonicalUrl = `${SITE_URL}/fr/${content.canonicalSegment}/${slug}`;
  const lastMod = content.updatedAt.toISOString();
  const tldrLine = content.excerpt ? `> ${content.excerpt.trim()}\n\n` : "";
  return `# ${content.title}

${tldrLine}${bodyMd}

---

Source: ${canonicalUrl}
Last modified: ${lastMod}
Format: text/markdown (alternate). Canonical HTML at the Source URL above.
Type: ${type}
Provider: Axion-IA (France, EU)
`;
}

export async function GET(_req: NextRequest, ctx: RouteParams): Promise<Response> {
  const { type, slug } = await ctx.params;

  if (!ALLOWED_TYPES.has(type)) {
    return new Response(`Unknown content type: ${type}`, {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  try {
    const content = await loadContent(type, slug);
    if (!content) {
      return new Response(`Not found: /${type}/${slug}`, {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    const body = buildMarkdown(content, slug, type);
    return new Response(body, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control":
          "public, max-age=3600, stale-while-revalidate=86400, stale-if-error=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    // Fail-soft : DB indispo / P2021 table absente → 503 propre (CF servira
    // stale-if-error si déjà cached).
    console.error("[markdown-route]", err);
    return new Response("Markdown service temporarily unavailable", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
