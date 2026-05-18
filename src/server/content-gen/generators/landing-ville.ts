/**
 * Content Generator — Landing ville generator (Sprint 2 AGT-C reference impl).
 *
 * Pipeline (§ 6.1 master prompt v2.5) :
 * 1. KB retrieve top 8 chunks via kb-client (FTS hybrid)
 * 2. Optional Perplexity data récente (intent informational)
 * 3. LLM text generation (OpenAI primary, Anthropic fallback)
 * 4. Unsplash hero image (free only, doctrine v3)
 * 5. Quality checks (doctrine + plagiarism + readability + SEO score)
 * 6. Return GeneratorOutput
 *
 * V1 = squelette typé. Sub-prompts complets dans
 * AxionIA_Dossier_FINAL_ABSOLU_v10.1/axionia-megapack-skills/.claude/skills/
 * axionia-content-generator/prompts/landing-ville.md (chargé Sprint 2 Day 3).
 */

import { generate as routerGenerate } from "../providers/provider-router";
import { retrieve as kbRetrieve } from "../kb-client";
import { computeReadabilityFr } from "../quality/readability";
import { computeSeoScore } from "../quality/seo-score";
import { checkDoctrine } from "../quality/doctrine-check";
import { evaluateSoft404 } from "../quality/soft-404-gate";
import { sanitizeContentGenHtml } from "../shared/html-sanitizer";
import { escapeLlmInput, escapeSlugInput } from "../shared/prompt-input-escape";
import type { Generator, GeneratorBaseInput, GeneratorOutput } from "./types";
import { resolveLandingVilleVariant } from "./landing-ville-templates";

export const landingVilleGenerator: Generator = {
  contentType: "landing_ville",

  async generate(input: GeneratorBaseInput): Promise<GeneratorOutput> {
    if (!input.anchorVilleSlug) {
      throw new Error("landing_ville requires anchorVilleSlug");
    }

    // 1. KB retrieve (RAG)
    const kbChunks = await kbRetrieve({
      query: `cabinet IA ${input.anchorVilleSlug} ${input.primaryKeyword ?? "audit intervention implementation"}`,
      locale: "fr",
      k: 8,
      filters: {
        audiences: ["public"],
        types: ["industry_use_case", "case_study", "methodology", "doctrine"],
      },
      mode: "hybrid",
    });

    // 2. LLM text generation via provider-router (OpenAI → Anthropic fallback)
    const kbContext = kbChunks
      .map((c) => `[${c.type}] ${c.title}\n${c.excerpt ?? ""}`)
      .join("\n\n");

    // Pass B P1-3 — escape inputs avant interpolation dans template prompt
    // (anti prompt-injection : backticks, role markers, newlines, etc.).
    const safeVilleSlug = escapeSlugInput(input.anchorVilleSlug);
    const safeAudienceSize = escapeLlmInput(input.targetAudienceSize ?? "PME", { maxLen: 30 });
    const safeOrgType = escapeLlmInput(input.targetAudienceOrganisation ?? "entreprise_privee", {
      maxLen: 40,
    });
    const safeIntent = escapeLlmInput(input.targetSearchIntent, { maxLen: 30 });
    const safePrimaryKeyword = escapeLlmInput(input.primaryKeyword ?? "cabinet IA", {
      maxLen: 100,
    });

    // Batch 3.B audit 2026-05-15 — Résout le variant landing-ville
    // (default / focus_audit / focus_interventions / focus_implementation)
    // selon `input.templateVariant`. Fallback `default` si null/unknown.
    const variant = resolveLandingVilleVariant(input.templateVariant);

    const userPrompt = `Génère une landing page Axion-IA pour la ville "${safeVilleSlug}".
Audience : ${safeAudienceSize} × ${safeOrgType}.
Intent : ${safeIntent}.
Primary keyword : ${safePrimaryKeyword}.
Variant : ${variant.slug} (${variant.label}).

${variant.userPromptFocusSection}

## Contexte Axion-IA — sources internes prioritaires
${kbContext}

## CTA recommandé pour ce variant
href : ${variant.recommendedCtaHref}
label : ${variant.recommendedCtaLabel}

## Output attendu (JSON)
{ title, metaTitle, metaDescription, slug, directAnswer, bodyHtml, faq:[{q,a}×8], tags }`;

    const llmResult = await routerGenerate({
      jobId: input.jobId,
      contentType: "landing_ville",
      role: "text",
      systemPrompt: variant.systemPromptOverride,
      userPrompt,
      maxTokens: 4096,
      temperature: 0.7,
    });

    // 3. Parse output (V1 minimal — V2 Zod strict)
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
      throw new Error(`landing-ville LLM output not valid JSON: ${String(err)}`);
    }

    // Pass B fix P0-5 — sanitize HTML output LLM AVANT toute persistance.
    // Strippe <script>/<iframe>/onerror=/javascript:/etc. Doctrine § 4.1bis.
    parsed.bodyHtml = sanitizeContentGenHtml(parsed.bodyHtml);

    const bodyText = parsed.bodyHtml
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const wordCount = bodyText.split(/\s+/).filter((w) => w.length > 0).length;
    const readingTimeMinutes = Math.max(1, Math.round(wordCount / 200));

    // 4. Quality checks
    const readability = computeReadabilityFr(bodyText);
    const doctrine = await checkDoctrine(bodyText);
    const seo = computeSeoScore({
      title: parsed.title,
      metaDescription: parsed.metaDescription,
      bodyHtml: parsed.bodyHtml,
      bodyText,
      directAnswer: parsed.directAnswer,
      faqCount: parsed.faq.length,
      ...(input.primaryKeyword ? { primaryKeyword: input.primaryKeyword } : {}),
      searchIntent: input.targetSearchIntent,
      contentKind: "landing",
      hasPersonManonJsonLd: true, // injection JSON-LD se fait côté template render
    });

    const qualityScore = doctrine.passed
      ? Math.round((seo.score + readability.score) / 2)
      : Math.max(0, Math.round((seo.score + readability.score) / 2) - 30);

    // City Domination 2026-05-18 P1-5 (audit A7 P1) — Soft-404 word count gate
    // anti-doorway HCU 2024-2026. Si le LLM produit < 350 mots (ou < 280 avec
    // richesse JSON-LD compensante), force tier-3 noindex nofollow pour éviter
    // pénalité Spam Brain Google sur stubs thin content.
    //
    // Le generator landing-ville V1 ne produit pas systématiquement JSON-LD
    // LocalBusiness ni cas concret local en sortie (faits côté
    // VilleServicePageTemplate render). On considère ici les bonus à false par
    // défaut — la page render-time peut être plus riche, mais on prend la
    // décision tier au stade plus pessimiste (anti-leak HCU). Le bonus FAQ
    // count est en revanche disponible directement.
    const soft404 = evaluateSoft404({
      wordCount,
      hasFullLocalBusinessJsonLd: false,
      hasLocalCase: false,
      faqCount: parsed.faq.length,
    });

    const indexationTier: GeneratorOutput["indexationTier"] = soft404.isSoft404
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
      totalCostUsd: llmResult.costUsd,
      citations: llmResult.citations ?? [],
    };
  },
};
