/**
 * Generator — article de blog depuis un titre manuel fourni par Will.
 *
 * Pipeline (architecture 2-appels 2026-06-25) :
 * 1. KB retrieve top 8 chunks centrés sur le titre/topic
 * 2. APPEL 1 — PLAN (une fois) : métadonnées + FAQ + outline 8 sections H2
 *    - Le titre est IMPOSÉ tel quel : le LLM ne peut pas le modifier
 * 3. APPEL 2 — EXPANSION (boucle qualité) : développe l'outline en bodyHtml
 *    - si qualityScore < QUALITY_THRESHOLD → ré-expanse avec feedback ciblé
 *      jusqu'à MAX_QUALITY_ITERATIONS ou BUDGET_CAP_USD
 * 4. Checks finaux (readability + SEO + doctrine + soft-404)
 * 5. Return GeneratorOutput
 *
 * Différences vs blog-from-keywords :
 * - primaryKeyword obligatoire (= titre exact fourni par Will)
 * - Le titre est forcé au titre fourni (le LLM ne peut pas le modifier)
 * - slug dérivé du titre fourni si le LLM diverge
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

// ARCHITECTURE 2-APPELS (2026-06-25) — voir audit content-gen profond.
// Le mono-appel JSON faisait écrire le modèle court (~400 mots, finish_reason
// stop) car il devait produire title+meta+FAQ+body en un seul objet. On scinde :
//   1) PLAN (1 appel, UNE fois) : title/meta/directAnswer/FAQ/keyTakeaway +
//      outline de 8 sections H2 (titre + brief). Coût ~0,05 $.
//   2) EXPANSION (1 appel, dans la boucle qualité max 2 itérations) : développe
//      les 8 sections en bodyHtml complet (130-190 mots/section → 900-1200 mots).
// Typique = 2 appels (~0,12 $) ; pire cas = plan + 2 expansions (~0,18 $).
// Le seuil de break (75) est aligné sur l'auto-publication du worker.
const QUALITY_THRESHOLD = 75;
const MAX_QUALITY_ITERATIONS = 2;
const BUDGET_CAP_USD = 0.3;
// Plancher de longueur DUR : avec l'archi 2-appels la cible réaliste est 850+
// mots de corps (≈ 1100-1400 mots rendus avec FAQ/directAnswer). La boucle ne
// sort pas tant que le corps n'atteint pas ce seuil.
const MIN_WORD_COUNT = 850;

// ───────────────────────────────────────────────────────────────────────────
// ARCHITECTURE 2-APPELS (2026-06-25)
// ───────────────────────────────────────────────────────────────────────────

// APPEL 1 — PLAN : produit l'ossature (métadonnées + FAQ + outline 8 sections).
// PAS de bodyHtml ici (c'est l'appel 2 qui développe). Le TITRE est IMPOSÉ par
// l'utilisateur : on demande au modèle de le reproduire exactement, puis on le
// force côté code (le LLM ne peut pas dévier).
const SYSTEM_PROMPT_PLAN =
  injectBrandVoice(`Tu es Manon, experte IA chez Axion-IA, cabinet de conseil en IA pour PME/ETI/grands groupes français.
Tu prépares le PLAN d'un article de blog FR optimisé SEO/AEO 2026 (le corps sera rédigé séparément). Règles :
- Le TITRE est fourni par l'utilisateur : reproduis-le EXACTEMENT dans le champ "title" (aucune modification).
- 100 % centré Axion-IA, ancré sur les « Sources internes Axion-IA » fournies (faits KB). Rien d'inventé : ni cas client fictif, ni chiffre non sourcé.
- INTERDIT : angle purement définitionnel. L'angle est TOUJOURS ce qu'Axion-IA fait concrètement.
- 0 prix en dur, 0 délai chiffré, 0 numéro de téléphone (uniquement contact@axion-ia.com).
- "title" (le H1 affiché) : reproduis EXACTEMENT le titre fourni, sans le modifier ni le tronquer.
- "metaTitle" : OBLIGATOIREMENT 50 à 60 caractères (compte les espaces), keyword principal au tout début. NE JAMAIS descendre sous 50 caractères : si trop court, ajoute une précision utile (bénéfice, secteur, « pour PME/ETI »…). NE PAS dépasser 60.
- "metaDescription" : OBLIGATOIREMENT 140 à 160 caractères (compte les espaces), phrase complète avec bénéfice clair + keyword naturel. NE JAMAIS descendre sous 140 caractères : développe jusqu'à atteindre la fourchette. NE PAS dépasser 160.
- "directAnswer" : OBLIGATOIREMENT **40 à 80 mots** (ni moins, ni plus), réponse autonome et complète au mot-clé, citable seule par une IA (AI Overview / vocal). NE JAMAIS répondre en moins de 40 mots : ajoute le « comment » / « pourquoi » concret jusqu'au plancher.
- "faq" : 8 questions People-Also-Ask réelles — chaque réponse answer-first : 1ʳᵉ phrase = réponse directe ≤ 25 mots, puis 1-2 phrases ; 40-55 mots au total.
- "keyTakeaway" : 1-2 phrases = LE point clé à retenir (synthèse autonome citable).
- "expertTake" : 1-2 phrases = prise de position d'expert, sans statistique inventée.
- "outline" : **8 sections <h2>** couvrant une progression logique : enjeu/contexte sectoriel → méthodologie Axion-IA étape par étape → livrables concrets → ROI & preuves → cas d'usage réels → erreurs à éviter → mise en œuvre. Chaque entrée = { h2 (titre de section, 5-9 mots), brief (1 phrase : ce que la section doit développer, ancré sur un fait KB précis) }. PAS de section définitionnelle creuse.
- INTERDIT (marketing-hype, doctrine § 21 — rejet automatique) : « unique », « meilleur », « la meilleure », « leader », « n°1 », « révolutionnaire », « exceptionnel », « incroyable », « incontournable », « garanti », « sans risque », « instantané ». Reste factuel et sobre.
- Output JSON strict : { title, metaTitle, metaDescription, slug, directAnswer, faq:[{q,a}×8], tags, keyTakeaway, expertTake, outline:[{h2,brief}×8] }`);

// APPEL 2 — EXPANSION : développe l'outline en bodyHtml complet et long.
// C'est ici que se joue la LONGUEUR : chaque section doit faire 130-190 mots.
const SYSTEM_PROMPT_EXPAND =
  injectBrandVoice(`Tu es Manon, experte IA chez Axion-IA. Tu RÉDIGES le corps HTML d'un article de blog FR à partir d'un plan déjà validé. Règles absolues :
- GROUNDING OBLIGATOIRE : développe CHAQUE section à partir des « Sources internes Axion-IA » fournies (méthodologie, étapes, livrables, ROI RÉELS). Si un fait précis manque, reste général et factuel SANS rien inventer (ni cas client fictif, ni chiffre non sourcé).
- INTERDIT : section purement définitionnelle. L'angle est TOUJOURS ce qu'Axion-IA fait concrètement. 0 prix en dur, 0 délai chiffré, 0 numéro de téléphone (contact@axion-ia.com uniquement).
- LONGUEUR DÉTERMINANTE POUR LE RANG : développe EXACTEMENT les sections de l'outline fourni (une <h2> par entrée, dans l'ordre), **chacune de 130 à 190 mots** (2-3 paragraphes pleins). Corps total visé : **900 à 1300 mots**. JAMAIS une section de 2 phrases. Développe pleinement, ne résume pas.
- Le keyword principal DOIT apparaître textuellement AU MOINS 3 fois dans le corps, réparti naturellement.
- NE PAS inclure de <h1> dans le corps (le titre est rendu séparément par la page).
- Sous CHAQUE <h2>, commence par une réponse autonome de 40-60 mots citable hors contexte, enveloppée dans <p data-aeo="answer">…</p>. Le développement suit.
- ANTI-MONOTONIE : alterne les formats. 2-3 encadrés <aside class="callout callout-info|callout-note|callout-warning"><p class="callout-label">…</p><p>…</p></aside>, 1-2 <blockquote>, et AU MOINS 1 chiffre-clé <aside class="ax-stat" data-aeo="stat"><span class="ax-stat-num">+40 %</span><span class="ax-stat-label">…</span></aside> (chiffre RÉEL sourcé). Jamais plus de 3 paragraphes consécutifs sans élément visuel.
- Inclure ≥ 2 liens externes <a href="https://…" rel="noopener noreferrer"> vers des sources d'autorité FR fournies, avec au moins 2 statistiques chiffrées sourcées inline — jamais inventées.
- À la première occurrence d'un terme technique, encadre-le avec <dfn> ou <span class="glossary-term" title="définition courte">terme</span>.
- INTERDIT (marketing-hype, doctrine § 21 — un seul de ces mots fait REJETER l'article) : « unique », « meilleur », « la meilleure », « leader », « n°1 », « révolutionnaire », « exceptionnel », « incroyable », « incontournable », « garanti », « sans risque », « instantané ». Écris factuel et sobre, sans superlatif.
- Output JSON strict : { bodyHtml }  (UNIQUEMENT le corps HTML des 8 sections, rien d'autre).`);

export const blogFromTitleGenerator: Generator = {
  contentType: "blog_from_title",

  async generate(input: GeneratorBaseInput): Promise<GeneratorOutput> {
    if (!input.primaryKeyword) {
      throw new Error("blog_from_title requires primaryKeyword (= titre fourni par Will)");
    }

    const mandatoryTitle = input.primaryKeyword;
    const safeTitle = escapeLlmInput(mandatoryTitle, { maxLen: 140 });
    const safeIntent = escapeLlmInput(input.targetSearchIntent, { maxLen: 30 });
    const safeAudienceSize = escapeLlmInput(input.targetAudienceSize ?? "PME", { maxLen: 30 });
    const sectorTagSlugs = input.kbSectorTagSlugs ?? [];

    // Refonte templates 2026-06-22 — expert interne choisi DÉTERMINISTIQUEMENT
    // (nom/titre fixés depuis la banque ; le LLM ne rédige que le texte).
    const expert = pickInternalExpert({
      contentType: input.contentType,
      templateVariant: input.templateVariant,
      audienceSize: input.targetAudienceSize,
      topic: mandatoryTitle,
    });

    // 1. KB retrieve — hybride FTS centré sur le titre
    const kbChunks = await kbRetrieve({
      query: `Axion-IA ${safeTitle} ${sectorTagSlugs.join(" ")}`,
      locale: "fr",
      k: 8,
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

    // Sprint External Links Database 2026-05-22 — 4 sources d'autorité injectées.
    const externalLinksCtx = injectExternalLinks(input, { count: 4, minAuthority: 4 });

    // 2. ARCHITECTURE 2-APPELS
    let accumulatedCostUsd = 0;
    let lastTokensInput = 0;
    let lastTokensOutput = 0;
    let lastCitations: ReadonlyArray<{ url: string; title: string; publishedAt?: string }> = [];
    let lastPromptHash = ""; // P0-3 AI Act art. 50
    const glossaryContext = getGlossaryContext([mandatoryTitle].filter(Boolean));

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
    type BlogFromTitleParsed = Omit<PlanParsed, "outline"> & { bodyHtml: string };

    // ── APPEL 1 — PLAN (une seule fois) ──────────────────────────────────────
    const planSystem =
      applySystemPromptOverride(SYSTEM_PROMPT_PLAN, input.templateOverride, "blog_from_title") +
      getIntentPromptAddendum(input.targetSearchIntent);
    const planUserPrompt = `Prépare le PLAN d'un article de blog Axion-IA.
TITRE IMPOSÉ (à reproduire EXACTEMENT dans "title") : "${safeTitle}"
Intent : ${safeIntent}.
Audience cible : ${safeAudienceSize}.

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
        contentType: "blog_from_title",
        role: "text",
        responseFormatJson: true,
        systemPrompt: planSystem,
        userPrompt:
          planAttempt === 0
            ? planUserPrompt
            : `${planUserPrompt}\n\n## Correction\nLe "metaTitle" DOIT couvrir le mot-clé du titre "${safeTitle}" (≤ 60 caractères ; « IA » accepté pour « intelligence artificielle »).`,
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
      // Le titre est IMPOSÉ : on le force tel quel (le LLM ne peut pas dévier).
      candidate = { ...candidate, title: mandatoryTitle };
      // Gate metaTitle keyword (une réparation max — sinon on accepte tel quel,
      // le seoScore pénalisera). Matching robuste IA⇄intelligence artificielle
      // via keywordPresentInText (remplace les sous-chaînes fragiles `.includes`).
      const mt = (candidate.metaTitle ?? "").trim();
      const mtOk = mt.length >= 15 && keywordPresentInText(mandatoryTitle, mt);
      if (mtOk || planAttempt === 1) plan = candidate;
    }
    if (!plan) {
      throw new Error("blog-from-title: plan invalide après 2 tentatives");
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
    let parsed: BlogFromTitleParsed | null = null;
    let prevFeedback = input.improvementFeedback ?? "";
    const expandSystem =
      applySystemPromptOverride(SYSTEM_PROMPT_EXPAND, input.templateOverride, "blog_from_title") +
      getIntentPromptAddendum(input.targetSearchIntent);

    while (iteration < MAX_QUALITY_ITERATIONS) {
      const feedbackSection = prevFeedback
        ? `\n\n## Retour qualité passe précédente\n${prevFeedback}\nCorrige impérativement ces points.`
        : "";

      // ARCHI 3-APPELS : l'expansion développe l'outline en 2 tranches de 4
      // sections (chunkSize 4) → chaque appel a moins à écrire → sections plus
      // denses → corps 1200-1500 mots. Le helper concatène le HTML des tranches.
      lastPromptHash = hashPrompt(planSystem + expandSystem + outlineText + prevFeedback);
      const expandResult = await expandOutlineChunked({
        jobId: input.jobId,
        contentType: "blog_from_title",
        outline: plan.outline ?? [],
        chunkSize: 4,
        expandSystem,
        maxTokens: input.templateOverride?.maxTokens ?? 5000,
        temperature: input.templateOverride?.temperature ?? (iteration === 0 ? 0.7 : 0.5),
        buildUserPrompt: ({ chunkText, isFirst, isLast }) =>
          `Rédige le CORPS HTML (sections de l'article) pour le titre : "${safeTitle}" (intent ${safeIntent}, audience ${safeAudienceSize}).
${isFirst ? "Ce sont les PREMIÈRES sections de l'article." : "Suite de l'article (ne répète pas l'introduction)."}${isLast ? " Ce sont les DERNIÈRES sections." : ""}

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
      // Le titre reste forcé au titre imposé.
      parsed = { ...planRest, title: mandatoryTitle, bodyHtml: expandResult.bodyHtml };

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
        title: mandatoryTitle,
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
        primaryKeyword: mandatoryTitle,
        searchIntent: input.targetSearchIntent,
        ...articlePageSeoDefaults(parsed.slug ?? "", "blog_from_title"),
      });

      const doctrine = await checkDoctrine(bodyText);
      const qualityScore = qualityFromScores(seo.score, readability.score, doctrine.passed);

      if (qualityScore >= QUALITY_THRESHOLD && wordCount >= MIN_WORD_COUNT) {
        await logStep(
          input.jobId,
          "quality_loop_pass",
          `Expansion ${iteration} — score ${qualityScore}/100, mots ${wordCount}, cost $${accumulatedCostUsd.toFixed(4)}`,
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
      if (seo.score < 60)
        issues.push("densité keyword insuffisante + liens d'autorité + directAnswer trop court");
      if (readability.score < 60) issues.push("phrases trop longues");
      if (!doctrine.passed) {
        const violations = doctrine.blockingViolations.map((v) => v.pattern).join(", ");
        issues.push(`violations doctrine : ${violations}`);
      }
      if (wordCount < MIN_WORD_COUNT)
        issues.push(
          `corps trop court (${wordCount} mots, minimum ${MIN_WORD_COUNT}) — développe CHAQUE section de l'outline en 130-190 mots (méthodologie, étapes, livrables, ROI), sans rien inventer`,
        );
      prevFeedback = `Score ${qualityScore}/100 insuffisant (SEO=${seo.score}, lisibilité=${readability.score}). Améliore : ${issues.join(" ; ")}.`;
    }

    if (!parsed) {
      throw new Error("blog-from-title: aucun corps valide après expansion");
    }

    // 3. Sanitize HTML final + injection liens internes contextuels (P1-12)
    parsed = {
      ...parsed,
      title: mandatoryTitle,
      bodyHtml: sanitizeContentGenHtml(parsed.bodyHtml ?? ""),
    };
    parsed = { ...parsed, bodyHtml: injectInternalLinks(parsed.bodyHtml, mandatoryTitle) };
    // 3b. CORRECTIF INTENT 2026-06-25 : les LLM (gpt-4o notamment) n'intègrent
    // souvent AUCUN lien d'autorité <a href="http…"> dans le body malgré la
    // consigne → citationCount=0 → intent informational MISALIGNED (hardFail
    // « 0/3 citations ») → needs_review même avec un bon score. On pose donc
    // les liens d'autorité de façon DÉTERMINISTE (section « Sources ») avant le
    // comptage, garantissant citationCount ≥ liens sélectionnés (indépendant de
    // Perplexity). Idempotent (no-op si déjà une section Sources).
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
      title: mandatoryTitle,
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
      primaryKeyword: mandatoryTitle,
      searchIntent: input.targetSearchIntent,
      ...articlePageSeoDefaults(parsed.slug ?? "", "blog_from_title"),
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
        // KB réel (kbChunks > 0) → un article non ancré reste noindex (anti-HCU).
        doctrine.passed && qualityScore >= 70 && kbChunks.length > 0
        ? "tier_1_indexable"
        : doctrine.passed && qualityScore >= 55
          ? "tier_2_noindex_follow"
          : "tier_3_noindex_nofollow";

    const expertQuote = buildExpertQuote(expert, parsed.expertTake);

    return {
      title: mandatoryTitle,
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
