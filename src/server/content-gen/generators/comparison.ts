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
import { getBrandVoiceForContentType } from "../brand/brand-voice";
import { getGlossaryContext } from "../brand/glossary-context";
import { injectInternalLinks } from "../links/internal-link-catalog";

const QUALITY_THRESHOLD = 60;
const MAX_QUALITY_ITERATIONS = 2;
const BUDGET_CAP_USD = 0.12;

const SYSTEM_PROMPT = `Tu es un expert IA indépendant mandaté pour produire une analyse comparative factuelle en français optimisée SEO 2026.
Produis un comparatif structuré. Règles absolues :
- Structure OBLIGATOIRE : une section H2 par critère d'analyse (lisibilité, performance, coût, etc.)
- Pour chaque critère : évaluation de chaque option en prose (<p>, <ul>) — AUCUN <table>, AUCUN graphique, AUCUN histogramme.
- La section Axion-IA est présente comme une option parmi d'autres, évaluée factuellement.
- Conclusion : recommandation motivée par taille entreprise + cas d'usage (PME, ETI, etc.)
- 100 % factuel : pas de superlatif sans preuve concrète.
- Le keyword principal DOIT apparaître textuellement dans le H1.
- 0 délai chiffré, 0 frais de déplacement, 0 prix en dur.
- 0 numéro de téléphone : utiliser uniquement contact@axion-ia.com.
- Minimum 700 mots de contenu substantiel.
- 4 à 6 questions FAQ réelles (People-Also-Ask comparatif) avec réponses directes ≥ 2 lignes.
- Output JSON strict : { title, metaTitle, metaDescription, slug, directAnswer, bodyHtml, faq:[{q,a}], tags }

${getBrandVoiceForContentType("comparison")}`;

/** Vérifie que le body contient au moins 2 sections H2 (structure comparative). */
function hasComparativeSections(bodyHtml: string): boolean {
  const h2count = (bodyHtml.match(/<h2[\s>]/gi) ?? []).length;
  return h2count >= 2;
}

/** Vérifie l'absence de tableaux HTML interdits. */
function hasNoForbiddenTable(bodyHtml: string): boolean {
  return !/<table[\s>]/i.test(bodyHtml);
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
    const glossaryContext = getGlossaryContext(
      [input.primaryKeyword ?? topic].filter((k): k is string => !!k),
    );

    while (iteration < MAX_QUALITY_ITERATIONS) {
      const feedbackSection = prevFeedback
        ? `\n\n## Retour qualité passe précédente\n${prevFeedback}\nCorrige impérativement ces points.`
        : "";

      const userPrompt = `Génère un article comparatif sur : "${safeTopic}".
Intent : ${safeIntent} (comparaison directe d'options).
Audience cible : ${safeAudienceSize}.

Structure imposée :
- H1 : titre comparatif (keyword inclus)
- H2 par critère : lisibilité, coût, déploiement, support, cas d'usage PME/ETI...
- Pour chaque critère : prose <p> ou <ul> — JAMAIS de <table>, JAMAIS de graphique
- Section conclusion : recommandation par profil (TPE / PME / ETI)
- FAQ 4-6 questions (People Also Ask)

## Sources internes Axion-IA (pour enrichir les sections)
${kbContext}
${feedbackSection}
${glossaryContext ? `\n${glossaryContext}` : ""}
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

      // P1-2 — Gate keyword dans H1 (comparatif).
      if (input.primaryKeyword ?? topic) {
        const kw = (input.primaryKeyword ?? topic).toLowerCase();
        const h1Match = /<h1[^>]*>(.*?)<\/h1>/i.exec(parsed.bodyHtml ?? "");
        const h1Text = (h1Match?.[1] ?? "").replace(/<[^>]+>/g, "").toLowerCase();
        if (!h1Text.includes(kw.slice(0, 25))) {
          prevFeedback = `H1 "${h1Match?.[1] ?? "(absent)"}" ne contient pas le keyword "${input.primaryKeyword ?? topic}". Le keyword DOIT apparaître dans le H1.`;
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
        searchIntent: "commercial_investigation",
        contentKind: "comparison",
        hasPersonManonJsonLd: false,
      });

      const doctrine = await checkDoctrine(bodyText);
      const qualityScore = doctrine.passed
        ? Math.round((seo.score + readability.score) / 2)
        : Math.max(0, Math.round((seo.score + readability.score) / 2) - 30);

      const hasStructure = hasComparativeSections(parsed.bodyHtml ?? "");
      const noTable = hasNoForbiddenTable(parsed.bodyHtml ?? "");

      if (qualityScore >= QUALITY_THRESHOLD && hasStructure && noTable) {
        await logStep(
          input.jobId,
          "quality_loop_pass",
          `Pass ${iteration} — score ${qualityScore}/100, mots ${wordCount}, sections=${hasStructure}, noTable=${noTable}`,
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
      if (!hasStructure)
        issues.push("STRUCTURE MANQUANTE — au moins 2 sections H2 (un par critère comparatif)");
      if (!noTable)
        issues.push("TABLE INTERDITE — remplacer la <table> par des sections H2 + prose <ul>/<p>");
      if (seo.score < 60) issues.push("FAQ insuffisante + directAnswer trop court");
      if (readability.score < 60) issues.push("phrases trop longues");
      if (!doctrine.passed) {
        const violations = doctrine.blockingViolations.map((v) => v.pattern).join(", ");
        issues.push(`violations doctrine : ${violations}`);
      }
      if (wordCount < 700) issues.push(`contenu trop court (${wordCount} mots, minimum 700)`);
      prevFeedback = `Score ${qualityScore}/100 insuffisant. Améliore : ${issues.join(" ; ")}.`;
    }

    if (!parsed) {
      throw new Error("comparison: aucun output valide après quality loop");
    }

    // Hard gate : structure comparative insuffisante ou table interdite → retry BullMQ
    if (!hasComparativeSections(parsed.bodyHtml ?? "")) {
      throw new Error(
        "comparison: structure H2 comparative absente (< 2 sections) — intent commercial_investigation non satisfait",
      );
    }
    if (!hasNoForbiddenTable(parsed.bodyHtml ?? "")) {
      throw new Error(
        "comparison: <table> HTML détectée malgré l'instruction — utiliser uniquement prose structurée",
      );
    }

    parsed = { ...parsed, bodyHtml: sanitizeContentGenHtml(parsed.bodyHtml ?? "") };
    // P1-12 — Liens internes contextuels.
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
