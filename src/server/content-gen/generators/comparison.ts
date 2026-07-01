/**
 * Generator — comparatif IA (Phase B BUG-5 2026-05-21).
 *
 * Intent : commercial_investigation — l'utilisateur compare des options
 * (outils IA vs Axion-IA, Build-vs-Buy, solution SaaS vs cabinet, etc.).
 *
 * ARCHITECTURE 3-APPELS (2026-06-25) — mirroir de blog-from-keywords :
 * 1. KB retrieve top 8 chunks (cas concrets + méthodologie)
 * 2. APPEL 1 PLAN (une fois) : title/meta/directAnswer/FAQ/keyTakeaway + outline
 *    de 8 sections H2 (titre + brief). L'outline DOIT prévoir une section
 *    « tableau comparatif » dédiée.
 * 3. APPEL 2 EXPANSION (boucle qualité max 2) via expandOutlineChunked (2 tranches
 *    de 4 sections) : développe l'outline en bodyHtml long. Le SYSTEM_PROMPT_EXPAND
 *    impose qu'AU MOINS une tranche contienne un vrai <table> comparatif.
 * 4. Hard gate : <table> + ≥ 2 sections H2 présents (sinon throw → retry BullMQ)
 * 5. Sanitize + injectInternalLinks + appendSourcesSection
 * 6. Checks finaux (readability + SEO + doctrine) → GeneratorOutput
 *
 * Différences vs blog-from-keywords :
 * - <table> comparatif obligatoire : validator dur avant accept
 * - contentKind "comparison" → seo-score checkIntentAlignment commercial_investigation
 * - indexationTier : tier_1 si qualité ≥ 75 (articles comparatifs = haute valeur SEO)
 */

import { generate as routerGenerate } from "../providers/provider-router";
import { hashPrompt } from "../provenance/provenance-logger";
import { retrieve as kbRetrieve } from "../kb-client";
import { computeReadabilityFr } from "../quality/readability";
import { computeSeoScore, buildAuxBodyText } from "../quality/seo-score";
import {
  articlePageSeoDefaults,
  qualityFromScores,
  appendSourcesSection,
} from "../quality/article-quality";
import { checkDoctrine } from "../quality/doctrine-check";
import { evaluateSoft404 } from "../quality/soft-404-gate";
import { sanitizeContentGenHtml } from "../shared/html-sanitizer";
import { parseLlmJson } from "../shared/parse-llm-json";
import { expandOutlineChunked } from "../shared/expand-outline-chunked";
import { escapeLlmInput } from "../shared/prompt-input-escape";
import { logStep } from "../shared/generation-log";
import type { Generator, GeneratorBaseInput, GeneratorOutput } from "./types";
import { injectBrandVoice } from "../brand/brand-voice";
import { pickInternalExpert, buildExpertQuote } from "../brand/expert-bank";
import { getGlossaryContext } from "../brand/glossary-context";
import { injectInternalLinks } from "../links/internal-link-catalog";
import { injectExternalLinks } from "../links/external-links-injector";
import { getIntentPromptAddendum } from "../shared/intent-prompt-adapter";
import { applySystemPromptOverride } from "@/server/content-gen/template-resolver";
import { extractMentionedCitiesFromText } from "@/lib/geo/extract-mentioned-cities";
import { keywordPresentInText } from "@/server/content-gen/shared/keyword-match";

// ARCHITECTURE 3-APPELS (2026-06-25) — voir blog-from-keywords.ts.
//   1) PLAN (1 appel, UNE fois) : métadonnées + FAQ + outline 8 sections H2,
//      dont une section « tableau comparatif » dédiée. PAS de bodyHtml.
//   2) EXPANSION (1 appel chunké, dans la boucle qualité max 2 itérations) :
//      développe les 8 sections en 2 tranches de 4. AU MOINS une tranche doit
//      contenir un vrai <table> comparatif (exigence intent commercial_investigation).
const QUALITY_THRESHOLD = 75;
const MAX_QUALITY_ITERATIONS = 2;
const BUDGET_CAP_USD = 0.3;
// Plancher de longueur DUR — voir blog-from-keywords.
const MIN_WORD_COUNT = 850;

// ───────────────────────────────────────────────────────────────────────────
// ARCHITECTURE 3-APPELS (2026-06-25)
// ───────────────────────────────────────────────────────────────────────────

// APPEL 1 — PLAN : ossature (métadonnées + FAQ + outline 8 sections). L'outline
// DOIT prévoir une section « tableau comparatif » (la table elle-même est rédigée
// à l'appel 2). PAS de bodyHtml ici.
const SYSTEM_PROMPT_PLAN =
  injectBrandVoice(`Tu es Manon, experte IA chez Axion-IA, cabinet de conseil en IA pour TPE/PME/ETI françaises.
Tu prépares le PLAN d'un article COMPARATIF FR optimisé SEO/AEO 2026 (intent commercial_investigation : l'utilisateur compare des options). Le corps sera rédigé séparément. Règles :
- L'article compare plusieurs options (outils, solutions SaaS, build-vs-buy, cabinet vs interne…). La section Axion-IA est UNE option parmi d'autres, évaluée factuellement.
- 100 % centré sur les « Sources internes Axion-IA » fournies (faits KB) pour la partie Axion-IA. Rien d'inventé : ni cas client fictif (« Entreprise Anonyme »…), ni chiffre non sourcé.
- 0 prix en dur, 0 délai chiffré, 0 numéro de téléphone (uniquement contact@axion-ia.com).
- "title" (le H1 affiché) : **50 à 60 caractères**, keyword principal au tout début, cliquable. NE JAMAIS dépasser 60 caractères.
- "metaTitle" : OBLIGATOIREMENT 50 à 60 caractères (compte les espaces), keyword principal au tout début. NE JAMAIS descendre sous 50 caractères : si trop court, ajoute une précision utile (bénéfice, secteur, « pour TPE/PME »…). NE PAS dépasser 60.
- "metaDescription" : OBLIGATOIREMENT 140 à 160 caractères (compte les espaces), phrase complète avec bénéfice clair + keyword naturel. NE JAMAIS descendre sous 140 caractères : développe jusqu'à atteindre la fourchette. NE PAS dépasser 160.
- "directAnswer" : OBLIGATOIREMENT **40 à 80 mots** (ni moins, ni plus), réponse autonome qui tranche la comparaison, citable seule par une IA (AI Overview / vocal). NE JAMAIS répondre en moins de 40 mots : ajoute le « comment » / « pourquoi » concret jusqu'au plancher.
- "faq" : 8 questions People-Also-Ask comparatives réelles — chaque réponse answer-first : 1ʳᵉ phrase = réponse directe ≤ 25 mots, puis 1-2 phrases ; 40-55 mots au total.
- "keyTakeaway" : 1-2 phrases = LE point clé à retenir (synthèse autonome citable).
- "expertTake" : 1-2 phrases = prise de position d'expert, sans statistique inventée.
- "outline" : **8 sections <h2>** couvrant une progression comparative logique : enjeu/contexte → critères de comparaison (lisibilité, coût, déploiement, support, cas d'usage) un par section → **UNE section dédiée « Tableau comparatif récapitulatif »** → recommandation par profil (TPE/PME/ETI). Chaque entrée = { h2 (titre de section, 5-9 mots), brief (1 phrase : ce que la section doit développer, ancré sur un fait KB précis) }. OBLIGATOIRE : exactement une entrée d'outline doit être la section « tableau comparatif » (son brief précise que cette section contient un <table> récapitulatif 3-5 colonnes Option/Avantages/Inconvénients/Coût/Cible).
- INTERDIT (marketing-hype, doctrine § 21 — rejet automatique) : « unique », « meilleur », « la meilleure », « leader », « n°1 », « révolutionnaire », « exceptionnel », « incroyable », « incontournable », « garanti », « sans risque », « instantané ». Reste factuel et sobre.
- Output JSON strict : { title, metaTitle, metaDescription, slug, directAnswer, faq:[{q,a}×8], tags, keyTakeaway, expertTake, outline:[{h2,brief}×8] }`);

// APPEL 2 — EXPANSION : développe l'outline en bodyHtml complet et long.
// EXIGENCE INTENT : au moins une section (celle « tableau comparatif ») contient
// un vrai <table> récapitulatif — sinon hard gate → retry BullMQ.
const SYSTEM_PROMPT_EXPAND =
  injectBrandVoice(`Tu es Manon, experte IA chez Axion-IA. Tu RÉDIGES le corps HTML d'un article COMPARATIF FR (intent commercial_investigation) à partir d'un plan déjà validé. Règles absolues :
- GROUNDING OBLIGATOIRE : développe CHAQUE section à partir des « Sources internes Axion-IA » fournies (méthodologie, étapes, livrables, ROI RÉELS) pour la partie Axion-IA. Si un fait précis manque, reste général et factuel SANS rien inventer (ni cas client fictif, ni chiffre non sourcé).
- La section Axion-IA est présente comme UNE option parmi d'autres, évaluée factuellement. 0 prix en dur, 0 délai chiffré, 0 numéro de téléphone (contact@axion-ia.com uniquement).
- **TABLEAU COMPARATIF OBLIGATOIRE** : la section dédiée « tableau comparatif » de l'outline DOIT contenir un vrai <table> récapitulatif HTML (3-5 colonnes : Option / Avantages / Inconvénients / Coût / Cible), une ligne par option comparée. C'est le Featured Snippet de l'article : SANS ce <table>, l'article est REJETÉ et ré-généré. Si la tranche en cours contient cette section, le <table> est impératif.
- GRAPHIQUE À BARRES quand un critère est quantifiable (score /100, coût relatif, performance) : ajoute un bloc 0-JS. Format EXACT (n'utilise JAMAIS d'attribut style ni de <svg>) — la largeur est portée par la classe ax-bar-N où N = valeur arrondie au multiple de 5 le plus proche (0,5,…,100) :
  <figure class="ax-chart" data-aeo="chart"><figcaption>Titre du graphique</figcaption><div class="ax-chart-row"><span class="ax-chart-label">Option A</span><span class="ax-chart-track"><span class="ax-chart-fill ax-bar-80"></span></span><span class="ax-chart-num">80</span></div></figure>
  Une ligne (ax-chart-row) par option. Valeurs réelles et factuelles, jamais inventées.
- LONGUEUR DÉTERMINANTE POUR LE RANG : développe EXACTEMENT les sections de l'outline fourni (une <h2> par entrée, dans l'ordre), **chacune de 130 à 190 mots** (2-3 paragraphes pleins). Corps total visé : **1200 à 2000 mots**. JAMAIS une section de 2 phrases. Développe pleinement, ne résume pas.
- Le keyword principal DOIT apparaître textuellement AU MOINS 3 fois dans le corps, réparti naturellement.
- NE PAS inclure de <h1> dans le corps (le titre est rendu séparément par la page).
- Sous CHAQUE <h2>, commence par une réponse autonome de 40-60 mots citable hors contexte, enveloppée dans <p data-aeo="answer">…</p>. Le développement suit.
- ANTI-MONOTONIE : en plus du tableau et du graphique, alterne les formats. 1-2 encadrés <aside class="callout callout-info|callout-note|callout-warning"><p class="callout-label">…</p><p>…</p></aside>, et AU MOINS 1 chiffre-clé <aside class="ax-stat" data-aeo="stat"><span class="ax-stat-num">90/100</span><span class="ax-stat-label">…</span></aside> (chiffre RÉEL sourcé). Jamais plus de 3 paragraphes consécutifs sans élément visuel.
- Inclure ≥ 2 liens externes <a href="https://…" rel="noopener noreferrer"> vers des sources d'autorité FR fournies, avec au moins 2 statistiques chiffrées sourcées inline — jamais inventées.
- À la première occurrence d'un terme technique, encadre-le avec <dfn> ou <span class="glossary-term" title="définition courte">terme</span>.
- INTERDIT (marketing-hype, doctrine § 21 — un seul de ces mots fait REJETER l'article) : « unique », « meilleur », « la meilleure », « leader », « n°1 », « révolutionnaire », « exceptionnel », « incroyable », « incontournable », « garanti », « sans risque », « instantané ». Écris factuel et sobre, sans superlatif.
- Output JSON strict : { bodyHtml }  (UNIQUEMENT le corps HTML des sections demandées, rien d'autre).`);

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

    // 2. ARCHITECTURE 3-APPELS
    let accumulatedCostUsd = 0;
    let lastTokensInput = 0;
    let lastTokensOutput = 0;
    let lastCitations: ReadonlyArray<{ url: string; title: string; publishedAt?: string }> = [];
    let lastPromptHash = ""; // P0-3 AI Act art. 50
    const glossaryContext = getGlossaryContext(
      [input.primaryKeyword ?? topic].filter((k): k is string => !!k),
    );

    type OutlineSection = { h2: string; brief: string };
    type PlanParsed = {
      title: string;
      metaTitle: string;
      metaDescription: string;
      slug: string;
      directAnswer: string;
      faq: ReadonlyArray<{ q: string; a: string }>;
      tags: ReadonlyArray<string>;
      keyTakeaway?: string;
      expertTake?: string;
      outline: ReadonlyArray<OutlineSection>;
    };
    type ComparisonParsed = Omit<PlanParsed, "outline"> & { bodyHtml: string };

    // ── APPEL 1 — PLAN (une seule fois) ──────────────────────────────────────
    const planSystem =
      applySystemPromptOverride(SYSTEM_PROMPT_PLAN, input.templateOverride, "comparison") +
      getIntentPromptAddendum(input.targetSearchIntent);
    const planUserPrompt = `Prépare le PLAN d'un article COMPARATIF Axion-IA sur : "${safeTopic}".
Intent : ${safeIntent} (comparaison directe d'options).
Audience cible : ${safeAudienceSize}.

L'outline doit inclure une section « Tableau comparatif récapitulatif » dédiée (avec <table> 3-5 colonnes), et se conclure par une recommandation par profil (TPE / PME / ETI).

## Sources internes Axion-IA (à exploiter en priorité)
${kbContext}
${glossaryContext ? `\n${glossaryContext}` : ""}
## Avis d'expert
"expertTake" = une prise de position de ${expert.name} (${expert.title}) : perspective d'expert concise et utile, sans chiffre inventé.
## Output attendu (JSON)
{ title, metaTitle, metaDescription, slug, directAnswer, faq:[{q,a}×8], tags, keyTakeaway, expertTake, outline:[{h2,brief}×8] }`;

    let plan: PlanParsed | null = null;
    for (let planAttempt = 0; planAttempt < 2 && !plan; planAttempt++) {
      const planResult = await routerGenerate({
        jobId: input.jobId,
        contentType: "comparison",
        role: "text",
        responseFormatJson: true,
        systemPrompt: planSystem,
        userPrompt:
          planAttempt === 0
            ? planUserPrompt
            : `${planUserPrompt}\n\n## Correction\nLe "title" et le "metaTitle" DOIVENT couvrir le mot-clé "${safeTopic}" (≤ 60 caractères ; « IA » accepté pour « intelligence artificielle »).`,
        maxTokens: 2600,
        temperature: 0.6,
      });
      accumulatedCostUsd += planResult.costUsd;
      lastTokensInput += planResult.tokensInput;
      lastTokensOutput += planResult.tokensOutput;
      lastCitations = planResult.citations ?? lastCitations;
      let candidate: PlanParsed;
      try {
        candidate = parseLlmJson<PlanParsed>(planResult.output);
      } catch {
        continue;
      }
      // Gate title/metaTitle keyword (une réparation max — sinon on accepte tel
      // quel, le seoScore pénalisera). Matching robuste IA⇄intelligence artif.
      const titleLen = (candidate.title ?? "").length;
      const titleOk =
        titleLen >= 30 && titleLen <= 64 && keywordPresentInText(topic, candidate.title ?? "");
      const mt = (candidate.metaTitle ?? "").trim();
      const mtOk = mt.length >= 15 && keywordPresentInText(topic, mt);
      if ((titleOk && mtOk) || planAttempt === 1) plan = candidate;
    }
    if (!plan) {
      throw new Error("comparison: plan invalide après 2 tentatives");
    }
    await logStep(
      input.jobId,
      "plan_generated",
      `Plan OK — ${plan.outline?.length ?? 0} sections, title ${(plan.title ?? "").length} car, cost $${accumulatedCostUsd.toFixed(4)}`,
      { sections: plan.outline?.length ?? 0, titleLen: (plan.title ?? "").length },
    );

    const outlineText = (plan.outline ?? [])
      .map((s, i) => `${i + 1}. ${s.h2} — ${s.brief}`)
      .join("\n");

    // ── APPEL 2 — EXPANSION (boucle qualité, max MAX_QUALITY_ITERATIONS) ──────
    let iteration = 0;
    let parsed: ComparisonParsed | null = null;
    let prevFeedback = input.improvementFeedback ?? "";
    const expandSystem =
      applySystemPromptOverride(SYSTEM_PROMPT_EXPAND, input.templateOverride, "comparison") +
      getIntentPromptAddendum(input.targetSearchIntent);

    while (iteration < MAX_QUALITY_ITERATIONS) {
      const feedbackSection = prevFeedback
        ? `\n\n## Retour qualité passe précédente\n${prevFeedback}\nCorrige impérativement ces points.`
        : "";

      lastPromptHash = hashPrompt(planSystem + expandSystem + outlineText + prevFeedback);
      const expandResult = await expandOutlineChunked({
        jobId: input.jobId,
        contentType: "comparison",
        outline: plan.outline ?? [],
        chunkSize: 4,
        expandSystem,
        maxTokens: input.templateOverride?.maxTokens ?? 5000,
        temperature: input.templateOverride?.temperature ?? (iteration === 0 ? 0.7 : 0.5),
        buildUserPrompt: ({ chunkText, isFirst, isLast }) =>
          `Rédige le CORPS HTML (sections de l'article comparatif) pour le mot-clé : "${safeTopic}" (intent ${safeIntent}, audience ${safeAudienceSize}).
${isFirst ? "Ce sont les PREMIÈRES sections de l'article." : "Suite de l'article (ne répète pas l'introduction)."}${isLast ? " Ce sont les DERNIÈRES sections." : ""}
RAPPEL : si l'une des sections ci-dessous est la section « tableau comparatif », elle DOIT contenir un vrai <table> récapitulatif (3-5 colonnes Option/Avantages/Inconvénients/Coût/Cible).

## Sections à développer MAINTENANT (une <h2> par entrée, dans l'ordre, 130-190 mots chacune)
${chunkText}

## Sources internes Axion-IA (grounding obligatoire)
${kbContext}
${externalLinksCtx.markdownSection}${feedbackSection}
${glossaryContext ? `\n${glossaryContext}` : ""}
## Output attendu (JSON)
{ bodyHtml }  (UNIQUEMENT les <h2> de CES sections, rien d'autre)`,
      });

      accumulatedCostUsd += expandResult.costUsd;
      lastTokensInput += expandResult.tokensInput;
      lastTokensOutput += expandResult.tokensOutput;
      iteration++;

      const { outline: _outline, ...planRest } = plan;
      parsed = { ...planRest, bodyHtml: expandResult.bodyHtml };

      if (!parsed.bodyHtml.trim()) {
        prevFeedback =
          "Le corps généré était vide. Retourne UNIQUEMENT { bodyHtml } avec les <h2> des sections demandées.";
        if (accumulatedCostUsd >= BUDGET_CAP_USD || iteration >= MAX_QUALITY_ITERATIONS) {
          await logStep(
            input.jobId,
            "quality_loop_cap_reached",
            `Expansion vide après ${iteration} passes`,
            { accumulatedCostUsd, iteration },
          );
          break;
        }
        continue;
      }

      // Score pour décider de boucler
      const bodyText = (parsed.bodyHtml ?? "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const wordCount = bodyText.split(/\s+/).filter((w) => w.length > 0).length;
      const _bh = parsed.bodyHtml ?? "";
      const internalLinkCount =
        (_bh.match(/<a\b[^>]*href="\/[^"]*"/gi) ?? []).length +
        (_bh.match(/\[.*?\]\(\/[^)]+\)/g) ?? []).length;
      const citationCount = (_bh.match(/<a\b[^>]*href="https?:\/\//gi) ?? []).length;
      const readability = computeReadabilityFr(bodyText);
      const seo = computeSeoScore({
        title: parsed.title ?? "",
        metaDescription: parsed.metaDescription ?? "",
        bodyHtml: parsed.bodyHtml ?? "",
        bodyText,
        auxBodyText: buildAuxBodyText({
          directAnswer: parsed.directAnswer,
          faq: parsed.faq,
          keyTakeaway: parsed.keyTakeaway,
        }),
        directAnswer: parsed.directAnswer,
        faqCount: (parsed.faq ?? []).length,
        internalLinkCount,
        citationCount,
        primaryKeyword: topic,
        searchIntent: "commercial_investigation",
        ...articlePageSeoDefaults(parsed.slug ?? "", "comparison"),
      });

      const doctrine = await checkDoctrine(bodyText);
      const qualityScore = qualityFromScores(seo.score, readability.score, doctrine.passed);

      const hasStructure = hasComparativeSections(parsed.bodyHtml ?? "");
      const hasTable = hasComparisonTable(parsed.bodyHtml ?? "");

      if (
        qualityScore >= QUALITY_THRESHOLD &&
        hasStructure &&
        hasTable &&
        wordCount >= MIN_WORD_COUNT
      ) {
        await logStep(
          input.jobId,
          "quality_loop_pass",
          `Expansion ${iteration} — score ${qualityScore}/100, mots ${wordCount}, sections=${hasStructure}, hasTable=${hasTable}, cost $${accumulatedCostUsd.toFixed(4)}`,
          { qualityScore, seoScore: seo.score, readabilityScore: readability.score, wordCount },
        );
        break;
      }

      if (accumulatedCostUsd >= BUDGET_CAP_USD) {
        await logStep(
          input.jobId,
          "quality_loop_budget_cap_reached",
          `Budget cap $${BUDGET_CAP_USD} atteint après ${iteration} expansions — score ${qualityScore}/100`,
          { qualityScore, accumulatedCostUsd, iteration },
        );
        break;
      }

      if (iteration >= MAX_QUALITY_ITERATIONS) {
        await logStep(
          input.jobId,
          "quality_loop_cap_reached",
          `Cap ${MAX_QUALITY_ITERATIONS} expansions atteint — score final ${qualityScore}/100`,
          { qualityScore, seoScore: seo.score, readabilityScore: readability.score, wordCount },
        );
        break;
      }

      // Feedback ciblé pour la prochaine expansion
      const issues: string[] = [];
      if (!hasStructure)
        issues.push("STRUCTURE MANQUANTE — au moins 2 sections H2 (un par critère comparatif)");
      if (!hasTable)
        issues.push(
          "TABLE MANQUANTE — ajouter un <table> récapitulatif obligatoire (3-5 colonnes) pour Featured Snippet",
        );
      if (seo.score < 60)
        issues.push("densité keyword insuffisante + liens d'autorité + directAnswer trop court");
      if (readability.score < 60) issues.push("phrases trop longues");
      if (!doctrine.passed) {
        const violations = doctrine.blockingViolations.map((v) => v.pattern).join(", ");
        issues.push(`violations doctrine : ${violations}`);
      }
      if (wordCount < MIN_WORD_COUNT)
        issues.push(
          `corps trop court (${wordCount} mots, minimum ${MIN_WORD_COUNT}) — développe CHAQUE section de l'outline en 130-190 mots (critères comparatifs, chiffres réels, ROI), sans rien inventer`,
        );
      prevFeedback = `Score ${qualityScore}/100 insuffisant (SEO=${seo.score}, lisibilité=${readability.score}). Améliore : ${issues.join(" ; ")}.`;
    }

    if (!parsed) {
      throw new Error("comparison: aucun corps valide après expansion");
    }

    // Hard gate : structure comparative insuffisante ou table absente → retry BullMQ
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

    // 3. Sanitize HTML final + injection liens internes contextuels (P1-12)
    parsed = { ...parsed, bodyHtml: sanitizeContentGenHtml(parsed.bodyHtml ?? "") };
    if (input.primaryKeyword ?? topic) {
      parsed = {
        ...parsed,
        bodyHtml: injectInternalLinks(parsed.bodyHtml, input.primaryKeyword ?? topic),
      };
    }
    // 3b. CORRECTIF INTENT 2026-06-25 : liens d'autorité déterministes (section
    // « Sources ») avant le comptage final → citationCount ≥ liens sélectionnés.
    parsed = {
      ...parsed,
      bodyHtml: appendSourcesSection(parsed.bodyHtml, externalLinksCtx.links),
    };

    const bodyText = parsed.bodyHtml
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const wordCount = bodyText.split(/\s+/).filter((w) => w.length > 0).length;
    const readingTimeMinutes = Math.max(1, Math.round(wordCount / 200));
    const mentionedCities = extractMentionedCitiesFromText(bodyText, { maxCities: 20 });

    // 4. Checks finaux (résultats définitifs)
    const finalInternalLinkCount =
      (parsed.bodyHtml.match(/<a\b[^>]*href="\/[^"]*"/gi) ?? []).length +
      (parsed.bodyHtml.match(/\[.*?\]\(\/[^)]+\)/g) ?? []).length;
    const finalCitationCount = (parsed.bodyHtml.match(/<a\b[^>]*href="https?:\/\//gi) ?? []).length;
    const readability = computeReadabilityFr(bodyText);
    const doctrine = await checkDoctrine(bodyText);
    const seo = computeSeoScore({
      title: parsed.title ?? "",
      metaDescription: parsed.metaDescription ?? "",
      bodyHtml: parsed.bodyHtml,
      bodyText,
      auxBodyText: buildAuxBodyText({
        directAnswer: parsed.directAnswer,
        faq: parsed.faq,
        keyTakeaway: parsed.keyTakeaway,
      }),
      directAnswer: parsed.directAnswer,
      faqCount: (parsed.faq ?? []).length,
      internalLinkCount: finalInternalLinkCount,
      citationCount: finalCitationCount,
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
      : // Gate de substance (2026-06-25) : pas d'indexation tier_1 sans grounding
        // KB réel (kbChunks > 0) → un comparatif non ancré reste noindex (anti-HCU).
        doctrine.passed && qualityScore >= 75 && kbChunks.length > 0
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
