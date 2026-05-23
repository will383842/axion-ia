/**
 * Content Generator — Pipeline partagé `landing-ville-by-vertical-*` (Sprint v7 Phase 5 commit 1).
 *
 * Refactor `landing-ville-templates.ts` (4 variants tactiques) → 5 generators
 * verticaux dédiés alignés sur les 5 verticales métier Axion-IA :
 *   1. interventions     (Module 1 — terrain entreprise)
 *   2. audits            (Module 2 — diagnostic ROI)
 *   3. implementations   (Module 3 — automatisations + agents)
 *   4. un-a-un           (Module 4 — accompagnement individuel dirigeant)
 *   5. sites-web-ia      (Module 5 — Web&Digital IA / `/codage-developpement`)
 *
 * Le pipeline (KB retrieve → LLM → parse → quality → soft-404 → mentioned cities)
 * est strictement identique entre verticales. Seule la `VerticalConfig`
 * (system prompt, focus section, CTA) varie. Cf. §6.1 master prompt v2.5.
 */

import { generate as routerGenerate } from "../providers/provider-router";
import { hashPrompt } from "../provenance/provenance-logger";
import { retrieve as kbRetrieve } from "../kb-client";
import { computeReadabilityFr } from "../quality/readability";
import { computeSeoScore } from "../quality/seo-score";
import { checkDoctrine } from "../quality/doctrine-check";
import { evaluateSoft404 } from "../quality/soft-404-gate";
import { sanitizeContentGenHtml } from "../shared/html-sanitizer";
import { escapeLlmInput, escapeSlugInput } from "../shared/prompt-input-escape";
import { getBrandVoiceForContentType } from "../brand/brand-voice";
import { getGlossaryContext } from "../brand/glossary-context";
import { injectInternalLinks } from "../links/internal-link-catalog";
import { injectExternalLinks } from "../links/external-links-injector";
import { extractMentionedCitiesFromText } from "@/lib/geo/extract-mentioned-cities";
import { ECONOMIC_DATA_BY_SLUG } from "@/content/villes/economic-data";
import type { GeneratorBaseInput, GeneratorOutput } from "./types";

const QUALITY_THRESHOLD = 60;

/**
 * 5 verticales métier Axion-IA (slugs canoniques). Alignés sur les routes
 * publiques `/implantations/[region]/[ville]/[verticale]` (rendu Session 6).
 */
export type LandingVilleVerticalSlug =
  | "interventions"
  | "audits"
  | "implementations"
  | "un-a-un"
  | "sites-web-ia";

export const LANDING_VILLE_VERTICAL_SLUGS: ReadonlyArray<LandingVilleVerticalSlug> = [
  "interventions",
  "audits",
  "implementations",
  "un-a-un",
  "sites-web-ia",
];

export interface VerticalConfig {
  readonly slug: LandingVilleVerticalSlug;
  readonly label: string;
  /** System prompt complet (inclut DOCTRINE_INTOUCHABLE + focus verticale). */
  readonly systemPromptOverride: string;
  /** Section additionnelle injectée dans le user prompt (focus produit/CTA/KPI). */
  readonly userPromptFocusSection: string;
  readonly recommendedCtaHref: string;
  readonly recommendedCtaLabel: string;
}

/**
 * Doctrine commune § 21 + § 1, partagée par les 5 verticales.
 *
 * City Domination 2026-05-18 P1-2 (audit A4 P1 + décision Will Option A) :
 * le mot "formation" est AUTORISÉ en copy quand pertinent (descriptif sessions
 * interventions collectives), mais "intervention" reste le naming canonique.
 */
export const DOCTRINE_INTOUCHABLE = `Tu es Manon, plume éditoriale d'Axion-IA (société française).
Cabinet IA opérationnel français. Doctrine v2.5 stricte :
- Axion-IA-centric ≥ 95 % (méthodologie + cas concrets + tarifs SSOT)
- ≤ 5 % données INSEE (population, secteurs dominants)
- Anti-doorway HCU 2024 : angle unique par ville + verticale
- SIREN : [SIREN à compléter] (utiliser le placeholder jusqu'à réception du numéro définitif)
- Positionnement brand : "cabinet IA opérationnel" + "interventions" (ne pas dire "agence de formation")
- Le mot "formation" est autorisé en copy quand pertinent (descriptif sessions interventions collectives), mais "intervention" reste le naming canonique
- FR uniquement (FR-FR + x-default)
- "metaTitle": "50-60 caractères MAX, keyword principal inclus au début"
- "metaDescription": "140-155 caractères, phrase complète avec bénéfice clair, keyword naturel inclus"`;

/**
 * Pipeline complet `landing-ville` paramétré par `VerticalConfig`.
 * Mutualisé entre les 5 generators verticaux pour éviter duplication massive
 * de KB retrieve + prompt build + parse + quality checks + post-processing.
 */
export async function runLandingVilleByVerticalPipeline(
  input: GeneratorBaseInput,
  config: VerticalConfig,
): Promise<GeneratorOutput> {
  if (!input.anchorVilleSlug) {
    throw new Error(`landing_ville (vertical=${config.slug}) requires anchorVilleSlug`);
  }

  const economicData = ECONOMIC_DATA_BY_SLUG[input.anchorVilleSlug];
  const sectorTagSlugs = input.kbSectorTagSlugs ?? economicData?.kbSectorTags ?? [];

  // 1. KB retrieve (RAG) — query enrichi du slug verticale pour scoring hybride.
  const kbChunks = await kbRetrieve({
    query: `cabinet IA ${input.anchorVilleSlug} ${config.slug} ${input.primaryKeyword ?? "audit intervention implementation"}`,
    locale: "fr",
    k: 8,
    filters: {
      audiences: ["public"],
      types: ["industry_use_case", "case_study", "methodology", "doctrine"],
    },
    ...(sectorTagSlugs.length > 0 ? { sectorTagSlugs } : {}),
    mode: "hybrid",
  });

  const kbContext = kbChunks.map((c) => `[${c.type}] ${c.title}\n${c.excerpt ?? ""}`).join("\n\n");

  // Phase C RAG — Contexte économique local (données vérifiées economic-data/<slug>.ts).
  let localEconomicContext = "";
  if (economicData) {
    const sectors = economicData.topSectorsNaf
      ?.slice(0, 3)
      .map((s) => s.label)
      .join(", ");
    const groups = economicData.grandsGroupesImplantes
      ?.slice(0, 4)
      .map((g) => g.nom)
      .join(", ");
    const poles = economicData.polesCompetitivite
      ?.slice(0, 2)
      .map((p) => p.nom)
      .join(", ");
    const tags = sectorTagSlugs.slice(0, 3).join(", ");
    localEconomicContext = `
## Contexte économique local — ${input.anchorVilleSlug} (données vérifiées)
${sectors ? `Secteurs dominants : ${sectors}.` : ""}
${groups ? `Grands groupes implantés : ${groups}.` : ""}
${poles ? `Pôles de compétitivité : ${poles}.` : ""}
${tags ? `Tags sectoriels Axion-IA : ${tags}.` : ""}
Consigne : ancrer le contenu sur ces réalités locales pour différencier de pages génériques.`;
  }

  // Pass B P1-3 — escape inputs avant interpolation (anti prompt-injection).
  const safeVilleSlug = escapeSlugInput(input.anchorVilleSlug);
  const safeAudienceSize = escapeLlmInput(input.targetAudienceSize ?? "PME", { maxLen: 30 });
  const safeOrgType = escapeLlmInput(input.targetAudienceOrganisation ?? "entreprise_privee", {
    maxLen: 40,
  });
  const safeIntent = escapeLlmInput(input.targetSearchIntent, { maxLen: 30 });
  const safePrimaryKeyword = escapeLlmInput(input.primaryKeyword ?? "cabinet IA", { maxLen: 100 });

  const improvementSection = input.improvementFeedback
    ? `\n\n## Retour LLM-judge — points à corriger impérativement\n${input.improvementFeedback}`
    : "";

  // Sprint External Links Database 2026-05-22 — 4 sources d'autorité (city-aware).
  const externalLinksCtx = injectExternalLinks(input, { count: 4, minAuthority: 4 });

  const userPrompt = `Génère une landing page Axion-IA pour la ville "${safeVilleSlug}".
Audience : ${safeAudienceSize} × ${safeOrgType}.
Intent : ${safeIntent}.
Primary keyword : ${safePrimaryKeyword}.
Verticale : ${config.slug} (${config.label}).

${config.userPromptFocusSection}

## Contexte Axion-IA — sources internes prioritaires
${kbContext}
${externalLinksCtx.markdownSection}${localEconomicContext}${improvementSection}
${(() => {
  const gc = getGlossaryContext([input.primaryKeyword ?? ""].filter(Boolean));
  return gc ? `\n${gc}` : "";
})()}
## CTA recommandé pour cette verticale
href : ${config.recommendedCtaHref}
label : ${config.recommendedCtaLabel}

## Output attendu (JSON)
{ title, metaTitle, metaDescription, slug, directAnswer, bodyHtml, faq:[{q,a}×8], tags }`;

  const lastPromptHash = hashPrompt(config.systemPromptOverride + userPrompt); // P0-3 AI Act art. 50

  const systemPromptWithBrandVoice = `${config.systemPromptOverride}\n\n${getBrandVoiceForContentType("landing_ville")}`;

  const llmResult = await routerGenerate({
    jobId: input.jobId,
    contentType: "landing_ville",
    role: "text",
    systemPrompt: systemPromptWithBrandVoice,
    userPrompt,
    maxTokens: 4096,
    temperature: 0.7,
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
    throw new Error(
      `landing-ville (vertical=${config.slug}) LLM output not valid JSON: ${String(err)}`,
    );
  }

  // Pass B fix P0-5 — sanitize HTML AVANT toute persistance.
  parsed.bodyHtml = sanitizeContentGenHtml(parsed.bodyHtml);
  // P1-12 — Liens internes contextuels.
  if (input.primaryKeyword ?? safePrimaryKeyword) {
    parsed.bodyHtml = injectInternalLinks(
      parsed.bodyHtml,
      input.primaryKeyword ?? safePrimaryKeyword,
    );
  }

  const bodyText = parsed.bodyHtml
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const wordCount = bodyText.split(/\s+/).filter((w) => w.length > 0).length;
  const readingTimeMinutes = Math.max(1, Math.round(wordCount / 200));

  const internalLinkCount =
    (parsed.bodyHtml.match(/<a\b[^>]*href="\/[^"]*"/gi) ?? []).length +
    (parsed.bodyHtml.match(/\[.*?\]\(\/[^)]+\)/g) ?? []).length;
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
    contentKind: "landing",
    hasPersonManonJsonLd: true,
  });

  const qualityScore = doctrine.passed
    ? Math.round((seo.score + readability.score) / 2)
    : Math.max(0, Math.round((seo.score + readability.score) / 2) - 30);

  // City Domination 2026-05-18 P1-5 — Soft-404 word count gate anti-doorway HCU.
  const soft404 = evaluateSoft404({
    wordCount,
    hasFullLocalBusinessJsonLd: false,
    hasLocalCase: false,
    faqCount: parsed.faq.length,
  });

  const indexationTier: GeneratorOutput["indexationTier"] =
    soft404.isSoft404 || qualityScore < QUALITY_THRESHOLD
      ? "tier_3_noindex_nofollow"
      : doctrine.passed && qualityScore >= 70
        ? "tier_2_noindex_follow"
        : "tier_3_noindex_nofollow";

  // Sprint S+2 Phase C — extraction villes mentionnées (forceInclude anchor).
  const mentionedCities = extractMentionedCitiesFromText(bodyText, {
    forceInclude: input.anchorVilleSlug,
    maxCities: 10,
  });

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
    promptHash: lastPromptHash,
    mentionedCities,
    selectedExternalLinkIds: externalLinksCtx.ids,
  };
}
