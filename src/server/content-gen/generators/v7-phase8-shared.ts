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
 * V1 = stubs implémentant le contrat `Generator`. La logique LLM réelle
 * (KB retrieve sectoriel, prompt templates dédiés, quality checks adaptés)
 * sera ajoutée en Session 7+ (productionisation graduelle par verticale).
 *
 * Note : les nouveaux ContentType enum values ne sont pas encore dans le client
 * Prisma TS local (lock EPERM Windows) — on utilise des string casts via
 * `as ContentType`. Le client est régénéré en CI GH Actions au build.
 */

import { hashPrompt } from "../provenance/provenance-logger";
import { generate as routerGenerate } from "../providers/provider-router";
import { sanitizeContentGenHtml } from "../shared/html-sanitizer";
import { escapeLlmInput } from "../shared/prompt-input-escape";
import { getBrandVoiceForContentType } from "../brand/brand-voice";
import { computeReadabilityFr } from "../quality/readability";
import { computeSeoScore } from "../quality/seo-score";
import { checkDoctrine } from "../quality/doctrine-check";
import { evaluateSoft404 } from "../quality/soft-404-gate";
import {
  composeMultiJudge,
  scanWithOriginalityAi,
  passesOriginalityGate,
  type JudgeResult,
} from "../quality";
import type { ContentType } from "../../../../prisma/generated/client";
import type { GeneratorBaseInput, GeneratorOutput } from "./types";

const ORIGINALITY_SCAN_TIMEOUT_MS = 5_000;
const ORIGINALITY_MIN_BODY_CHARS = 100;

const QUALITY_THRESHOLD = 60;

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

/**
 * Pipeline V7 Phase 8 — Stub minimal qui appelle le LLM, parse output,
 * sanitize HTML, quality checks. Pas de KB retrieve sectoriel ni d'injection
 * external links pour cette V1 (sera ajouté Sessions 7+ par type).
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

  const userPrompt = `Génère un contenu Axion-IA de type "${config.contentTypeSlug}" (${config.humanLabel}).
Primary keyword : ${safeKeyword}.
Intent : ${safeIntent}.
${safeVilleSlug ? `Ville cible : ${safeVilleSlug}.\n` : ""}
${config.userPromptFocusSection}

## CTA recommandé
href : ${config.recommendedCtaHref}
label : ${config.recommendedCtaLabel}

## Output attendu (JSON strict)
{ title, metaTitle, metaDescription, slug, directAnswer, bodyHtml, faq:[{q,a}×6-8], tags }`;

  const lastPromptHash = hashPrompt(config.systemPromptOverride + userPrompt);
  const systemPromptWithBrandVoice = `${config.systemPromptOverride}\n\n${getBrandVoiceForContentType(config.contentTypeSlug)}`;

  const llmResult = await routerGenerate({
    jobId: input.jobId,
    contentType: config.contentTypeSlug as ContentType,
    role: "text",
    systemPrompt: systemPromptWithBrandVoice,
    userPrompt,
    maxTokens: 3072,
    temperature: 0.65,
  });

  let parsed: {
    title: string;
    metaTitle: string;
    metaDescription: string;
    slug: string;
    directAnswer: string;
    bodyHtml: string;
    faq: ReadonlyArray<{ q: string; a: string }>;
    tags: ReadonlyArray<string>;
  };
  try {
    parsed = JSON.parse(llmResult.output);
  } catch (err) {
    throw new Error(`${config.contentTypeSlug} LLM output not valid JSON: ${String(err)}`);
  }

  parsed.bodyHtml = sanitizeContentGenHtml(parsed.bodyHtml);
  const bodyText = parsed.bodyHtml
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const wordCount = bodyText.split(/\s+/).filter((w) => w.length > 0).length;
  const readingTimeMinutes = Math.max(1, Math.round(wordCount / 200));

  const readability = computeReadabilityFr(bodyText);
  const doctrine = await checkDoctrine(bodyText);
  const internalLinkCount = (parsed.bodyHtml.match(/<a\b[^>]*href="\/[^"]*"/gi) ?? []).length;
  const citationCount = (parsed.bodyHtml.match(/<a\b[^>]*href="https?:\/\//gi) ?? []).length;
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

  const baseQualityScore = doctrine.passed
    ? Math.round((seo.score + readability.score) / 2)
    : Math.max(0, Math.round((seo.score + readability.score) / 2) - 30);

  // ── Sprint v7 Phase 16 wiring (post-prod fix F3) ────────────────────────────
  // Multi-judge ensemble — env-gated MULTI_JUDGE_ENABLED. Quand off, retourne
  // exactement le 1er judge fourni (= identique au single-judge actuel : no-op).
  // V1 = on synthétise un "judge interne" depuis baseQualityScore en attendant
  // les adapters LLM réels (Sessions 11+). Coût 0, déterministe.
  const internalJudge: JudgeResult = {
    judgeName: "internal-heuristic",
    score: baseQualityScore,
    feedback: `seo:${seo.score} readability:${readability.score} doctrine:${doctrine.passed ? "ok" : "fail"}`,
    costUsd: 0,
    tokens: 0,
  };
  const multiJudge = composeMultiJudge([internalJudge]);
  const qualityScore = multiJudge.consensusScore;
  if (multiJudge.tieBreakerUsed) {
    console.log(
      `[v7-phase8-pipeline] multi-judge arbitered ${config.contentTypeSlug} consensus=${qualityScore} variance=${multiJudge.variance}`,
    );
  }

  // Originality.ai gate — env-gated ORIGINALITY_AI_API_KEY. Sans clé → fallback
  // safe (passed=true, fallback reason loggé). Timeout dur 5s + try/catch pour
  // ne jamais bloquer un article si l'API externe rame.
  let originalityPassed = true;
  let originalityReason: string | null = null;
  let originalityCostUsd = 0;
  if (bodyText.length >= ORIGINALITY_MIN_BODY_CHARS) {
    try {
      const scan = await Promise.race([
        scanWithOriginalityAi({
          contentText: bodyText,
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
      // Non-bloquant : on log et on continue avec passed=true (fallback safe).
      console.log(
        `[v7-phase8-pipeline] originality scan error ${config.contentTypeSlug} err=${String(err)}`,
      );
    }
  }

  const soft404 = evaluateSoft404({
    wordCount,
    hasFullLocalBusinessJsonLd: false,
    hasLocalCase: false,
    faqCount: parsed.faq.length,
  });

  const indexationTier: GeneratorOutput["indexationTier"] =
    soft404.isSoft404 || qualityScore < QUALITY_THRESHOLD || !originalityPassed
      ? "tier_3_noindex_nofollow"
      : doctrine.passed && qualityScore >= 70
        ? "tier_2_noindex_follow"
        : "tier_3_noindex_nofollow";

  return {
    title: parsed.title,
    metaTitle: parsed.metaTitle,
    metaDescription: parsed.metaDescription,
    slug: parsed.slug,
    directAnswer: parsed.directAnswer,
    bodyHtml: parsed.bodyHtml,
    bodyText,
    faq: parsed.faq.map((q) => ({ question: q.q, answer: q.a })),
    tags: parsed.tags,
    indexationTier,
    qualityScore,
    seoScore: seo.score,
    readabilityScore: readability.score,
    wordCount,
    readingTimeMinutes,
    totalTokens: llmResult.tokensInput + llmResult.tokensOutput,
    totalCostUsd: llmResult.costUsd + originalityCostUsd,
    citations: llmResult.citations ?? [],
    promptHash: lastPromptHash,
  };
}
