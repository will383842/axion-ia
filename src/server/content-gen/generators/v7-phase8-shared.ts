/**
 * Content Generator — Pipeline partagé pour les 12 nouveaux content types
 * Sprint v7 Phase 8 (commit 2/4).
 *
 * Pattern strictement aligné sur `landing-ville-shared.ts` (Phase 5 commit 1)
 * mais factorisé pour 12 types métier différents :
 *
 *   1. long_tail_keyword       — Article long-tail SEO ciblé requête longue
 *   2. pain_point_solution     — Pain point métier → solution IA
 *   3. vs_comparator           — Comparatif vs concurrent direct
 *   4. alternative_to          — "Alternatives à X" pour SEO comparatif
 *   5. top_x_in_y              — Top 10 X dans Y (ville/secteur)
 *   6. how_to_x_in_y           — How-to localisé
 *   7. best_for_x_in_y         — Best practice ciblée audience
 *   8. calculator_roi          — Calculateur ROI IA (page interactive)
 *   9. glossary_term           — Définition glossaire pour topic IA
 *  10. what_is_x               — "Qu'est-ce que X" (intent informationnel)
 *  11. faq_geo                 — FAQ géolocalisée (paire ville × topic)
 *  12. case_study_local        — Cas concret client local
 *
 * Audit runtime 2026-05-24 — Productionisation V2 :
 *   + parseLlmJson helper centralisé (strip markdown fences)
 *   + KB retrieve top 8 chunks (RAG-enabled)
 *   + injectExternalLinks 4 sources d'autorité
 *   + Quality loop 3 iter + $0.15 budget cap + temperature progressive
 *   + maxTokens 8000 (au lieu de 3072)
 *   + Prompts renforcés : wordCount ≥ 1200, H2 ≥ 6, H3 ≥ 10, FAQ 8-12, links ≥ 4
 *   + Best-iteration tracking (en cas d'oscillation qualité)
 *
 * Note : les nouveaux ContentType enum values ne sont pas encore dans le client
 * Prisma TS local — on utilise des string casts via `as ContentType`.
 */

import { hashPrompt } from "../provenance/provenance-logger";
import { generate as routerGenerate } from "../providers/provider-router";
import { retrieve as kbRetrieve } from "../kb-client";
import { sanitizeContentGenHtml } from "../shared/html-sanitizer";
import { parseLlmJson } from "../shared/parse-llm-json";
import { escapeLlmInput } from "../shared/prompt-input-escape";
import { getBrandVoiceForContentType } from "../brand/brand-voice";
import { computeReadabilityFr } from "../quality/readability";
import { computeSeoScore } from "../quality/seo-score";
import { checkDoctrine } from "../quality/doctrine-check";
import { evaluateSoft404 } from "../quality/soft-404-gate";
import { injectExternalLinks } from "../links/external-links-injector";
import {
  runMultiJudge,
  scanWithOriginalityAi,
  passesOriginalityGate,
  type JudgeResult,
} from "../quality";
import type { ContentType } from "../../../../prisma/generated/client";
import type { GeneratorBaseInput, GeneratorOutput } from "./types";

const ORIGINALITY_SCAN_TIMEOUT_MS = 5_000;
const ORIGINALITY_MIN_BODY_CHARS = 100;

const QUALITY_THRESHOLD = 60;
const MAX_QUALITY_ITERATIONS = 3;
const BUDGET_CAP_USD = 0.15;
const MIN_WORD_COUNT = 1200;

export interface V7Phase8GeneratorConfig {
  /** Slug enum ContentType (string cast côté local en attendant regen client). */
  readonly contentTypeSlug: string;
  readonly humanLabel: string;
  /** System prompt complet (doctrine + spécificité type). */
  readonly systemPromptOverride: string;
  /** Section additionnelle injectée dans user prompt (focus produit/CTA). */
  readonly userPromptFocusSection: string;
  /** CTA href recommandé. */
  readonly recommendedCtaHref: string;
  readonly recommendedCtaLabel: string;
}

interface ParsedOutput {
  title: string;
  metaTitle: string;
  metaDescription: string;
  slug: string;
  directAnswer: string;
  bodyHtml: string;
  faq: ReadonlyArray<{ q: string; a: string }>;
  tags: ReadonlyArray<string>;
}

/**
 * Pipeline V7 Phase 8 — Quality loop intégrée (audit 2026-05-24 V2).
 */
export async function runV7Phase8Pipeline(
  input: GeneratorBaseInput,
  config: V7Phase8GeneratorConfig,
): Promise<GeneratorOutput> {
  const safeIntent = escapeLlmInput(input.targetSearchIntent, { maxLen: 30 });
  const safeKeyword = escapeLlmInput(input.primaryKeyword ?? "IA opérationnelle", { maxLen: 100 });
  const safeVilleSlug = input.anchorVilleSlug
    ? escapeLlmInput(input.anchorVilleSlug, { maxLen: 60 })
    : "";

  // 1. KB retrieve top 8 chunks (audit 2026-05-24 — Phase 8 v7 maintenant RAG-enabled)
  // P0-6 audit KB 2026-05-29 — bride anti-collapse : on ne grounde QUE sur du
  // savoir curé (méthodo/doctrine/cas concrets + les 340 faits services seedés
  // en `industry_use_case`), JAMAIS sur le contenu auto-généré long-tail des 12
  // générateurs Phase-8 eux-mêmes (sinon boucle auto-alimentée → collapse à
  // grande échelle). Set identique à ville-hub-copy (seul generator déjà bridé).
  const kbChunks = await kbRetrieve({
    query: `${safeKeyword} ${config.contentTypeSlug} ${safeVilleSlug}`,
    locale: "fr",
    k: 8,
    filters: {
      audiences: ["public"],
      types: ["methodology", "doctrine", "case_study", "industry_use_case"],
    },
    mode: "hybrid",
  });
  const kbContext = kbChunks.map((c) => `[${c.type}] ${c.title}\n${c.excerpt ?? ""}`).join("\n\n");

  // 2. External links 4 sources d'autorité (audit 2026-05-24)
  const externalLinksCtx = injectExternalLinks(input, { count: 4, minAuthority: 4 });

  const systemPromptWithBrandVoice = `${config.systemPromptOverride}\n\n${getBrandVoiceForContentType(config.contentTypeSlug)}`;

  let bestParsed: ParsedOutput | null = null;
  let bestScore = -1;
  let bestExtras: {
    wordCount: number;
    readabilityScore: number;
    seoScore: number;
    doctrinePassed: boolean;
  } | null = null;
  let accumulatedCostUsd = 0;
  let lastTokensInput = 0;
  let lastTokensOutput = 0;
  let lastCitations: ReadonlyArray<{ url: string; title: string; publishedAt?: string }> = [];
  let lastPromptHash = "";
  let prevFeedback = "";
  let iteration = 0;

  while (iteration < MAX_QUALITY_ITERATIONS) {
    const feedbackSection = prevFeedback
      ? `\n\n## Retour qualité passe précédente — corrige impérativement\n${prevFeedback}`
      : "";

    const userPrompt = `Génère un contenu Axion-IA de type "${config.contentTypeSlug}" (${config.humanLabel}).
Primary keyword : ${safeKeyword}.
Intent : ${safeIntent}.
${safeVilleSlug ? `Ville cible : ${safeVilleSlug}.\n` : ""}
${config.userPromptFocusSection}

## CONTRAINTES STRICTES (re-gen si non-respect)
- Body HTML : ${MIN_WORD_COUNT}-2000 mots minimum (anti-doorway HCU 2024)
- Structure : ≥ 6 balises <h2> + ≥ 10 balises <h3>
- FAQ : 8-12 paires Q/R substantielles (réponses ≥ 2 lignes)
- ≥ 4 liens externes <a> vers sources d'autorité (INSEE, DARES, BPI, EU AI Act…)
- ≥ 3 liens internes vers /audit, /interventions/essentielle, /implementations, /un-a-un
- Le primary keyword DOIT apparaître textuellement dans le <h1> ET début du metaTitle.
- metaTitle : 50-60 caractères MAX
- metaDescription : 140-155 caractères MAX, phrase complète

## Sources internes Axion-IA (à citer en priorité)
${kbContext}
${externalLinksCtx.markdownSection}${feedbackSection}

## CTA recommandé
href : ${config.recommendedCtaHref}
label : ${config.recommendedCtaLabel}

## Output attendu (JSON strict, sans balise markdown)
{ title, metaTitle, metaDescription, slug, directAnswer, bodyHtml, faq:[{q,a}×8-12], tags:[string×4-8] }`;

    lastPromptHash = hashPrompt(systemPromptWithBrandVoice + userPrompt);

    const llmResult = await routerGenerate({
      jobId: input.jobId,
      contentType: config.contentTypeSlug as ContentType,
      role: "text",
      systemPrompt: systemPromptWithBrandVoice,
      userPrompt,
      maxTokens: 8000,
      temperature: iteration === 0 ? 0.7 : iteration === 1 ? 0.5 : 0.3,
    });

    accumulatedCostUsd += llmResult.costUsd;
    lastTokensInput = llmResult.tokensInput;
    lastTokensOutput = llmResult.tokensOutput;
    lastCitations = llmResult.citations ?? [];
    iteration++;

    let parsed: ParsedOutput;
    try {
      parsed = parseLlmJson<ParsedOutput>(llmResult.output);
    } catch {
      prevFeedback =
        "La réponse précédente n'était pas du JSON valide. Retourne UNIQUEMENT un objet JSON, sans balise markdown.";
      if (accumulatedCostUsd >= BUDGET_CAP_USD) break;
      continue;
    }

    parsed.bodyHtml = sanitizeContentGenHtml(parsed.bodyHtml);
    const bodyText = parsed.bodyHtml
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const wordCount = bodyText.split(/\s+/).filter((w) => w.length > 0).length;
    const internalLinkCount = (parsed.bodyHtml.match(/<a\b[^>]*href="\/[^"]*"/gi) ?? []).length;
    const citationCount = (parsed.bodyHtml.match(/<a\b[^>]*href="https?:\/\//gi) ?? []).length;
    const readability = computeReadabilityFr(bodyText);
    const doctrine = await checkDoctrine(bodyText);
    const seo = computeSeoScore({
      title: parsed.title,
      metaDescription: parsed.metaDescription,
      bodyHtml: parsed.bodyHtml,
      bodyText,
      directAnswer: parsed.directAnswer,
      faqCount: parsed.faq.length,
      internalLinkCount,
      citationCount,
      ...(input.primaryKeyword ? { primaryKeyword: input.primaryKeyword } : {}),
      searchIntent: input.targetSearchIntent,
      contentKind: "article",
      hasPersonManonJsonLd: false,
    });

    const score = doctrine.passed
      ? Math.round((seo.score + readability.score) / 2)
      : Math.max(0, Math.round((seo.score + readability.score) / 2) - 30);

    if (score > bestScore) {
      bestScore = score;
      bestParsed = parsed;
      bestExtras = {
        wordCount,
        readabilityScore: readability.score,
        seoScore: seo.score,
        doctrinePassed: doctrine.passed,
      };
    }

    if (score >= QUALITY_THRESHOLD && wordCount >= MIN_WORD_COUNT) break;
    if (accumulatedCostUsd >= BUDGET_CAP_USD) break;

    const issues: string[] = [];
    if (wordCount < MIN_WORD_COUNT)
      issues.push(`wordCount=${wordCount} < ${MIN_WORD_COUNT} requis — étoffer chaque section`);
    if (seo.score < 60) issues.push("densité keyword faible OU balises H2/H3 insuffisantes");
    if (readability.score < 60) issues.push("phrases trop longues — viser 15-20 mots/phrase max");
    if (!doctrine.passed)
      issues.push(
        `violations doctrine : ${doctrine.blockingViolations.map((v) => v.pattern).join(", ")}`,
      );
    if (parsed.faq.length < 8) issues.push(`FAQ ${parsed.faq.length} < 8 — ajouter questions`);
    if (citationCount < 4)
      issues.push(`citations externes ${citationCount} < 4 — ajouter sources d'autorité`);
    if (internalLinkCount < 3)
      issues.push(
        `internal_links ${internalLinkCount} < 3 — lier /audit, /interventions/essentielle, /implementations`,
      );
    prevFeedback = `Score ${score}/100 insuffisant. À corriger : ${issues.join(" ; ")}.`;
  }

  if (!bestParsed || !bestExtras) {
    throw new Error(
      `${config.contentTypeSlug} aucun output valide après ${iteration} itérations (cost=$${accumulatedCostUsd.toFixed(4)})`,
    );
  }
  const parsed = bestParsed;
  const finalBodyText = parsed.bodyHtml
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const finalReadingTimeMinutes = Math.max(1, Math.round(bestExtras.wordCount / 200));

  // Multi-judge ensemble
  const internalJudge: JudgeResult = {
    judgeName: "internal-heuristic",
    score: bestScore,
    feedback: `seo:${bestExtras.seoScore} readability:${bestExtras.readabilityScore} doctrine:${bestExtras.doctrinePassed ? "ok" : "fail"} iter:${iteration}`,
    costUsd: 0,
    tokens: 0,
  };
  const multiJudge = await runMultiJudge(
    {
      jobId: `phase8-${config.contentTypeSlug}`,
      title: parsed.title,
      metaTitle: parsed.metaTitle,
      metaDescription: parsed.metaDescription,
      bodyHtml: parsed.bodyHtml,
      bodyText: finalBodyText,
      faq: parsed.faq.map((q) => ({ question: q.q, answer: q.a })),
      contentType: config.contentTypeSlug,
    },
    internalJudge,
  );
  const qualityScore = multiJudge.consensusScore;
  if (multiJudge.tieBreakerUsed) {
    console.log(
      `[v7-phase8-pipeline] multi-judge arbitered ${config.contentTypeSlug} consensus=${qualityScore} variance=${multiJudge.variance}`,
    );
  }

  // Originality.ai gate
  let originalityPassed = true;
  let originalityCostUsd = 0;
  let originalityReason: string | null = null;
  if (finalBodyText.length >= ORIGINALITY_MIN_BODY_CHARS) {
    try {
      const scan = await Promise.race([
        scanWithOriginalityAi({
          contentText: finalBodyText,
          contentType: config.contentTypeSlug,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("originality_timeout")), ORIGINALITY_SCAN_TIMEOUT_MS),
        ),
      ]);
      originalityCostUsd = scan.costUsd;
      const gate = passesOriginalityGate(scan);
      originalityPassed = gate.passed;
      originalityReason = gate.reason;
      if (!originalityPassed) {
        console.log(
          `[v7-phase8-pipeline] originality gate FAIL ${config.contentTypeSlug} reason=${originalityReason}`,
        );
      }
    } catch (err) {
      console.log(
        `[v7-phase8-pipeline] originality scan error ${config.contentTypeSlug} err=${String(err)}`,
      );
    }
  }

  const soft404 = evaluateSoft404({
    wordCount: bestExtras.wordCount,
    hasFullLocalBusinessJsonLd: false,
    hasLocalCase: false,
    faqCount: parsed.faq.length,
  });

  const indexationTier: GeneratorOutput["indexationTier"] =
    soft404.isSoft404 || qualityScore < QUALITY_THRESHOLD || !originalityPassed
      ? "tier_3_noindex_nofollow"
      : bestExtras.doctrinePassed && qualityScore >= 70
        ? "tier_2_noindex_follow"
        : "tier_3_noindex_nofollow";

  return {
    title: parsed.title,
    metaTitle: parsed.metaTitle,
    metaDescription: parsed.metaDescription,
    slug: parsed.slug,
    directAnswer: parsed.directAnswer,
    bodyHtml: parsed.bodyHtml,
    bodyText: finalBodyText,
    faq: parsed.faq.map((q) => ({ question: q.q, answer: q.a })),
    tags: parsed.tags,
    indexationTier,
    qualityScore,
    seoScore: bestExtras.seoScore,
    readabilityScore: bestExtras.readabilityScore,
    wordCount: bestExtras.wordCount,
    readingTimeMinutes: finalReadingTimeMinutes,
    totalTokens: lastTokensInput + lastTokensOutput,
    totalCostUsd: accumulatedCostUsd + originalityCostUsd,
    citations: lastCitations,
    promptHash: lastPromptHash,
    // H2 — traçabilité KB : quels faits ont nourri ce contenu Phase 8.
    kbEntryIds: kbChunks.map((c) => c.entryId),
  };
}
