/**
 * Generator — blog from RSS NewsArticle (Sprint 2 + 5 + Phase A BUG-5).
 *
 * Pipeline (Phase A BUG-5 2026-05-21 + Sprint Correctif P0 V-06 2026-05-22) :
 * 1. KB retrieve top 8 chunks hybride (contexte interne Axion-IA)
 * 2. LLM génération article d'actualité (OpenAI → Anthropic fallback)
 *    - Ton : actualité réactive, pas conseil opérationnel pur
 *    - L'article RÉ-ÉCRIT l'info dans le prisme Axion-IA sans citer la source RSS
 *      dans le body visible (directive Will : "ne pas dire la source").
 *    - La traçabilité source reste préservée côté machine via NewsArticle
 *      JSON-LD `isBasedOn` (AI Act art. 50 + GEO/AEO providers).
 * 3. Quality loop (2 passes max, budget $0.10)
 *    - Anti-plagiat RSS source : `checkRssSimilarity(body, rssItemSummary, 0.10)`
 *      bloque toute régurgitation directe du résumé (V-06 P0b).
 * 4. Checks finaux (readability + SEO + doctrine + soft-404)
 * 5. Return GeneratorOutput avec indexationTier=tier_2_noindex_follow par défaut
 *
 * Différences vs blog-from-keywords :
 * - Input enrichi avec métadonnées RSS (titre item, résumé, source)
 * - SYSTEM_PROMPT dédié actualité, sans citation visible
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
import { hashPrompt } from "../provenance/provenance-logger";
import { retrieve as kbRetrieve } from "../kb-client";
import { computeReadabilityFr } from "../quality/readability";
import { computeSeoScore } from "../quality/seo-score";
import { checkDoctrine } from "../quality/doctrine-check";
import { evaluateSoft404 } from "../quality/soft-404-gate";
import { checkRssSimilarity } from "../quality/plagiarism";
import { sanitizeContentGenHtml } from "../shared/html-sanitizer";
import { escapeLlmInput } from "../shared/prompt-input-escape";
import { logStep } from "../shared/generation-log";
import type { Generator, GeneratorBaseInput, GeneratorOutput } from "./types";
import { getBrandVoiceForContentType } from "../brand/brand-voice";
import { getGlossaryContext } from "../brand/glossary-context";
import { injectInternalLinks } from "../links/internal-link-catalog";
import { injectExternalLinks } from "../links/external-links-injector";
import { getIntentPromptAddendum } from "../shared/intent-prompt-adapter";
import { extractMentionedCitiesFromText } from "@/lib/geo/extract-mentioned-cities";

const QUALITY_THRESHOLD = 55;
const MAX_QUALITY_ITERATIONS = 2;
const BUDGET_CAP_USD = 0.1;

const SYSTEM_PROMPT = `Tu es un journaliste expert en IA produisant un article d'actualité en français optimisé SEO/AEO 2026.
Règles absolues :
- Introduction : commence par l'information elle-même, pas par "Chez Axion-IA" — l'intro est centrée sur l'actu.
- Style journalistique : réactif, factuel, contextuel. Explique l'info, donne le contexte marché, puis impact pour PME françaises.
- INTERDICTION DE CITER LA SOURCE : ne mentionne JAMAIS dans le body visible le nom du média/site/source d'origine ni d'expressions du type "Selon X", "d'après Y", "le média Z rapporte". Présente l'information comme un constat factuel ré-analysé sous le prisme Axion-IA. (Traçabilité préservée côté machine via JSON-LD \`isBasedOn\` au publish — AI Act art. 50.)
- Ré-écriture obligatoire : reformule TOTALEMENT le résumé fourni. Ne reprends pas de phrases littérales (similarité Jaccard 5-gram bloquante à 0.10).
- Section Axion-IA : UNE section H2 en fin d'article ("Ce que cela signifie pour les PME françaises") — angle conseil.
- CTA discret en fin d'article uniquement : "Axion-IA accompagne les PME dans leur transformation IA — contact@axion-ia.com."
- Le keyword principal DOIT apparaître textuellement dans le H1.
- 0 délai chiffré, 0 frais de déplacement, 0 prix en dur.
- Minimum 450 mots de contenu substantiel (article d'actualité = plus court que guide).
- 4 à 6 questions FAQ réelles avec réponses directes ≥ 2 lignes.
- "metaTitle": "50-60 caractères MAX, keyword principal inclus au début"
- "metaDescription": "140-155 caractères, phrase complète avec bénéfice clair, keyword naturel inclus"
- Output JSON strict : { title, metaTitle, metaDescription, slug, directAnswer, bodyHtml, faq:[{q,a}], tags }

${getBrandVoiceForContentType("blog_from_rss")}`;

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

    // Sprint External Links Database 2026-05-22 — 4 sources d'autorité injectées.
    const externalLinksCtx = injectExternalLinks(input, { count: 4, minAuthority: 4 });

    // Bloc actualité source RSS injecté dans le prompt — usage CONTEXTE INTERNE
    // uniquement. Le nom de la source / URL sont fournis au modèle pour comprendre
    // le sujet et éviter le hors-sujet, mais l'output visible ne doit JAMAIS les
    // mentionner (directive Will "ne pas dire la source"). La traçabilité reste
    // assurée côté machine via JSON-LD NewsArticle.isBasedOn (AI Act art. 50).
    const rssSection =
      input.rssSourceName || input.rssItemSummary
        ? [
            `## Actualité à RÉ-ÉCRIRE (contexte interne — NE PAS citer dans le body)`,
            input.rssSourceName
              ? `Source d'origine (NE PAS mentionner) : ${escapeLlmInput(input.rssSourceName, { maxLen: 80 })}`
              : "",
            input.rssItemLink
              ? `URL d'origine (NE PAS mentionner) : ${escapeLlmInput(input.rssItemLink, { maxLen: 200 })}`
              : "",
            input.rssItemSummary
              ? `\nRésumé brut (à reformuler totalement, jamais citer littéralement) :\n${escapeLlmInput(input.rssItemSummary, { maxLen: 800 })}`
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
    let lastPromptHash = ""; // P0-3 AI Act art. 50
    const glossaryContext = getGlossaryContext(
      [input.primaryKeyword ?? topic].filter((k): k is string => !!k),
    );

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
${externalLinksCtx.markdownSection}${feedbackSection}
${glossaryContext ? `\n${glossaryContext}` : ""}
## Output attendu (JSON)
{ title, metaTitle, metaDescription, slug, directAnswer, bodyHtml, faq:[{q,a}×5], tags }`;

      lastPromptHash = hashPrompt(
        SYSTEM_PROMPT + getIntentPromptAddendum(input.targetSearchIntent) + userPrompt,
      );

      const llmResult = await routerGenerate({
        jobId: input.jobId,
        contentType: "blog_from_rss",
        role: "text",
        systemPrompt: SYSTEM_PROMPT + getIntentPromptAddendum(input.targetSearchIntent),
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

      // P1-2 — Gate keyword dans H1 (articles actualité : topic = rssItemTitle ?? primaryKeyword).
      if (input.primaryKeyword) {
        const kw = input.primaryKeyword.toLowerCase();
        const h1Match = /<h1[^>]*>(.*?)<\/h1>/i.exec(parsed.bodyHtml ?? "");
        const h1Text = (h1Match?.[1] ?? "").replace(/<[^>]+>/g, "").toLowerCase();
        if (!h1Text.includes(kw)) {
          prevFeedback = `H1 "${h1Match?.[1] ?? "(absent)"}" ne contient pas le keyword "${input.primaryKeyword}". Le keyword DOIT apparaître textuellement dans le H1.`;
          if (accumulatedCostUsd >= BUDGET_CAP_USD || iteration >= MAX_QUALITY_ITERATIONS) break;
          continue;
        }
      }

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

      // V-06 P0b — gate Jaccard 0.10 vs résumé source RSS. Doit passer AVANT
      // d'accepter l'output, sinon un article "qualité OK" pourrait régurgiter
      // la source. Si la similarité dépasse, on force une nouvelle itération.
      const rssSim = input.rssItemSummary
        ? checkRssSimilarity(bodyText, input.rssItemSummary, 0.1)
        : { similarity: 0, threshold: 0.1, passed: true };

      if (qualityScore >= QUALITY_THRESHOLD && rssSim.passed) {
        await logStep(
          input.jobId,
          "quality_loop_pass",
          `Pass ${iteration} — score ${qualityScore}/100, mots ${wordCount}, RSS sim ${rssSim.similarity.toFixed(3)}, cost $${accumulatedCostUsd.toFixed(4)}`,
          {
            qualityScore,
            seoScore: seo.score,
            readabilityScore: readability.score,
            wordCount,
            rssSimilarity: rssSim.similarity,
          },
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
      // V-06 P0a (Sprint Correctif 2026-05-22) — gate INVERSÉ : si la source RSS
      // est mentionnée dans le body, c'est un fail (directive Will "ne pas dire
      // la source"). Traçabilité source via JSON-LD NewsArticle.isBasedOn.
      if (
        input.rssSourceName &&
        bodyText.toLowerCase().includes(input.rssSourceName.toLowerCase())
      ) {
        issues.push(
          `mention de la source "${input.rssSourceName}" détectée dans le body — interdit (la source ne doit jamais apparaître visiblement, traçabilité via JSON-LD isBasedOn)`,
        );
      }
      // V-06 P0b (Sprint Correctif 2026-05-22) — gate anti-régurgitation Jaccard
      // 0.10 vs résumé RSS source. Si la similarité dépasse, l'article paraphrase
      // trop la source → re-write strict obligatoire.
      if (input.rssItemSummary) {
        const rssSim = checkRssSimilarity(bodyText, input.rssItemSummary, 0.1);
        if (!rssSim.passed) {
          issues.push(
            `similarité avec le résumé source ${rssSim.similarity.toFixed(3)} >= seuil ${rssSim.threshold} — ré-écris totalement (pas de paraphrase directe)`,
          );
        }
      }
      prevFeedback = `Score ${qualityScore}/100 insuffisant. Améliore : ${issues.join(" ; ")}.`;
    }

    if (!parsed) {
      throw new Error("blog-from-rss: aucun output valide après quality loop");
    }

    parsed = { ...parsed, bodyHtml: sanitizeContentGenHtml(parsed.bodyHtml ?? "") };
    // P1-12 — Injection liens internes contextuels post-LLM.
    if (input.primaryKeyword ?? topic) {
      parsed = {
        ...parsed,
        bodyHtml: injectInternalLinks(parsed.bodyHtml, input.primaryKeyword ?? topic),
      };
    }

    const bodyText = parsed.bodyHtml
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const wordCount = bodyText.split(/\s+/).filter((w) => w.length > 0).length;
    const readingTimeMinutes = Math.max(1, Math.round(wordCount / 200));
    const mentionedCities = extractMentionedCitiesFromText(bodyText, { maxCities: 20 });

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

    // V-06 P0b — check final anti-régurgitation RSS source post-loop. Si la
    // similarité reste ≥ 0.10, downgrade tier_3_noindex_nofollow (modération
    // humaine obligatoire). On préserve aussi un audit log.
    const finalRssSim = input.rssItemSummary
      ? checkRssSimilarity(bodyText, input.rssItemSummary, 0.1)
      : { similarity: 0, threshold: 0.1, passed: true };

    if (!finalRssSim.passed) {
      await logStep(
        input.jobId,
        "rss_similarity_block",
        `Similarité résumé RSS ${finalRssSim.similarity.toFixed(3)} >= ${finalRssSim.threshold} après quality loop — tier_3 forcé`,
        { rssSimilarity: finalRssSim.similarity, threshold: finalRssSim.threshold },
      );
    }

    // Politique RSS : jamais tier_1 direct — modération humaine requise avant
    // promotion. tier_2_noindex_follow max si qualité suffisante ET pas de
    // régurgitation de la source RSS (V-06 P0b).
    const indexationTier: GeneratorOutput["indexationTier"] = soft404.isSoft404
      ? "tier_3_noindex_nofollow"
      : doctrine.passed && qualityScore >= 55 && finalRssSim.passed
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
      promptHash: lastPromptHash,
      selectedExternalLinkIds: externalLinksCtx.ids,
      mentionedCities,
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
