/**
 * Generator — Q/R dérivée page standalone /fr/faq/<slug> (Phase C BUG-5).
 *
 * Pipeline (§ 29 master prompt v1.7 — implémenté 2026-05-21) :
 * 1. primaryKeyword = question principale (obligatoire)
 * 2. KB retrieve top 6 chunks hybride centré sur la question
 * 3. LLM génère : directAnswer + answerHtml étendu + 3-5 Q/R similaires
 * 4. Assembly bodyHtml : h1 question + faq-answer div + related FAQ + JSON-LD
 * 5. QAPage JSON-LD + Speakable injectés dans bodyHtml (script tag)
 * 6. Anti-thin HCU : wordCount ≥ 300 (sinon quality loop)
 *
 * Différences vs blog-from-keywords :
 * - Structure fixée Q/R (pas article long-form)
 * - QAPage JSON-LD embarqué dans bodyHtml (speakable pour AEO/GEO)
 * - indexationTier : tier_2_noindex_follow par défaut (modération humaine)
 * - Un seul LLM call (pas de quality loop multi-pass — économie tokens)
 */

import { buildQAPageJsonLd } from "@/lib/seo-content-gen-factories";
import { generate as routerGenerate } from "../providers/provider-router";
import { hashPrompt } from "../provenance/provenance-logger";
import { retrieve as kbRetrieve } from "../kb-client";
import { computeReadabilityFr } from "../quality/readability";
import { computeSeoScore } from "../quality/seo-score";
import { checkDoctrine } from "../quality/doctrine-check";
import { evaluateSoft404 } from "../quality/soft-404-gate";
import { sanitizeContentGenHtml } from "../shared/html-sanitizer";
import { escapeLlmInput, escapeSlugInput } from "../shared/prompt-input-escape";
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
const BUDGET_CAP_USD = 0.08;

const SYSTEM_PROMPT =
  injectBrandVoice(`Tu es Manon, experte IA chez Axion-IA, cabinet de conseil en IA pour TPE/PME/ETI françaises.
Produis une page FAQ détaillée en français optimisée AEO/GEO 2026. Règles absolues :
- La question principale est fournie par l'utilisateur — tu DOIS y répondre directement.
- directAnswer : 50-80 mots, réponse concise et actionnable (cible Google Featured Snippet).
- answerHtml : réponse étendue 250-400 mots, HTML valide, enrichie de contexte Axion-IA.
  Structure recommandée : <p> intro + <ul>/<ol> liste points clés + <p> conclusion CTA.
- relatedFaq : 3-5 questions similaires fréquentes avec réponses directes ≥ 1 phrase.
- 0 délai chiffré, 0 frais de déplacement intégrés dans le prix, 0 prix en dur.
- 0 numéro de téléphone : utiliser uniquement contact@axion-ia.com.
- "metaTitle": "50-60 caractères MAX, keyword principal inclus au début"
- "metaDescription": "140-155 caractères, phrase complète avec bénéfice clair, keyword naturel inclus"
- Output JSON strict :
  { title, metaTitle, metaDescription, slug, directAnswer, answerHtml, relatedFaq:[{q,a}×3-5], tags }`);

/** Injecte le QAPage JSON-LD + structure Speakable dans le bodyHtml final. */
function buildQABodyHtml(
  question: string,
  directAnswer: string,
  answerHtml: string,
  relatedFaq: ReadonlyArray<{ q: string; a: string }>,
  slug: string,
): string {
  const qaJsonLd = buildQAPageJsonLd({
    question,
    answerHtml,
    slug,
    locale: "fr",
    publishedAt: new Date(),
  });

  const relatedFaqHtml =
    relatedFaq.length > 0
      ? `<section class="related-qa" data-aeo="related-faq">
<h2>Questions fréquentes associées</h2>
${relatedFaq
  .map(
    (item) => `<div class="faq-item" itemscope itemtype="https://schema.org/Question">
  <h3 class="faq-question" itemprop="name">${sanitizeContentGenHtml(item.q)}</h3>
  <div class="faq-answer" itemprop="acceptedAnswer" itemscope itemtype="https://schema.org/Answer">
    <p itemprop="text">${sanitizeContentGenHtml(item.a)}</p>
  </div>
</div>`,
  )
  .join("\n")}
</section>`
      : "";

  return `<h1 class="faq-title" id="axion-faq-title">${sanitizeContentGenHtml(question)}</h1>
<div class="faq-answer direct-answer" data-aeo="answer">
  <p class="tldr-answer" data-aeo="tldr">${sanitizeContentGenHtml(directAnswer)}</p>
  ${answerHtml}
</div>
${relatedFaqHtml}
<script type="application/ld+json">${JSON.stringify(qaJsonLd)}</script>`;
}

export const qaDerivedGenerator: Generator = {
  contentType: "qa_derived",

  async generate(input: GeneratorBaseInput): Promise<GeneratorOutput> {
    if (!input.primaryKeyword) {
      throw new Error("qa_derived requires primaryKeyword (= la question principale)");
    }

    const question = input.primaryKeyword;
    const safeQuestion = escapeLlmInput(question, { maxLen: 200 });
    const sectorTagSlugs = input.kbSectorTagSlugs ?? [];

    // 1. KB retrieve — contexte centré sur la question
    const kbChunks = await kbRetrieve({
      query: `Axion-IA ${safeQuestion} ${sectorTagSlugs.join(" ")}`,
      locale: "fr",
      k: 6,
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

    // Sprint External Links Database 2026-05-22 — 3 sources d'autorité pour Q/R FAQ.
    const externalLinksCtx = injectExternalLinks(input, { count: 3, minAuthority: 4 });

    // 2. Quality loop (max 2 passes pour Q/R — anti-thin HCU clé ici)
    let iteration = 0;
    let accumulatedCostUsd = 0;
    let lastOutput = "";
    let parsed: {
      title: string;
      metaTitle: string;
      metaDescription: string;
      slug: string;
      directAnswer: string;
      answerHtml: string;
      relatedFaq: ReadonlyArray<{ q: string; a: string }>;
      tags: ReadonlyArray<string>;
    } | null = null;
    let lastTokensInput = 0;
    let lastTokensOutput = 0;
    let lastCitations: ReadonlyArray<{ url: string; title: string; publishedAt?: string }> = [];
    let prevFeedback = input.improvementFeedback ?? "";
    let lastPromptHash = ""; // P0-3 AI Act art. 50
    const glossaryContext = getGlossaryContext([question]);

    while (iteration < MAX_QUALITY_ITERATIONS) {
      const feedbackSection = prevFeedback
        ? `\n\n## Retour qualité passe précédente\n${prevFeedback}\nCorrige impérativement ces points.`
        : "";

      const userPrompt = `Génère une page FAQ Axion-IA pour la question : "${safeQuestion}"

## Sources internes Axion-IA (à utiliser pour enrichir la réponse)
${kbContext}
${externalLinksCtx.markdownSection}${feedbackSection}
${glossaryContext ? `\n${glossaryContext}` : ""}
## Output attendu (JSON)
{ title, metaTitle, metaDescription, slug, directAnswer, answerHtml, relatedFaq:[{q,a}×3-5], tags }`;

      lastPromptHash = hashPrompt(
        SYSTEM_PROMPT + getIntentPromptAddendum(input.targetSearchIntent) + userPrompt,
      );

      const llmResult = await routerGenerate({
        jobId: input.jobId,
        contentType: "qa_derived",
        role: "text",
        systemPrompt: SYSTEM_PROMPT + getIntentPromptAddendum(input.targetSearchIntent),
        userPrompt,
        maxTokens: 2048,
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

      // Calcul bodyText approximatif pour quality check inline
      const answerText = (parsed.answerHtml ?? "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const relatedText = (parsed.relatedFaq ?? []).map((item) => `${item.q} ${item.a}`).join(" ");
      const approxBodyText = `${parsed.directAnswer ?? ""} ${answerText} ${relatedText}`;
      const wordCount = approxBodyText.split(/\s+/).filter((w) => w.length > 0).length;

      if (wordCount >= 300) {
        await logStep(
          input.jobId,
          "quality_loop_pass",
          `Pass ${iteration} — mots ~${wordCount}, directAnswer OK`,
          { wordCount, iteration },
        );
        break;
      }

      if (accumulatedCostUsd >= BUDGET_CAP_USD) break;
      if (iteration >= MAX_QUALITY_ITERATIONS) break;

      const issues: string[] = [];
      if (wordCount < 300)
        issues.push(
          `réponse trop courte (${wordCount} mots, minimum 300 requis pour anti-thin HCU)`,
        );
      if (!parsed.directAnswer || parsed.directAnswer.split(/\s+/).length < 30) {
        issues.push("directAnswer trop court (minimum 40 mots)");
      }
      if (!parsed.relatedFaq || parsed.relatedFaq.length < 3) {
        issues.push("relatedFaq insuffisant (minimum 3 questions similaires)");
      }
      prevFeedback = `Contenu insuffisant. Améliore : ${issues.join(" ; ")}.`;
    }

    if (!parsed) {
      throw new Error("qa_derived: aucun output valide après quality loop");
    }

    // 3. Sanitize les morceaux HTML
    const safeAnswerHtml = sanitizeContentGenHtml(parsed.answerHtml ?? "");
    const safeRelatedFaq = (parsed.relatedFaq ?? []).slice(0, 5);

    // 4. Construire bodyHtml final avec QAPage JSON-LD + Speakable
    // P1-12 — Liens internes injectés après sanitize des composants.
    const finalSlug =
      parsed.slug ??
      escapeSlugInput(question)
        .slice(0, 80)
        .replace(/[^a-z0-9-]/g, "-");
    const rawBodyHtml = buildQABodyHtml(
      question,
      parsed.directAnswer ?? "",
      safeAnswerHtml,
      safeRelatedFaq,
      finalSlug,
    );
    const bodyHtml = injectInternalLinks(rawBodyHtml, question);

    const bodyText = bodyHtml
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "") // exclure JSON-LD du bodyText
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const wordCount = bodyText.split(/\s+/).filter((w) => w.length > 0).length;
    const readingTimeMinutes = Math.max(1, Math.round(wordCount / 200));
    const mentionedCities = extractMentionedCitiesFromText(bodyText, { maxCities: 20 });

    const finalInternalLinkCount =
      (bodyHtml.match(/<a\b[^>]*href="\/[^"]*"/gi) ?? []).length +
      (bodyHtml.match(/\[.*?\]\(\/[^)]+\)/g) ?? []).length;
    const readability = computeReadabilityFr(bodyText);
    const doctrine = await checkDoctrine(bodyText);
    const seo = computeSeoScore({
      title: parsed.title ?? question,
      metaDescription: parsed.metaDescription ?? "",
      bodyHtml,
      bodyText,
      directAnswer: parsed.directAnswer,
      faqCount: safeRelatedFaq.length,
      internalLinkCount: finalInternalLinkCount,
      primaryKeyword: question,
      searchIntent: input.targetSearchIntent,
      contentKind: "faq",
      hasPersonManonJsonLd: false,
    });

    const qualityScore = doctrine.passed
      ? Math.round((seo.score + readability.score) / 2)
      : Math.max(0, Math.round((seo.score + readability.score) / 2) - 30);

    const soft404 = evaluateSoft404({
      wordCount,
      hasFullLocalBusinessJsonLd: false,
      hasLocalCase: false,
      faqCount: safeRelatedFaq.length,
    });

    // Politique Q/R : tier_2 par défaut (AEO pages = modération avant promotion)
    const indexationTier: GeneratorOutput["indexationTier"] = soft404.isSoft404
      ? "tier_3_noindex_nofollow"
      : doctrine.passed && qualityScore >= QUALITY_THRESHOLD
        ? "tier_2_noindex_follow"
        : "tier_3_noindex_nofollow";

    return {
      title: parsed.title ?? question,
      metaTitle: parsed.metaTitle ?? "",
      metaDescription: parsed.metaDescription ?? "",
      slug: finalSlug,
      directAnswer: parsed.directAnswer ?? "",
      bodyHtml,
      bodyText,
      faq: safeRelatedFaq.map((item) => ({ question: item.q, answer: item.a })),
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
