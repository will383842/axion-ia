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
import type { Generator, GeneratorBaseInput, GeneratorOutput } from "./types";

const SYSTEM_PROMPT_BASE = `Tu es Manon, plume éditoriale d'Axion-IA (OÜ estonienne).
Cabinet IA opérationnel français. Doctrine v2.5 stricte :
- AxionIA-centric ≥ 95 % (méthodologie + cas concrets + tarifs SSOT)
- ≤ 5 % données INSEE (population, secteurs dominants)
- Anti-doorway HCU 2024 : angle unique par ville
- Pas de SIREN/SIRET/RCS (OÜ estonienne)
- Mot "formation" BANNI (utiliser "intervention")
- FR uniquement (FR-FR + x-default)
- Sub-prompt complet : prompts/landing-ville.md megapack`;

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

    const userPrompt = `Génère une landing page Axion-IA pour la ville "${input.anchorVilleSlug}".
Audience : ${input.targetAudienceSize ?? "PME"} × ${input.targetAudienceOrganisation ?? "entreprise_privee"}.
Intent : ${input.targetSearchIntent}.
Primary keyword : ${input.primaryKeyword ?? "cabinet IA"}.

## Contexte AxionIA — sources internes prioritaires
${kbContext}

## Output attendu (JSON)
{ title, metaTitle, metaDescription, slug, directAnswer, bodyHtml, faq:[{q,a}×8], tags }`;

    const llmResult = await routerGenerate({
      jobId: input.jobId,
      contentType: "landing_ville",
      role: "text",
      systemPrompt: SYSTEM_PROMPT_BASE,
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
      indexationTier:
        doctrine.passed && qualityScore >= 70 ? "tier_2_noindex_follow" : "tier_3_noindex_nofollow",
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
