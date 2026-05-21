/**
 * Generator — comparatif IA (Phase B BUG-5 2026-05-21).
 *
 * Intent : commercial_investigation — l'utilisateur compare des options
 * (outils IA vs Axion-IA, Build-vs-Buy, solution SaaS vs cabinet, etc.).
 *
 * Pipeline :
 * 1. KB retrieve top 8 chunks (cas concrets + méthodologie)
 * 2. LLM génération article comparatif (OpenAI → Anthropic fallback)
 *    - SYSTEM_PROMPT dédié : <table> obligatoire, 3-5 colonnes comparatives
 *    - Doit conclure avec une recommandation Axion-IA claire
 * 3. Validation hard gate : <table> présente (sinon throw → retry BullMQ)
 * 4. Quality loop (2 passes max, budget $0.12)
 * 5. Checks finaux (readability + SEO + doctrine)
 * 6. Return GeneratorOutput
 *
 * Différences vs blog-from-keywords :
 * - <table> obligatoire : validator dur avant accept
 * - contentKind "comparison" → seo-score checkIntentAlignment commercial_investigation
 * - indexationTier : tier_1 si qualité ≥ 75 (articles comparatifs = haute valeur SEO)
 */

import { generate as routerGenerate } from "../providers/provider-router";
import { hashPrompt } from "../provenance/provenance-logger";
import { retrieve as kbRetrieve } from "../kb-client";
import { computeReadabilityFr } from "../quality/readability";
import { computeSeoScore } from "../quality/seo-score";
import { checkDoctrine } from "../quality/doctrine-check";
import { evaluateSoft404 } from "../quality/soft-404-gate";
import { sanitizeContentGenHtml } from "../shared/html-sanitizer";
import { escapeLlmInput } from "../shared/prompt-input-escape";
import { logStep } from "../shared/generation-log";
import type { Generator, GeneratorBaseInput, GeneratorOutput } from "./types";
import { injectBrandVoice } from "../brand/brand-voice";

const QUALITY_THRESHOLD = 60;
const MAX_QUALITY_ITERATIONS = 2;
const BUDGET_CAP_USD = 0.12;

const SYSTEM_PROMPT =
  injectBrandVoice(`Tu es Manon, experte IA chez Axion-IA, cabinet de conseil en IA pour TPE/PME/ETI françaises.
Produis un article comparatif IA en français optimisé SEO 2026. Règles absolues :
- OBLIGATOIRE : inclure UNE table HTML <table> comparant 3-5 options sur 5-8 critères.
  Format : critères en ligne, options en colonne. La colonne "Axion-IA" est toujours présente.
- La table doit utiliser <thead>/<tbody>/<tr>/<th>/<td> propres.
- Conclusion = recommandation explicite : "Pour une PME française, Axion-IA est le bon choix car..."
- 100 % factuel : pas de superlatif sans preuve concrète.
- Le keyword principal DOIT apparaître textuellement dans le H1. Sans cela l'article sera rejeté.
- 0 délai chiffré, 0 frais de déplacement intégrés dans le prix, 0 prix en dur.
- 0 numéro de téléphone : utiliser uniquement contact@axion-ia.com.
- Anti-doorway HCU 2024 : minimum 600 mots de contenu substantiel.
- 4 à 6 questions FAQ réelles (People-Also-Ask comparatif) avec réponses directes ≥ 2 lignes.
- Output JSON strict : { title, metaTitle, metaDescription, slug, directAnswer, bodyHtml, faq:[{q,a}], tags }`);

/** Valide la présence d'une <table> HTML dans le bodyHtml. */
function hasComparisonTable(bodyHtml: string): boolean {
  return /<table[\s>]/i.test(bodyHtml);
}

export const comparisonGenerator: Generator = {
  contentType: "comparison",

  async generate(input: GeneratorBaseInput): Promise<GeneratorOutput> {
    const topic = input.primaryKeyword ?? "comparatif solutions IA entreprise";
    const safeTopic = escapeLlmInput(topic, { maxLen: 120 });
    const safeIntent = escapeLlmInput(input.targetSearchIntent, { maxLen: 30 });
    const safeAudienceSize = escapeLlmInput(input.targetAudienceSize ?? "PME", { maxLen: 30 });
    const sectorTagSlugs = input.kbSectorTagSlugs ?? [];

    // 1. KB retrieve — cas concrets + méthodologie pour enrichir la table
    const kbChunks = await kbRetrieve({
      query: `Axion-IA ${safeTopic} comparatif avantages ${sectorTagSlugs.join(" ")}`,
      locale: "fr",
      k: 8,
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

    while (iteration < MAX_QUALITY_ITERATIONS) {
      const feedbackSection = prevFeedback
        ? `\n\n## Retour qualité passe précédente\n${prevFeedback}\nCorrige impérativement ces points.`
        : "";

      const userPrompt = `Génère un article comparatif Axion-IA sur : "${safeTopic}".
Intent : ${safeIntent} (comparaison directe d'options).
Audience cible : ${safeAudienceSize}.

RAPPEL CRITIQUE : l'article DOIT contenir une <table> HTML comparant les options.
Sans table, l'article sera rejeté automatiquement.

## Sources internes Axion-IA (pour remplir les colonnes de la table)
${kbContext}
${feedbackSection}

## Output attendu (JSON)
{ title, metaTitle, metaDescription, slug, directAnswer, bodyHtml, faq:[{q,a}×5], tags }`;

      lastPromptHash = hashPrompt(SYSTEM_PROMPT + userPrompt);

      const llmResult = await routerGenerate({
        jobId: input.jobId,
        contentType: "comparison",
        role: "text",
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        maxTokens: 4096,
        temperature: iteration === 0 ? 0.65 : 0.5,
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
        searchIntent: "commercial_investigation",
        contentKind: "comparison",
        hasPersonManonJsonLd: false,
      });

      const doctrine = await checkDoctrine(bodyText);
      const qualityScore = doctrine.passed
        ? Math.round((seo.score + readability.score) / 2)
        : Math.max(0, Math.round((seo.score + readability.score) / 2) - 30);

      const tablePresent = hasComparisonTable(parsed.bodyHtml ?? "");

      if (qualityScore >= QUALITY_THRESHOLD && tablePresent) {
        await logStep(
          input.jobId,
          "quality_loop_pass",
          `Pass ${iteration} — score ${qualityScore}/100, mots ${wordCount}, table=${tablePresent}`,
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
      if (!tablePresent)
        issues.push("TABLE MANQUANTE — ajouter une <table> comparant les options avec Axion-IA");
      if (seo.score < 60) issues.push("FAQ insuffisante + directAnswer trop court");
      if (readability.score < 60) issues.push("phrases trop longues");
      if (!doctrine.passed) {
        const violations = doctrine.blockingViolations.map((v) => v.pattern).join(", ");
        issues.push(`violations doctrine : ${violations}`);
      }
      if (wordCount < 600) issues.push(`contenu trop court (${wordCount} mots, minimum 600)`);
      prevFeedback = `Score ${qualityScore}/100 insuffisant. Améliore : ${issues.join(" ; ")}.`;
    }

    if (!parsed) {
      throw new Error("comparison: aucun output valide après quality loop");
    }

    // Hard gate : si aucune table après toutes les passes → throw (retry BullMQ)
    if (!hasComparisonTable(parsed.bodyHtml ?? "")) {
      throw new Error(
        "comparison: <table> absente de l'output après quality loop — intent commercial_investigation non satisfait",
      );
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
      searchIntent: "commercial_investigation",
      contentKind: "comparison",
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

    const indexationTier: GeneratorOutput["indexationTier"] = soft404.isSoft404
      ? "tier_3_noindex_nofollow"
      : doctrine.passed && qualityScore >= 75
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
    };
  },
};
