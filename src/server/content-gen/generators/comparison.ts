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
import {
  articlePageSeoDefaults,
  qualityFromScores,
  appendSourcesSection,
} from "../quality/article-quality";
import { checkDoctrine } from "../quality/doctrine-check";
import { evaluateSoft404 } from "../quality/soft-404-gate";
import { sanitizeContentGenHtml } from "../shared/html-sanitizer";
import { parseLlmJson } from "../shared/parse-llm-json";
import { escapeLlmInput } from "../shared/prompt-input-escape";
import { logStep } from "../shared/generation-log";
import type { Generator, GeneratorBaseInput, GeneratorOutput } from "./types";
import { getBrandVoiceForContentType } from "../brand/brand-voice";
import { pickInternalExpert, buildExpertQuote } from "../brand/expert-bank";
import { getGlossaryContext } from "../brand/glossary-context";
import { injectInternalLinks } from "../links/internal-link-catalog";
import { injectExternalLinks } from "../links/external-links-injector";
import { getIntentPromptAddendum } from "../shared/intent-prompt-adapter";
import { buildPh3PromptAugmentation } from "../prompt-augmentation";
import { extractMentionedCitiesFromText } from "@/lib/geo/extract-mentioned-cities";

const QUALITY_THRESHOLD = 60;
const MAX_QUALITY_ITERATIONS = 2;
const BUDGET_CAP_USD = 0.12;

const SYSTEM_PROMPT = `Tu es un expert IA indépendant mandaté pour produire une analyse comparative factuelle en français optimisée SEO 2026.
Produis un comparatif structuré. Règles absolues :
- Structure OBLIGATOIRE : une section H2 par critère + une <table> comparatif récapitulatif obligatoire (3-5 colonnes : Option / Avantages / Inconvénients / Coût / Cible). Featured Snippet 2026.
- GRAPHIQUE À BARRES OBLIGATOIRE quand un critère est quantifiable (score /100, coût relatif, performance, satisfaction) : ajoute un bloc visuel 0-JS. Format EXACT (n'utilise JAMAIS d'attribut style ni de <svg>) — la largeur est portée par la classe ax-bar-N où N = valeur arrondie au multiple de 5 le plus proche (0,5,10,…,100) :
  <figure class="ax-chart" data-aeo="chart"><figcaption>Titre du graphique (ex. « Rapport qualité-prix /100 »)</figcaption><div class="ax-chart-row"><span class="ax-chart-label">Option A</span><span class="ax-chart-track"><span class="ax-chart-fill ax-bar-80"></span></span><span class="ax-chart-num">80</span></div><div class="ax-chart-row"><span class="ax-chart-label">Option B</span><span class="ax-chart-track"><span class="ax-chart-fill ax-bar-65"></span></span><span class="ax-chart-num">65</span></div></figure>
  Une ligne (ax-chart-row) par option comparée. Valeurs réelles et factuelles, jamais inventées.
- La section Axion-IA est présente comme une option parmi d'autres, évaluée factuellement.
- Conclusion : recommandation motivée par taille entreprise + cas d'usage (PME, ETI, etc.)
- 100 % factuel : pas de superlatif sans preuve concrète.
- Le keyword principal DOIT apparaître textuellement dans le H1.
- 0 délai chiffré, 0 mention de frais de déplacement, 0 prix en dur.
- 0 numéro de téléphone : utiliser uniquement contact@axion-ia.com.
- Minimum 700 mots de contenu substantiel.
- Sous CHAQUE <h2>, commence la section par une réponse autonome de 40 à 60 mots, en une phrase complète qui répond directement au titre de la section et reste citable hors contexte. Enveloppe-la dans <p data-aeo="answer">…</p>. Le reste du développement suit ensuite.
- Inclure au moins 2 statistiques chiffrées récentes avec source nommée et lien inline (ex. « 31 % des PME… (DARES, 2024) [lien] »), UNIQUEMENT issues des sources internes/d'autorité fournies — jamais inventées.
- À la première occurrence d'un terme technique, encadre-le avec <dfn> ou <span class="glossary-term" title="définition courte">terme</span>.
- Quand c'est pertinent (1 à 2 max), utilise un encadré : <aside class="callout callout-warning"><p class="callout-label">Attention</p><p>…</p></aside>. Variantes de classe : callout-info, callout-note, callout-warning, callout-danger.
- 4 à 6 questions FAQ réelles (People-Also-Ask comparatif) optimisées Featured Snippet — réponse answer-first : 1ère phrase directe autonome (≤ 25 mots, citable seule), puis 1-2 phrases ; 40 à 55 mots au total.
- "metaTitle": "50-60 caractères MAX, keyword principal inclus au début"
- "metaDescription": "140-155 caractères, phrase complète avec bénéfice clair, keyword naturel inclus"
- "keyTakeaway": 1 à 2 phrases = LE point clé à retenir (synthèse autonome, citable telle quelle par une IA).
- "expertTake": 1 à 2 phrases = prise de position d'expert (perspective/insight concret), SANS statistique inventée, signée par l'expert nommé dans le prompt utilisateur.
- Output JSON strict : { title, metaTitle, metaDescription, slug, directAnswer, bodyHtml, faq:[{q,a}], tags, keyTakeaway, expertTake }

${getBrandVoiceForContentType("comparison")}`;

/** Vérifie que le body contient au moins 2 sections H2 (structure comparative). */
function hasComparativeSections(bodyHtml: string): boolean {
  const h2count = (bodyHtml.match(/<h2[\s>]/gi) ?? []).length;
  return h2count >= 2;
}

/** Vérifie la présence d'un tableau HTML comparatif obligatoire. */
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

    // Refonte templates 2026-06-22 — expert interne choisi DÉTERMINISTIQUEMENT
    // (nom/titre fixés depuis la banque ; le LLM ne rédige que le texte).
    const expert = pickInternalExpert({
      contentType: input.contentType,
      templateVariant: input.templateVariant,
      audienceSize: input.targetAudienceSize,
      topic,
    });

    // 1. KB retrieve — cas concrets + méthodologie pour enrichir la table
    const kbChunks = await kbRetrieve({
      query: `Axion-IA ${safeTopic} comparatif avantages ${sectorTagSlugs.join(" ")}`,
      locale: "fr",
      k: 8,
      filters: {
        audiences: ["public"],
        types: ["industry_use_case", "case_study", "methodology"],
      },
      mode: "hybrid",
    });

    const kbContext = kbChunks
      .map((c) => `[${c.type}] ${c.title}\n${c.excerpt ?? ""}`)
      .join("\n\n");

    // Sprint External Links Database 2026-05-22 — 4 sources d'autorité injectées.
    const externalLinksCtx = injectExternalLinks(input, { count: 4, minAuthority: 4 });

    // 2. Quality loop
    let iteration = 0;
    let accumulatedCostUsd = 0;
    let lastOutput = "";
    type ComparisonParsed = {
      title: string;
      metaTitle: string;
      metaDescription: string;
      slug: string;
      directAnswer: string;
      bodyHtml: string;
      faq: ReadonlyArray<{ q: string; a: string }>;
      tags: ReadonlyArray<string>;
      keyTakeaway?: string;
      expertTake?: string;
    };
    let parsed: ComparisonParsed | null = null;
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
- Pour chaque critère : prose <p> ou <ul> — plus une <table> récapitulatif H2 OBLIGATOIRE
- Section conclusion : recommandation par profil (TPE / PME / ETI)
- FAQ 4-6 questions (People Also Ask)

## Sources internes Axion-IA (pour enrichir les sections)
${kbContext}
${externalLinksCtx.markdownSection}${feedbackSection}
${glossaryContext ? `\n${glossaryContext}` : ""}
## Avis d'expert
"expertTake" = une prise de position de ${expert.name} (${expert.title}) : perspective d'expert concise et utile sur le sujet, sans chiffre inventé.
## Output attendu (JSON)
{ title, metaTitle, metaDescription, slug, directAnswer, bodyHtml, faq:[{q,a}×5], tags, keyTakeaway, expertTake }`;

      // PH3b — pain-matrix (commercial) + ancrage local APPENDUS. No-op si flag OFF.
      const ph3Aug = buildPh3PromptAugmentation(input);
      lastPromptHash = hashPrompt(
        SYSTEM_PROMPT + getIntentPromptAddendum(input.targetSearchIntent) + ph3Aug + userPrompt,
      );

      const llmResult = await routerGenerate({
        jobId: input.jobId,
        contentType: "comparison",
        role: "text",
        systemPrompt: SYSTEM_PROMPT + getIntentPromptAddendum(input.targetSearchIntent) + ph3Aug,
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
        parsed = parseLlmJson<ComparisonParsed>(lastOutput);
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

      // Gate metaTitle LENIENT — snippet SERP faible si vide ou sans keyword.
      if (input.primaryKeyword) {
        const mt = (parsed.metaTitle ?? "").trim();
        if (mt.length < 15 || !mt.toLowerCase().includes(input.primaryKeyword.toLowerCase())) {
          prevFeedback = `Le metaTitle "${mt || "(vide)"}" doit contenir le mot-clé "${input.primaryKeyword}" (50-60 caractères, mot-clé au début).`;
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
        ...articlePageSeoDefaults(parsed.slug ?? "", "comparison"),
      });

      const doctrine = await checkDoctrine(bodyText);
      const qualityScore = qualityFromScores(seo.score, readability.score, doctrine.passed);

      const hasStructure = hasComparativeSections(parsed.bodyHtml ?? "");
      const hasTable = hasComparisonTable(parsed.bodyHtml ?? "");

      if (qualityScore >= QUALITY_THRESHOLD && hasStructure && hasTable) {
        await logStep(
          input.jobId,
          "quality_loop_pass",
          `Pass ${iteration} — score ${qualityScore}/100, mots ${wordCount}, sections=${hasStructure}, hasTable=${hasTable}`,
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
      if (!hasTable)
        issues.push(
          "TABLE MANQUANTE — ajouter un <table> récapitulatif obligatoire (3-5 colonnes) pour Featured Snippet",
        );
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
    if (!hasComparisonTable(parsed.bodyHtml ?? "")) {
      throw new Error(
        "comparison: <table> comparatif absente — Featured Snippet commercial_investigation non satisfait",
      );
    }

    parsed = { ...parsed, bodyHtml: sanitizeContentGenHtml(parsed.bodyHtml ?? "") };
    parsed = {
      ...parsed,
      bodyHtml: appendSourcesSection(parsed.bodyHtml ?? "", externalLinksCtx.links),
    };
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
    const mentionedCities = extractMentionedCitiesFromText(bodyText, { maxCities: 20 });

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
      ...articlePageSeoDefaults(parsed.slug ?? "", "comparison"),
    });

    const qualityScore = qualityFromScores(seo.score, readability.score, doctrine.passed);

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

    const expertQuote = buildExpertQuote(expert, parsed.expertTake);

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
      // Refonte templates 2026-06-22 — point clé + avis d'expert interne. Le
      // nom/titre sont fixés par la banque (jamais le LLM) ; buildExpertQuote
      // renvoie undefined si le texte est vide → bloc non rendu.
      ...(parsed.keyTakeaway?.trim() ? { keyTakeaway: parsed.keyTakeaway.trim() } : {}),
      ...(expertQuote ? { expertQuote } : {}),
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
