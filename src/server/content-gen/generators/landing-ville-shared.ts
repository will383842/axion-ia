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
import { parseLlmJson } from "../shared/parse-llm-json";
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

  // Quality loop 3 iter + $0.15 budget cap (audit 2026-05-24 V2)
  const MAX_QUALITY_ITERATIONS = 3;
  const BUDGET_CAP_USD = 0.15;
  const MIN_WORD_COUNT = 1500;

  const systemPromptWithBrandVoice = `${config.systemPromptOverride}\n\n${getBrandVoiceForContentType("landing_ville")}`;

  type Parsed = {
    title: string;
    metaTitle: string;
    metaDescription: string;
    slug: string;
    directAnswer: string;
    bodyHtml: string;
    faq: ReadonlyArray<{ q: string; a: string }>;
    tags: ReadonlyArray<string>;
  };
  let bestParsed: Parsed | null = null;
  let bestScore = -1;
  let bestExtras: {
    wordCount: number;
    readabilityScore: number;
    seoScore: number;
    doctrinePassed: boolean;
    bodyText: string;
  } | null = null;
  let accumulatedCostUsd = 0;
  let lastTokensInput = 0;
  let lastTokensOutput = 0;
  let lastCitations: ReadonlyArray<{ url: string; title: string; publishedAt?: string }> = [];
  let lastPromptHash = "";
  let prevFeedback = input.improvementFeedback ?? "";
  let iteration = 0;

  while (iteration < MAX_QUALITY_ITERATIONS) {
    const feedbackSection = prevFeedback
      ? `\n\n## Retour qualité passe précédente — corrige impérativement\n${prevFeedback}`
      : improvementSection;

    const userPrompt = `Génère une landing page Axion-IA pour la ville "${safeVilleSlug}".
Audience : ${safeAudienceSize} × ${safeOrgType}.
Intent : ${safeIntent}.
Primary keyword : ${safePrimaryKeyword}.
Verticale : ${config.slug} (${config.label}).

${config.userPromptFocusSection}

## CONTRAINTES STRICTES (re-gen si non-respect)
- Body HTML : ${MIN_WORD_COUNT}-2500 mots minimum (anti-doorway HCU 2024)
- Structure : ≥ 6 balises <h2> + ≥ 10 balises <h3>
- FAQ : 8-10 paires Q/R substantielles (≥ 2 lignes/réponse)
- ≥ 4 liens externes vers sources d'autorité (INSEE, BPI, France Num, AI Act eur-lex…)
- ≥ 3 liens internes vers /audit, /interventions/essentielle, /implementations
- Le primary keyword DOIT apparaître textuellement dans le <h1> ET début du metaTitle

## Contexte Axion-IA — sources internes prioritaires
${kbContext}
${externalLinksCtx.markdownSection}${localEconomicContext}${feedbackSection}
${(() => {
  const gc = getGlossaryContext([input.primaryKeyword ?? ""].filter(Boolean));
  return gc ? `\n${gc}` : "";
})()}
## CTA recommandé pour cette verticale
href : ${config.recommendedCtaHref}
label : ${config.recommendedCtaLabel}

## Output attendu (JSON strict, sans balise markdown)
{ title, metaTitle, metaDescription, slug, directAnswer, bodyHtml, faq:[{q,a}×8-10], tags:[string×4-8] }`;

    lastPromptHash = hashPrompt(systemPromptWithBrandVoice + userPrompt);

    const llmResult = await routerGenerate({
      jobId: input.jobId,
      contentType: "landing_ville",
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

    let parsed: Parsed;
    try {
      parsed = parseLlmJson<Parsed>(llmResult.output);
    } catch {
      prevFeedback =
        "La réponse précédente n'était pas du JSON valide. Retourne UNIQUEMENT un objet JSON, sans balise markdown.";
      if (accumulatedCostUsd >= BUDGET_CAP_USD) break;
      continue;
    }

    parsed.bodyHtml = sanitizeContentGenHtml(parsed.bodyHtml);
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
        bodyText,
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
    prevFeedback = `Score ${score}/100 insuffisant. À corriger : ${issues.join(" ; ")}.`;
  }

  if (!bestParsed || !bestExtras) {
    throw new Error(
      `landing-ville (vertical=${config.slug}) aucun output valide après ${iteration} itérations (cost=$${accumulatedCostUsd.toFixed(4)})`,
    );
  }
  const parsed = bestParsed;
  const bodyText = bestExtras.bodyText;
  const wordCount = bestExtras.wordCount;
  const readingTimeMinutes = Math.max(1, Math.round(wordCount / 200));
  const qualityScore = bestScore;
  const readability = { score: bestExtras.readabilityScore };
  const doctrine = { passed: bestExtras.doctrinePassed };
  const seo = { score: bestExtras.seoScore };

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
    totalTokens: lastTokensInput + lastTokensOutput,
    totalCostUsd: accumulatedCostUsd,
    citations: lastCitations,
    promptHash: lastPromptHash,
    mentionedCities,
    selectedExternalLinkIds: externalLinksCtx.ids,
  };
}
