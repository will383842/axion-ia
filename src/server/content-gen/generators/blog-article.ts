/**
 * Generator — article de blog générique depuis un contexte de campagne.
 *
 * Différences vs blog-from-keywords :
 * - primaryKeyword optionnel (synthétisé depuis anchorVilleSlug + templateVariant)
 * - Angle "mise en pratique / retour terrain" plutôt que ciblage keyword pur
 * - Audience B2B PME/ETI France — format conseil opérationnel
 */

import { generate as routerGenerate } from "../providers/provider-router";
import { hashPrompt } from "../provenance/provenance-logger";
import { retrieve as kbRetrieve } from "../kb-client";
import { computeReadabilityFr } from "../quality/readability";
import { computeSeoScore } from "../quality/seo-score";
import { checkDoctrine } from "../quality/doctrine-check";
import { outlineFeedback } from "../quality/outline-validator";
import { evaluateSoft404 } from "../quality/soft-404-gate";
import { sanitizeContentGenHtml } from "../shared/html-sanitizer";
import { parseLlmJson } from "../shared/parse-llm-json";
import { escapeLlmInput } from "../shared/prompt-input-escape";
import { logStep } from "../shared/generation-log";
import type { Generator, GeneratorBaseInput, GeneratorOutput } from "./types";
import { injectBrandVoice } from "../brand/brand-voice";
import { getGlossaryContext } from "../brand/glossary-context";
import { injectInternalLinks } from "../links/internal-link-catalog";
import { injectExternalLinks } from "../links/external-links-injector";
import { getIntentPromptAddendum } from "../shared/intent-prompt-adapter";
import { buildPh3PromptAugmentation } from "../prompt-augmentation";
import { applySystemPromptOverride } from "@/server/content-gen/template-resolver";
import { extractMentionedCitiesFromText } from "@/lib/geo/extract-mentioned-cities";

const QUALITY_THRESHOLD = 60;
const MAX_QUALITY_ITERATIONS = 3;
const BUDGET_CAP_USD = 0.15;

const SYSTEM_PROMPT =
  injectBrandVoice(`Tu es Manon, experte IA chez Axion-IA, cabinet de conseil en IA pour TPE/PME/ETI françaises.
Produis un article de blog en français optimisé SEO/AEO 2026. Règles absolues :
- 100 % centré Axion-IA : chaque paragraphe ancre une valeur ou preuve concrète.
- Angle opérationnel : cas d'usage réels, bénéfices mesurables, retour terrain.
- 0 délai chiffré, 0 mention de frais de déplacement, 0 prix en dur.
- 0 numéro de téléphone : utiliser uniquement contact@axion-ia.com.
- Anti-doorway HCU 2024 : minimum 600 mots de contenu substantiel.
- 6 à 8 questions FAQ réelles (People-Also-Ask) avec réponses directes ≥ 2 lignes.
- Le keyword principal DOIT apparaître textuellement dans le H1. Sans cela l'article sera rejeté.
- Inclure OBLIGATOIREMENT ≥ 2 liens externes vers des sources d'autorité FR (INSEE, DARES, BPI France, France Num, rapport McKinsey, Stanford AI Index, etc.) avec rel="noopener noreferrer". Les AI Overviews Google et Perplexity citent prioritairement les articles sourcés.
- "metaTitle": "50-60 caractères MAX, keyword principal inclus au début"
- "metaDescription": "140-155 caractères, phrase complète avec bénéfice clair, keyword naturel inclus"
- Output JSON strict : { title, metaTitle, metaDescription, slug, directAnswer, bodyHtml, faq:[{q,a}], tags }`);

function synthesizeTopic(input: GeneratorBaseInput): string {
  if (input.primaryKeyword) return input.primaryKeyword;

  const sector =
    input.templateVariant === "audits"
      ? "audit IA"
      : input.templateVariant === "implementations"
        ? "implémentation IA"
        : "formation intelligence artificielle";

  const audience =
    input.targetAudienceSize === "TPE"
      ? " pour TPE"
      : input.targetAudienceSize === "ETI" || input.targetAudienceSize === "GRANDE_ENTREPRISE"
        ? " pour ETI/GE"
        : " pour PME";

  const geo = input.anchorVilleSlug
    ? ` à ${input.anchorVilleSlug.replace(/-/g, " ")}`
    : input.anchorRegionSlug
      ? ` en ${input.anchorRegionSlug.replace(/-/g, " ")}`
      : " en France";

  return `${sector}${audience}${geo}`;
}

export const blogArticleGenerator: Generator = {
  contentType: "blog_article",

  async generate(input: GeneratorBaseInput): Promise<GeneratorOutput> {
    const topic = synthesizeTopic(input);
    const safeTopic = escapeLlmInput(topic, { maxLen: 140 });
    const safeIntent = escapeLlmInput(input.targetSearchIntent, { maxLen: 30 });
    const safeAudienceSize = escapeLlmInput(input.targetAudienceSize ?? "PME", { maxLen: 30 });
    const sectorTagSlugs = input.kbSectorTagSlugs ?? [];

    const kbChunks = await kbRetrieve({
      query: `Axion-IA ${safeTopic} ${sectorTagSlugs.join(" ")}`,
      locale: "fr",
      k: 8,
      filters: {
        audiences: ["public"],
        types: ["industry_use_case", "case_study", "methodology", "guide"],
      },
      ...(sectorTagSlugs.length > 0 ? { sectorTagSlugs } : {}),
      mode: "hybrid",
    });

    const kbContext = kbChunks
      .map((c) => `[${c.type}] ${c.title}\n${c.excerpt ?? ""}`)
      .join("\n\n");

    // Sprint External Links Database 2026-05-22 — sélection 4 sources d'autorité
    // pour injection systématique (anti-hallucination + co-citation E-E-A-T).
    const externalLinksCtx = injectExternalLinks(input, { count: 4, minAuthority: 4 });

    let iteration = 0;
    let accumulatedCostUsd = 0;
    let lastOutput = "";
    type BlogArticleParsed = {
      title: string;
      metaTitle: string;
      metaDescription: string;
      slug: string;
      directAnswer: string;
      bodyHtml: string;
      faq: ReadonlyArray<{ q: string; a: string }>;
      tags: ReadonlyArray<string>;
    };
    let parsed: BlogArticleParsed | null = null;
    let lastTokensInput = 0;
    let lastTokensOutput = 0;
    let lastCitations: ReadonlyArray<{ url: string; title: string; publishedAt?: string }> = [];
    let prevFeedback = input.improvementFeedback ?? "";
    let lastPromptHash = ""; // P0-3 AI Act art. 50
    const glossaryContext = getGlossaryContext([input.primaryKeyword ?? topic].filter(Boolean));

    while (iteration < MAX_QUALITY_ITERATIONS) {
      const feedbackSection = prevFeedback
        ? `\n\n## Retour qualité passe précédente\n${prevFeedback}\nCorrige impérativement ces points.`
        : "";

      const userPrompt = `Génère un article de blog Axion-IA sur le sujet : "${safeTopic}".
Intent : ${safeIntent}.
Audience cible : ${safeAudienceSize}.

## Sources internes Axion-IA (à citer en priorité)
${kbContext}
${externalLinksCtx.markdownSection}${feedbackSection}${glossaryContext ? `\n${glossaryContext}` : ""}
## Output attendu (JSON)
{ title, metaTitle, metaDescription, slug, directAnswer, bodyHtml, faq:[{q,a}×6-8], tags }`;

      // 2026-06-15 — Override template console (fallback prompt code si absent).
      const effectiveSystem = applySystemPromptOverride(
        SYSTEM_PROMPT,
        input.templateOverride,
        "blog_article",
      );
      // PH3b — ancrage local (+ pain-matrix si profil commercial) APPENDU APRÈS les
      // directives. No-op (chaîne vide) si flag QUALITY_PROFILES_ENABLED OFF.
      const ph3Aug = buildPh3PromptAugmentation(input);
      lastPromptHash = hashPrompt(
        effectiveSystem + getIntentPromptAddendum(input.targetSearchIntent) + ph3Aug + userPrompt,
      );

      const llmResult = await routerGenerate({
        jobId: input.jobId,
        contentType: "blog_article",
        role: "text",
        systemPrompt: effectiveSystem + getIntentPromptAddendum(input.targetSearchIntent) + ph3Aug,
        userPrompt,
        maxTokens: input.templateOverride?.maxTokens ?? 4096,
        temperature: input.templateOverride?.temperature ?? (iteration === 0 ? 0.7 : 0.5),
      });

      accumulatedCostUsd += llmResult.costUsd;
      lastTokensInput = llmResult.tokensInput;
      lastTokensOutput = llmResult.tokensOutput;
      lastCitations = llmResult.citations ?? [];
      lastOutput = llmResult.output;
      iteration++;

      try {
        parsed = parseLlmJson<BlogArticleParsed>(lastOutput);
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
      const citationCount = (_bh.match(/<a\b[^>]*href="https?:\/\//gi) ?? []).length;
      const readability = computeReadabilityFr(bodyText);
      const seo = computeSeoScore({
        title: parsed.title ?? "",
        metaDescription: parsed.metaDescription ?? "",
        bodyHtml: parsed.bodyHtml ?? "",
        bodyText,
        directAnswer: parsed.directAnswer,
        faqCount: (parsed.faq ?? []).length,
        internalLinkCount,
        citationCount,
        primaryKeyword: input.primaryKeyword ?? topic,
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
          `Pass ${iteration} — score ${qualityScore}/100, mots ${wordCount}`,
          { qualityScore, seoScore: seo.score, readabilityScore: readability.score, wordCount },
        );
        break;
      }

      if (accumulatedCostUsd >= BUDGET_CAP_USD || iteration >= MAX_QUALITY_ITERATIONS) break;

      const issues: string[] = [];
      if (seo.score < 60) issues.push("densité keyword faible + balises H2 insuffisantes");
      if (readability.score < 60) issues.push("phrases trop longues");
      if (!doctrine.passed) {
        issues.push(
          `violations doctrine : ${doctrine.blockingViolations.map((v) => v.pattern).join(", ")}`,
        );
      }
      if (wordCount < 600) issues.push(`contenu trop court (${wordCount} mots, minimum 600)`);
      // VIS-11 — feedback additif sur la hiérarchie de titres (jamais bloquant).
      const outlineMsg = outlineFeedback(_bh, { minH2: 3 });
      if (outlineMsg) issues.push(outlineMsg);
      prevFeedback = `Score ${qualityScore}/100 insuffisant. Améliore : ${issues.join(" ; ")}.`;
    }

    if (!parsed) {
      throw new Error("blog-article: aucun output valide après quality loop");
    }

    parsed = { ...parsed, bodyHtml: sanitizeContentGenHtml(parsed.bodyHtml ?? "") };
    parsed = {
      ...parsed,
      bodyHtml: injectInternalLinks(parsed.bodyHtml, input.primaryKeyword ?? topic),
    };

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
    const finalCitationCount = (parsed.bodyHtml.match(/<a\b[^>]*href="https?:\/\//gi) ?? []).length;
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
      citationCount: finalCitationCount,
      primaryKeyword: input.primaryKeyword ?? topic,
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
      hasLocalCase: !!input.anchorVilleSlug,
      faqCount: (parsed.faq ?? []).length,
    });

    const indexationTier: GeneratorOutput["indexationTier"] = soft404.isSoft404
      ? "tier_3_noindex_nofollow"
      : doctrine.passed && qualityScore >= 70
        ? "tier_1_indexable"
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
      promptHash: lastPromptHash,
      selectedExternalLinkIds: externalLinksCtx.ids,
      // H2 — traçabilité KB : quels faits ont nourri cet article.
      kbEntryIds: kbChunks.map((c) => c.entryId),
      mentionedCities,
    };
  },
};
