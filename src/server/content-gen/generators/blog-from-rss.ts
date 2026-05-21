/**
 * Generator — blog from RSS NewsArticle (Sprint 2 + 5 + Phase A BUG-5).
 *
 * Pipeline (Phase A BUG-5 2026-05-21) :
 * 1. KB retrieve top 8 chunks hybride (contexte interne Axion-IA)
 * 2. LLM génération article d'actualité (OpenAI → Anthropic fallback)
 *    - Ton : actualité réactive, pas conseil opérationnel pur
 *    - Citation source obligatoire (rssSourceName + rssItemLink)
 *    - L'article commente/contextualise l'actu RSS dans le prisme Axion-IA
 * 3. Quality loop (2 passes max, budget $0.10)
 * 4. Checks finaux (readability + SEO + doctrine + soft-404)
 * 5. Return GeneratorOutput avec indexationTier=tier_2_noindex_follow par défaut
 *
 * Différences vs blog-from-keywords :
 * - Input enrichi avec métadonnées RSS (titre item, résumé, source)
 * - SYSTEM_PROMPT dédié actualité + citation
 * - indexationTier : tier_2 si qualité ≥ 55, tier_3 sinon (jamais tier_1 direct
 *   pour RSS — politique éditoriale : modération humaine avant promotion)
 * - budget plus court ($0.10) — article plus court attendu (500-800 mots)
 *
 * Sprint 5 — wire NewsArticle JSON-LD : la factory `buildNewsArticleJsonLd`
 * (src/lib/seo-content-gen-factories.ts) est appelée par le worker de
 * publication via le helper exporté `enrichOutputWithNewsArticleJsonLd`.
 */

import {
  buildNewsArticleJsonLd,
  type NewsArticleJsonLdInput,
} from "@/lib/seo-content-gen-factories";
import { generate as routerGenerate } from "../providers/provider-router";
import { retrieve as kbRetrieve } from "../kb-client";
import { computeReadabilityFr } from "../quality/readability";
import { computeSeoScore } from "../quality/seo-score";
import { checkDoctrine } from "../quality/doctrine-check";
import { evaluateSoft404 } from "../quality/soft-404-gate";
import { sanitizeContentGenHtml } from "../shared/html-sanitizer";
import { escapeLlmInput } from "../shared/prompt-input-escape";
import { logStep } from "../shared/generation-log";
import type { Generator, GeneratorBaseInput, GeneratorOutput } from "./types";

const QUALITY_THRESHOLD = 55;
const MAX_QUALITY_ITERATIONS = 2;
const BUDGET_CAP_USD = 0.1;

const SYSTEM_PROMPT = `Tu es l'expert contenu d'Axion-IA, cabinet de conseil en IA pour TPE/PME/ETI françaises.
Produis un article d'actualité IA en français optimisé SEO/AEO 2026. Règles absolues :
- Style : RÉACTIF à l'actualité — explique l'info, donne le contexte, puis lie à l'expertise Axion-IA.
- Citation source obligatoire : mentionne le nom de la source dans le body (ex : "Selon [Source], ...").
- 100 % ancré Axion-IA dans au moins 1 section : ce que ça change pour les PME françaises + angle cabinet.
- 0 délai chiffré, 0 frais de déplacement intégrés dans le prix, 0 prix en dur.
- 0 numéro de téléphone : utiliser uniquement contact@axion-ia.com.
- Anti-doorway HCU 2024 : minimum 400 mots (article d'actualité = plus court, mais substantiel).
- 4 à 6 questions FAQ réelles avec réponses directes ≥ 2 lignes.
- Output JSON strict : { title, metaTitle, metaDescription, slug, directAnswer, bodyHtml, faq:[{q,a}], tags }`;

export const blogFromRssGenerator: Generator = {
  contentType: "blog_from_rss",

  async generate(input: GeneratorBaseInput): Promise<GeneratorOutput> {
    // Le topic = rssItemTitle si disponible, sinon primaryKeyword, sinon "actualité IA"
    const topic =
      input.rssItemTitle ?? input.primaryKeyword ?? "actualité intelligence artificielle";
    const safeTopic = escapeLlmInput(topic, { maxLen: 140 });
    const safeIntent = escapeLlmInput(input.targetSearchIntent, { maxLen: 30 });
    const safeAudienceSize = escapeLlmInput(input.targetAudienceSize ?? "PME", { maxLen: 30 });
    const sectorTagSlugs = input.kbSectorTagSlugs ?? [];

    // 1. KB retrieve — hybride FTS centré sur le topic RSS + contexte Axion-IA
    const kbChunks = await kbRetrieve({
      query: `Axion-IA ${safeTopic} ${sectorTagSlugs.join(" ")}`,
      locale: "fr",
      k: 6,
      filters: {
        audiences: ["public"],
        types: ["industry_use_case", "case_study", "methodology"],
      },
      ...(sectorTagSlugs.length > 0 ? { sectorTagSlugs } : {}),
      mode: "hybrid",
    });

    const kbContext = kbChunks
      .map((c) => `[${c.type}] ${c.title}\n${c.excerpt ?? ""}`)
      .join("\n\n");

    // Bloc citation source RSS injecté dans le prompt
    const rssSection =
      input.rssSourceName || input.rssItemSummary
        ? [
            `## Actualité source à commenter`,
            input.rssSourceName
              ? `Source : ${escapeLlmInput(input.rssSourceName, { maxLen: 80 })}`
              : "",
            input.rssItemLink ? `URL : ${escapeLlmInput(input.rssItemLink, { maxLen: 200 })}` : "",
            input.rssItemSummary
              ? `\nRésumé de l'actu :\n${escapeLlmInput(input.rssItemSummary, { maxLen: 800 })}`
              : "",
          ]
            .filter(Boolean)
            .join("\n")
        : "";

    // 2. Quality loop
    let iteration = 0;
    let accumulatedCostUsd = 0;
    let lastOutput = "";
    let parsed: {
      title: string;
      metaTitle: string;
      metaDescription: string;
      slug: string;
      directAnswer: string;
      bodyHtml: string;
      faq: ReadonlyArray<{ q: string; a: string }>;
      tags: ReadonlyArray<string>;
    } | null = null;
    let lastTokensInput = 0;
    let lastTokensOutput = 0;
    let lastCitations: ReadonlyArray<{ url: string; title: string; publishedAt?: string }> = [];
    let prevFeedback = input.improvementFeedback ?? "";

    while (iteration < MAX_QUALITY_ITERATIONS) {
      const feedbackSection = prevFeedback
        ? `\n\n## Retour qualité passe précédente\n${prevFeedback}\nCorrige impérativement ces points.`
        : "";

      const userPrompt = `Génère un article d'actualité Axion-IA sur le sujet : "${safeTopic}".
Intent : ${safeIntent}.
Audience cible : ${safeAudienceSize}.
${rssSection ? `\n${rssSection}\n` : ""}
## Contexte Axion-IA — sources internes (à citer comme expertise)
${kbContext}
${feedbackSection}

## Output attendu (JSON)
{ title, metaTitle, metaDescription, slug, directAnswer, bodyHtml, faq:[{q,a}×5], tags }`;

      const llmResult = await routerGenerate({
        jobId: input.jobId,
        contentType: "blog_from_rss",
        role: "text",
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        maxTokens: 3072,
        temperature: iteration === 0 ? 0.7 : 0.5,
      });

      accumulatedCostUsd += llmResult.costUsd;
      lastTokensInput = llmResult.tokensInput;
      lastTokensOutput = llmResult.tokensOutput;
      lastCitations = llmResult.citations ?? [];
      lastOutput = llmResult.output;
      iteration++;

      try {
        parsed = JSON.parse(lastOutput);
      } catch {
        prevFeedback =
          "La réponse précédente n'était pas du JSON valide. Retourne UNIQUEMENT un objet JSON valide, sans balise markdown.";
        if (accumulatedCostUsd >= BUDGET_CAP_USD) break;
        continue;
      }

      if (!parsed) continue;

      const bodyText = (parsed.bodyHtml ?? "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const wordCount = bodyText.split(/\s+/).filter((w) => w.length > 0).length;
      const _bh = parsed.bodyHtml ?? "";
      const internalLinkCount =
        (_bh.match(/<a\b[^>]*href="\/[^"]*"/gi) ?? []).length +
        (_bh.match(/\[.*?\]\(\/[^)]+\)/g) ?? []).length;
      const readability = computeReadabilityFr(bodyText);
      const seo = computeSeoScore({
        title: parsed.title ?? "",
        metaDescription: parsed.metaDescription ?? "",
        bodyHtml: parsed.bodyHtml ?? "",
        bodyText,
        directAnswer: parsed.directAnswer,
        faqCount: (parsed.faq ?? []).length,
        internalLinkCount,
        primaryKeyword: topic,
        searchIntent: input.targetSearchIntent,
        contentKind: "article",
        hasPersonManonJsonLd: false,
      });

      const doctrine = await checkDoctrine(bodyText);
      const qualityScore = doctrine.passed
        ? Math.round((seo.score + readability.score) / 2)
        : Math.max(0, Math.round((seo.score + readability.score) / 2) - 30);

      if (qualityScore >= QUALITY_THRESHOLD) {
        await logStep(
          input.jobId,
          "quality_loop_pass",
          `Pass ${iteration} — score ${qualityScore}/100, mots ${wordCount}, cost $${accumulatedCostUsd.toFixed(4)}`,
          { qualityScore, seoScore: seo.score, readabilityScore: readability.score, wordCount },
        );
        break;
      }

      if (accumulatedCostUsd >= BUDGET_CAP_USD) {
        await logStep(
          input.jobId,
          "quality_loop_budget_cap_reached",
          `Budget cap $${BUDGET_CAP_USD} atteint après ${iteration} passes — score ${qualityScore}/100`,
          { qualityScore, accumulatedCostUsd, iteration },
        );
        break;
      }

      if (iteration >= MAX_QUALITY_ITERATIONS) break;

      const issues: string[] = [];
      if (seo.score < 55) issues.push("FAQ manquante + directAnswer trop court");
      if (readability.score < 55) issues.push("phrases trop longues + sous-titres H2 insuffisants");
      if (!doctrine.passed) {
        const violations = doctrine.blockingViolations.map((v) => v.pattern).join(", ");
        issues.push(`violations doctrine : ${violations}`);
      }
      if (wordCount < 400) issues.push(`contenu trop court (${wordCount} mots, minimum 400)`);
      if (
        input.rssSourceName &&
        !bodyText.toLowerCase().includes(input.rssSourceName.toLowerCase())
      ) {
        issues.push(`citation source "${input.rssSourceName}" manquante dans le body`);
      }
      prevFeedback = `Score ${qualityScore}/100 insuffisant. Améliore : ${issues.join(" ; ")}.`;
    }

    if (!parsed) {
      throw new Error("blog-from-rss: aucun output valide après quality loop");
    }

    parsed = { ...parsed, bodyHtml: sanitizeContentGenHtml(parsed.bodyHtml ?? "") };

    const bodyText = parsed.bodyHtml
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const wordCount = bodyText.split(/\s+/).filter((w) => w.length > 0).length;
    const readingTimeMinutes = Math.max(1, Math.round(wordCount / 200));

    const finalInternalLinkCount =
      (parsed.bodyHtml.match(/<a\b[^>]*href="\/[^"]*"/gi) ?? []).length +
      (parsed.bodyHtml.match(/\[.*?\]\(\/[^)]+\)/g) ?? []).length;
    const readability = computeReadabilityFr(bodyText);
    const doctrine = await checkDoctrine(bodyText);
    const seo = computeSeoScore({
      title: parsed.title ?? "",
      metaDescription: parsed.metaDescription ?? "",
      bodyHtml: parsed.bodyHtml,
      bodyText,
      directAnswer: parsed.directAnswer,
      faqCount: (parsed.faq ?? []).length,
      internalLinkCount: finalInternalLinkCount,
      primaryKeyword: topic,
      searchIntent: input.targetSearchIntent,
      contentKind: "article",
      hasPersonManonJsonLd: false,
    });

    const qualityScore = doctrine.passed
      ? Math.round((seo.score + readability.score) / 2)
      : Math.max(0, Math.round((seo.score + readability.score) / 2) - 30);

    const soft404 = evaluateSoft404({
      wordCount,
      hasFullLocalBusinessJsonLd: false,
      hasLocalCase: false,
      faqCount: (parsed.faq ?? []).length,
    });

    // Politique RSS : jamais tier_1 direct — modération humaine requise avant
    // promotion. tier_2_noindex_follow max si qualité suffisante.
    const indexationTier: GeneratorOutput["indexationTier"] = soft404.isSoft404
      ? "tier_3_noindex_nofollow"
      : doctrine.passed && qualityScore >= 55
        ? "tier_2_noindex_follow"
        : "tier_3_noindex_nofollow";

    return {
      title: parsed.title ?? "",
      metaTitle: parsed.metaTitle ?? "",
      metaDescription: parsed.metaDescription ?? "",
      slug: parsed.slug ?? "",
      directAnswer: parsed.directAnswer ?? "",
      bodyHtml: parsed.bodyHtml,
      bodyText,
      faq: (parsed.faq ?? []).map((q) => ({ question: q.q, answer: q.a })),
      tags: parsed.tags ?? [],
      indexationTier,
      qualityScore,
      seoScore: seo.score,
      readabilityScore: readability.score,
      wordCount,
      readingTimeMinutes,
      totalTokens: lastTokensInput + lastTokensOutput,
      totalCostUsd: accumulatedCostUsd,
      citations: lastCitations,
    };
  },
};

/**
 * Helper appelé par `content-publish-worker` (Sprint 5) après publication
 * tier-1 d'un job `blog_from_rss` : construit le bloc JSON-LD NewsArticle à
 * injecter dans `<head>` de la page publiée. Le worker stocke ce JSON dans
 * `Article.jsonLd` pour rendu par `generateMetadata()` de la route.
 */
export function enrichOutputWithNewsArticleJsonLd(input: {
  readonly title: string;
  readonly metaDescription: string;
  readonly slug: string;
  readonly heroImageUrl?: string;
  readonly publishedAt: Date | string;
  readonly modifiedAt?: Date | string;
  readonly rssSourceUrl: string;
  readonly rssSourceName: string;
  readonly dateline?: string;
  readonly printSection?: string;
  readonly wordCount?: number;
  readonly readingTimeMinutes?: number;
}): Record<string, unknown> {
  const newsInput: NewsArticleJsonLdInput = {
    title: input.title,
    description: input.metaDescription,
    slug: input.slug,
    locale: "fr",
    publishedAt: input.publishedAt,
    updatedAt: input.modifiedAt ?? input.publishedAt,
    sourceUrl: input.rssSourceUrl,
    sourceName: input.rssSourceName,
    ...(input.heroImageUrl ? { imageUrl: input.heroImageUrl } : {}),
    ...(input.dateline ? { dateline: input.dateline } : {}),
    ...(input.printSection ? { printSection: input.printSection } : {}),
    ...(input.wordCount !== undefined ? { wordCount: input.wordCount } : {}),
    ...(input.readingTimeMinutes !== undefined
      ? { readingTimeMinutes: input.readingTimeMinutes }
      : {}),
  };
  return buildNewsArticleJsonLd(newsInput);
}
