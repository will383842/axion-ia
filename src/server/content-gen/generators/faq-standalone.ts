/**
 * Generator — page FAQ standalone dédiée.
 *
 * Produit une page de questions-réponses dense sur un thème métier Axion-IA.
 * Format : 10-15 Q/A ciblant les intentions People-Also-Ask Google + AEO.
 * Sortie DB : bodyHtml pour la page dédiée /faq/[slug] + faq[] pour FAQPage JSON-LD.
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
import { getGlossaryContext } from "../brand/glossary-context";
import { injectInternalLinks } from "../links/internal-link-catalog";
import { injectExternalLinks } from "../links/external-links-injector";
import { getIntentPromptAddendum } from "../shared/intent-prompt-adapter";
import { extractMentionedCitiesFromText } from "@/lib/geo/extract-mentioned-cities";

const QUALITY_THRESHOLD = 55;
const MAX_QUALITY_ITERATIONS = 2;
const BUDGET_CAP_USD = 0.1;

const SYSTEM_PROMPT =
  injectBrandVoice(`Tu es Manon, experte IA chez Axion-IA, cabinet de conseil en IA pour TPE/PME/ETI françaises.
Produis une page FAQ complète en français optimisée AEO/SEO 2026. Règles absolues :
- 10 à 15 questions réelles posées par des dirigeants PME sur l'IA en entreprise.
- Chaque réponse : 3-6 phrases, directes, sans jargon inutile, ancrées sur Axion-IA.
- Couvre : coûts, délais, ROI, risques, formations, cas d'usage, obligations légales IA Act.
- 0 numéro de téléphone : contact@axion-ia.com uniquement.
- 0 prix en dur, 0 promesses de délais chiffrés.
- bodyHtml = intro thématique HTML (2-3 paragraphes) — les Q/A vont dans faq[].
- "metaTitle": "50-60 caractères MAX, keyword principal inclus au début"
- "metaDescription": "140-155 caractères, phrase complète avec bénéfice clair, keyword naturel inclus"
- Output JSON strict : { title, metaTitle, metaDescription, slug, directAnswer, bodyHtml, faq:[{q,a}×10-15], tags }`);

function synthesizeFaqTopic(input: GeneratorBaseInput): string {
  if (input.primaryKeyword) return input.primaryKeyword;

  const sector =
    input.templateVariant === "audits"
      ? "audit IA en entreprise"
      : input.templateVariant === "implementations"
        ? "implémentation IA en entreprise"
        : "formation IA en entreprise";

  const geo = input.anchorVilleSlug
    ? ` ${input.anchorVilleSlug.replace(/-/g, " ")}`
    : input.anchorRegionSlug
      ? ` ${input.anchorRegionSlug.replace(/-/g, " ")}`
      : "";

  return `${sector}${geo}`;
}

export const faqStandaloneGenerator: Generator = {
  contentType: "faq_standalone",

  async generate(input: GeneratorBaseInput): Promise<GeneratorOutput> {
    const topic = synthesizeFaqTopic(input);
    const safeTopic = escapeLlmInput(topic, { maxLen: 140 });
    const safeAudienceSize = escapeLlmInput(input.targetAudienceSize ?? "PME", { maxLen: 30 });
    const sectorTagSlugs = input.kbSectorTagSlugs ?? [];

    const kbChunks = await kbRetrieve({
      query: `Axion-IA FAQ ${safeTopic} ${sectorTagSlugs.join(" ")}`,
      locale: "fr",
      k: 10,
      filters: {
        audiences: ["public"],
        types: ["industry_use_case", "case_study", "methodology", "faq", "guide"],
      },
      ...(sectorTagSlugs.length > 0 ? { sectorTagSlugs } : {}),
      mode: "hybrid",
    });

    const kbContext = kbChunks
      .map((c) => `[${c.type}] ${c.title}\n${c.excerpt ?? ""}`)
      .join("\n\n");

    // Sprint External Links Database 2026-05-22 — 4 sources d'autorité injectées.
    const externalLinksCtx = injectExternalLinks(input, { count: 4, minAuthority: 4 });

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
    let prevFeedback = "";
    let lastPromptHash = ""; // P0-3 AI Act art. 50
    const glossaryContext = getGlossaryContext(
      [input.primaryKeyword ?? topic].filter((k): k is string => !!k),
    );

    while (iteration < MAX_QUALITY_ITERATIONS) {
      const feedbackSection = prevFeedback
        ? `\n\n## Retour qualité passe précédente\n${prevFeedback}\nCorrige impérativement ces points.`
        : "";

      const userPrompt = `Génère une page FAQ Axion-IA sur le thème : "${safeTopic}".
Audience cible : ${safeAudienceSize}.

## Sources internes Axion-IA (à citer en priorité)
${kbContext}
${externalLinksCtx.markdownSection}${feedbackSection}
${glossaryContext ? `\n${glossaryContext}` : ""}
## Output attendu (JSON)
{ title, metaTitle, metaDescription, slug, directAnswer, bodyHtml, faq:[{q,a}×10-15], tags }`;

      lastPromptHash = hashPrompt(
        SYSTEM_PROMPT + getIntentPromptAddendum(input.targetSearchIntent) + userPrompt,
      );

      const llmResult = await routerGenerate({
        jobId: input.jobId,
        contentType: "faq_standalone",
        role: "text",
        systemPrompt: SYSTEM_PROMPT + getIntentPromptAddendum(input.targetSearchIntent),
        userPrompt,
        maxTokens: 5000,
        temperature: 0.6,
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
          "La réponse précédente n'était pas du JSON valide. Retourne UNIQUEMENT un objet JSON valide.";
        if (accumulatedCostUsd >= BUDGET_CAP_USD) break;
        continue;
      }

      if (!parsed) continue;

      // P1-2 — Gate keyword dans H1 (faq-standalone, si primaryKeyword défini).
      if (input.primaryKeyword) {
        const kw = input.primaryKeyword.toLowerCase();
        const h1Match = /<h1[^>]*>(.*?)<\/h1>/i.exec(parsed.bodyHtml ?? "");
        const h1Text = (h1Match?.[1] ?? "").replace(/<[^>]+>/g, "").toLowerCase();
        if (!h1Text.includes(kw.slice(0, 25))) {
          prevFeedback = `H1 "${h1Match?.[1] ?? "(absent)"}" ne contient pas le keyword "${input.primaryKeyword}". Le keyword DOIT apparaître dans le H1.`;
          if (accumulatedCostUsd >= BUDGET_CAP_USD || iteration >= MAX_QUALITY_ITERATIONS) break;
          continue;
        }
      }

      const faqCount = (parsed.faq ?? []).length;
      const bodyText = (parsed.bodyHtml ?? "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const doctrine = await checkDoctrine(
        bodyText + " " + (parsed.faq ?? []).map((f) => f.a).join(" "),
      );

      await logStep(
        input.jobId,
        "quality_loop_pass",
        `Pass ${iteration} — ${faqCount} Q/A, doctrine: ${doctrine.passed}`,
        { faqCount, doctrineOk: doctrine.passed },
      );

      if (faqCount >= 10 && doctrine.passed) break;
      if (accumulatedCostUsd >= BUDGET_CAP_USD) break;

      const issues: string[] = [];
      if (faqCount < 10) issues.push(`seulement ${faqCount} questions — minimum 10 requises`);
      if (!doctrine.passed) {
        issues.push(
          `violations doctrine : ${doctrine.blockingViolations.map((v) => v.pattern).join(", ")}`,
        );
      }
      prevFeedback = `Insuffisant. Améliore : ${issues.join(" ; ")}.`;
    }

    if (!parsed) {
      throw new Error("faq-standalone: aucun output valide après quality loop");
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
    const faqCount = (parsed.faq ?? []).length;
    const mentionedCities = extractMentionedCitiesFromText(bodyText, { maxCities: 20 });
    const readingTimeMinutes = Math.max(1, Math.round((wordCount + faqCount * 50) / 200));

    const readability = computeReadabilityFr(bodyText);
    const doctrine = await checkDoctrine(bodyText);
    const seo = computeSeoScore({
      title: parsed.title ?? "",
      metaDescription: parsed.metaDescription ?? "",
      bodyHtml: parsed.bodyHtml,
      bodyText,
      directAnswer: parsed.directAnswer,
      faqCount,
      primaryKeyword: input.primaryKeyword ?? topic,
      searchIntent: input.targetSearchIntent,
      contentKind: "article",
      hasPersonManonJsonLd: false,
    });

    const qualityScore = doctrine.passed
      ? Math.round((seo.score + readability.score) / 2)
      : Math.max(0, Math.round((seo.score + readability.score) / 2) - 20);

    const soft404 = evaluateSoft404({
      wordCount,
      hasFullLocalBusinessJsonLd: false,
      hasLocalCase: !!input.anchorVilleSlug,
      faqCount,
    });

    const indexationTier: GeneratorOutput["indexationTier"] = soft404.isSoft404
      ? "tier_3_noindex_nofollow"
      : doctrine.passed && qualityScore >= QUALITY_THRESHOLD
        ? "tier_1_indexable"
        : "tier_2_noindex_follow";

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
