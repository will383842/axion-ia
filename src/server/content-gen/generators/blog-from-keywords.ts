/**
 * Generator — article de blog depuis un seed de mot-clé (Sprint 2 AGT-C).
 *
 * Pipeline :
 * 1. KB retrieve top 8 chunks (hybride FTS + sectoriel)
 * 2. LLM génération blog article (OpenAI → Anthropic fallback)
 * 3. Quality loop : si qualityScore < QUALITY_THRESHOLD → regénère avec
 *    feedback ciblé jusqu'à MAX_QUALITY_ITERATIONS ou BUDGET_CAP_USD
 * 4. Checks finaux (readability + SEO + doctrine + soft-404)
 * 5. Return GeneratorOutput
 *
 * Différences vs landing-ville :
 * - primaryKeyword obligatoire (pas anchorVilleSlug)
 * - contentKind "article" (word count ≥ 800, tier_1 accessible)
 * - Quality loop actif (log steps quality_loop_*)
 */

import { generate as routerGenerate } from "../providers/provider-router";
import { hashPrompt } from "../provenance/provenance-logger";
import { retrieve as kbRetrieve } from "../kb-client";
import { computeReadabilityFr } from "../quality/readability";
import { computeSeoScore } from "../quality/seo-score";
import { articlePageSeoDefaults, qualityFromScores } from "../quality/article-quality";
import { checkDoctrine } from "../quality/doctrine-check";
import { evaluateSoft404 } from "../quality/soft-404-gate";
import { sanitizeContentGenHtml } from "../shared/html-sanitizer";
import { parseLlmJson } from "../shared/parse-llm-json";
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

const QUALITY_THRESHOLD = 60;
const MAX_QUALITY_ITERATIONS = 3;
const BUDGET_CAP_USD = 0.15;

const SYSTEM_PROMPT =
  injectBrandVoice(`Tu es Manon, experte IA chez Axion-IA, cabinet de conseil en IA pour TPE/PME/ETI françaises.
Produis un article de blog en français optimisé SEO/AEO 2026. Règles absolues :
- 100 % centré Axion-IA : chaque paragraphe ancre une valeur ou preuve concrète.
- 0 délai chiffré, 0 mention de frais de déplacement, 0 prix en dur.
- 0 numéro de téléphone : utiliser uniquement contact@axion-ia.com.
- Anti-doorway HCU 2024 : minimum 500 mots de contenu substantiel.
- 6 à 8 questions FAQ réelles (People-Also-Ask) optimisées Featured Snippet — chaque réponse au format answer-first : 1ère phrase = réponse directe autonome (≤ 25 mots, citable seule pour PAA/vocal), puis 1-2 phrases de précision ; 40 à 55 mots au total.
- ANTI-MONOTONIE (lisibilité 2026 — éviter le mur de texte) : alterne les formats dans le corps. Répartis 2 à 3 encadrés <aside class="callout callout-info|callout-note|callout-warning"><p class="callout-label">…</p><p>…</p></aside>, 1 à 2 citations détachées <blockquote>, et AU MOINS 1 bloc chiffre-clé <aside class="ax-stat" data-aeo="stat"><span class="ax-stat-num">+40 %</span><span class="ax-stat-label">…</span></aside> (chiffre RÉEL sourcé, jamais inventé). Jamais plus de 3 paragraphes consécutifs sans élément visuel (encadré, citation, liste ou chiffre-clé).
- Le keyword principal DOIT apparaître textuellement dans le H1. Sans cela l'article sera rejeté.
- Inclure OBLIGATOIREMENT ≥ 2 liens externes vers des sources d'autorité FR (INSEE, DARES, BPI France, France Num, rapport McKinsey, Stanford AI Index, EU AI Act eur-lex.europa.eu, etc.) avec rel="noopener noreferrer". Les AI Overviews Google et Perplexity citent prioritairement les articles sourcés.
- Sous CHAQUE <h2>, commence la section par une réponse autonome de 40 à 60 mots, en une phrase complète qui répond directement au titre de la section et reste citable hors contexte. Enveloppe-la dans <p data-aeo="answer">…</p>. Le reste du développement suit ensuite.
- Inclure au moins 2 statistiques chiffrées récentes avec source nommée et lien inline (ex. « 31 % des PME… (DARES, 2024) [lien] »), UNIQUEMENT issues des sources internes/d'autorité fournies — jamais inventées.
- À la première occurrence d'un terme technique, encadre-le avec <dfn> ou <span class="glossary-term" title="définition courte">terme</span>.
- Quand c'est pertinent (1 à 2 max), utilise un encadré : <aside class="callout callout-warning"><p class="callout-label">Attention</p><p>…</p></aside>. Variantes de classe : callout-info, callout-note, callout-warning, callout-danger.
- "metaTitle": "50-60 caractères MAX, keyword principal inclus au début"
- "metaDescription": "140-155 caractères, phrase complète avec bénéfice clair, keyword naturel inclus"
- "keyTakeaway": 1 à 2 phrases = LE point clé à retenir (synthèse autonome, citable telle quelle par une IA).
- "expertTake": 1 à 2 phrases = prise de position d'expert (perspective/insight concret), SANS statistique inventée, signée par l'expert nommé dans le prompt utilisateur.
- Output JSON strict : { title, metaTitle, metaDescription, slug, directAnswer, bodyHtml, faq:[{q,a}], tags, keyTakeaway, expertTake }`);

export const blogFromKeywordsGenerator: Generator = {
  contentType: "blog_from_keywords",

  async generate(input: GeneratorBaseInput): Promise<GeneratorOutput> {
    if (!input.primaryKeyword) {
      throw new Error("blog_from_keywords requires primaryKeyword");
    }

    const safePrimaryKeyword = escapeLlmInput(input.primaryKeyword, { maxLen: 120 });
    const safeModule = escapeLlmInput(input.templateVariant ?? "transversal", { maxLen: 50 });
    const safeIntent = escapeLlmInput(input.targetSearchIntent, { maxLen: 30 });
    const safeAudienceSize = escapeLlmInput(input.targetAudienceSize ?? "PME", { maxLen: 30 });
    const sectorTagSlugs = input.kbSectorTagSlugs ?? [];
    const secondaryList = (input.secondaryKeywords ?? []).slice(0, 5).join(", ");

    // Refonte templates 2026-06-22 — expert interne choisi DÉTERMINISTIQUEMENT
    // (nom/titre fixés depuis la banque ; le LLM ne rédige que le texte).
    const expert = pickInternalExpert({
      contentType: input.contentType,
      templateVariant: input.templateVariant,
      audienceSize: input.targetAudienceSize,
      topic: input.primaryKeyword,
    });

    // 1. KB retrieve — hybride FTS centré sur le keyword + secteur
    const kbChunks = await kbRetrieve({
      query: `Axion-IA ${safePrimaryKeyword} ${sectorTagSlugs.join(" ")}`,
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

    // 2. Quality loop
    let iteration = 0;
    let accumulatedCostUsd = 0;
    let lastOutput: string = "";
    type BlogFromKeywordsParsed = {
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
    let parsed: BlogFromKeywordsParsed | null = null;
    let lastTokensInput = 0;
    let lastTokensOutput = 0;
    let lastCitations: ReadonlyArray<{ url: string; title: string; publishedAt?: string }> = [];
    let prevFeedback = input.improvementFeedback ?? "";
    let lastPromptHash = ""; // P0-3 AI Act art. 50
    // P1-7 — Contexte glossaire IA (60 termes) injecté dans userPrompt.
    const glossaryContext = getGlossaryContext(
      [input.primaryKeyword, ...(input.secondaryKeywords ?? [])].filter((k): k is string => !!k),
    );

    while (iteration < MAX_QUALITY_ITERATIONS) {
      const feedbackSection = prevFeedback
        ? `\n\n## Retour qualité passe précédente\n${prevFeedback}\nCorrige impérativement ces points.`
        : "";

      const userPrompt = `Génère un article de blog Axion-IA pour le mot-clé : "${safePrimaryKeyword}".
Module de service : ${safeModule}.
Intent : ${safeIntent}.
Audience cible : ${safeAudienceSize}.
${secondaryList ? `Keywords secondaires : ${secondaryList}.` : ""}

## Sources internes Axion-IA (à citer en priorité)
${kbContext}
${externalLinksCtx.markdownSection}${feedbackSection}
${glossaryContext ? `\n${glossaryContext}` : ""}
## Avis d'expert
"expertTake" = une prise de position de ${expert.name} (${expert.title}) : perspective d'expert concise et utile sur le sujet, sans chiffre inventé.
## Output attendu (JSON)
{ title, metaTitle, metaDescription, slug, directAnswer, bodyHtml, faq:[{q,a}×8], tags, keyTakeaway, expertTake }`;

      const effectiveSystem = applySystemPromptOverride(
        SYSTEM_PROMPT,
        input.templateOverride,
        "blog_from_keywords",
      );
      lastPromptHash = hashPrompt(
        effectiveSystem + getIntentPromptAddendum(input.targetSearchIntent) + userPrompt,
      );

      const llmResult = await routerGenerate({
        jobId: input.jobId,
        contentType: "blog_from_keywords",
        role: "text",
        systemPrompt: effectiveSystem + getIntentPromptAddendum(input.targetSearchIntent),
        userPrompt,
        maxTokens: input.templateOverride?.maxTokens ?? 4096,
        temperature: input.templateOverride?.temperature ?? (iteration === 0 ? 0.7 : 0.5),
      });

      accumulatedCostUsd += llmResult.costUsd;
      lastTokensInput = llmResult.tokensInput;
      lastTokensOutput = llmResult.tokensOutput;
      lastCitations = llmResult.citations ?? [];
      lastOutput = llmResult.output;
      iteration++;

      // Parse JSON
      try {
        parsed = parseLlmJson<BlogFromKeywordsParsed>(lastOutput);
      } catch {
        prevFeedback =
          "La réponse précédente n'était pas du JSON valide. Retourne UNIQUEMENT un objet JSON valide, sans balise markdown.";
        if (accumulatedCostUsd >= BUDGET_CAP_USD) {
          await logStep(
            input.jobId,
            "quality_loop_budget_cap_reached",
            `Budget cap $${BUDGET_CAP_USD} atteint après ${iteration} passes (JSON invalide)`,
            { accumulatedCostUsd, iteration },
          );
          break;
        }
        continue;
      }

      // Guard TypeScript : catch block always continues, so parsed is non-null here
      if (!parsed) continue;

      // P1-2 — Gate keyword dans H1.
      if (input.primaryKeyword) {
        const kw = input.primaryKeyword.toLowerCase();
        const h1Match = /<h1[^>]*>(.*?)<\/h1>/i.exec(parsed.bodyHtml ?? "");
        const h1Text = (h1Match?.[1] ?? "").replace(/<[^>]+>/g, "").toLowerCase();
        if (!h1Text.includes(kw)) {
          prevFeedback = `H1 "${h1Match?.[1] ?? "(absent)"}" ne contient pas le keyword "${input.primaryKeyword}". Le keyword DOIT apparaître textuellement dans le H1.`;
          if (accumulatedCostUsd >= BUDGET_CAP_USD || iteration >= MAX_QUALITY_ITERATIONS) break;
          continue;
        }
      }

      // Gate metaTitle LENIENT — snippet SERP : le metaTitle ne doit pas être
      // vide et doit contenir le mot-clé principal (sinon SERP faible).
      if (input.primaryKeyword) {
        const mt = (parsed.metaTitle ?? "").trim();
        if (mt.length < 15 || !mt.toLowerCase().includes(input.primaryKeyword.toLowerCase())) {
          prevFeedback = `Le metaTitle "${mt || "(vide)"}" doit contenir le mot-clé "${input.primaryKeyword}" (50-60 caractères, mot-clé au début).`;
          if (accumulatedCostUsd >= BUDGET_CAP_USD || iteration >= MAX_QUALITY_ITERATIONS) break;
          continue;
        }
      }

      // Score rapide pour décider de boucler
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
        directAnswer: parsed.directAnswer,
        faqCount: (parsed.faq ?? []).length,
        internalLinkCount,
        citationCount,
        primaryKeyword: input.primaryKeyword,
        searchIntent: input.targetSearchIntent,
        ...articlePageSeoDefaults(parsed.slug ?? "", "blog_from_keywords"),
      });

      // Doctrine check une seule fois par pass (appel Prisma)
      const doctrine = await checkDoctrine(bodyText);

      const qualityScore = qualityFromScores(seo.score, readability.score, doctrine.passed);

      if (qualityScore >= QUALITY_THRESHOLD) {
        await logStep(
          input.jobId,
          "quality_loop_pass",
          `Pass ${iteration} — score ${qualityScore}/100, mots ${wordCount}, cost $${accumulatedCostUsd.toFixed(4)}`,
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

      if (iteration >= MAX_QUALITY_ITERATIONS) {
        await logStep(
          input.jobId,
          "quality_loop_cap_reached",
          `Cap ${MAX_QUALITY_ITERATIONS} passes atteint — score final ${qualityScore}/100`,
          { qualityScore, seoScore: seo.score, readabilityScore: readability.score },
        );
        break;
      }

      // Prépare le feedback ciblé pour la prochaine passe
      const issues: string[] = [];
      if (seo.score < 60)
        issues.push("keyword density insuffisante + FAQ manquante + directAnswer trop court");
      if (readability.score < 60) issues.push("phrases trop longues + sous-titres H2 insuffisants");
      if (!doctrine.passed) {
        const violations = doctrine.blockingViolations.map((v) => v.pattern).join(", ");
        issues.push(`violations doctrine : ${violations}`);
      }
      if (wordCount < 500) issues.push(`contenu trop court (${wordCount} mots, minimum 500)`);
      prevFeedback = `Score ${qualityScore}/100 insuffisant (SEO=${seo.score}, lisibilité=${readability.score}). Améliore : ${issues.join(" ; ")}.`;
    }

    if (!parsed) {
      throw new Error("blog-from-keywords: aucun output valide après quality loop");
    }

    // 3. Sanitize HTML final + injection liens internes contextuels (P1-12)
    parsed = { ...parsed, bodyHtml: sanitizeContentGenHtml(parsed.bodyHtml ?? "") };
    if (input.primaryKeyword) {
      parsed = { ...parsed, bodyHtml: injectInternalLinks(parsed.bodyHtml, input.primaryKeyword) };
    }

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
      directAnswer: parsed.directAnswer,
      faqCount: (parsed.faq ?? []).length,
      internalLinkCount: finalInternalLinkCount,
      citationCount: finalCitationCount,
      primaryKeyword: input.primaryKeyword,
      searchIntent: input.targetSearchIntent,
      ...articlePageSeoDefaults(parsed.slug ?? "", "blog_from_keywords"),
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
      : doctrine.passed && qualityScore >= 70
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
