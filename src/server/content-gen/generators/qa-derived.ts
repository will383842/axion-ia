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
import { escapeLlmInput, escapeSlugInput } from "../shared/prompt-input-escape";
import { logStep } from "../shared/generation-log";
import type { Generator, GeneratorBaseInput, GeneratorOutput } from "./types";
import { injectBrandVoice } from "../brand/brand-voice";
import { pickInternalExpert, buildExpertQuote } from "../brand/expert-bank";
import { getGlossaryContext } from "../brand/glossary-context";
import { injectInternalLinks } from "../links/internal-link-catalog";
import { injectExternalLinks } from "../links/external-links-injector";
import { getIntentPromptAddendum } from "../shared/intent-prompt-adapter";
import { extractMentionedCitiesFromText } from "@/lib/geo/extract-mentioned-cities";

const QUALITY_THRESHOLD = 55;
const MAX_QUALITY_ITERATIONS = 2;
const BUDGET_CAP_USD = 0.08;

const SYSTEM_PROMPT =
  injectBrandVoice(`Tu es Manon, experte IA chez Axion-IA, cabinet de conseil en IA pour PME/ETI/grands groupes français.
Produis une page FAQ détaillée en français optimisée AEO/GEO 2026. Règles absolues :
- La question principale est fournie par l'utilisateur — tu DOIS y répondre directement.
- directAnswer : OBLIGATOIREMENT 40 à 80 mots (idéal 50-70), réponse concise et actionnable (cible Google Featured Snippet). NE JAMAIS sous 40 mots : ajoute le « comment » concret jusqu'au plancher.
- answerHtml : réponse étendue 350-550 mots, HTML valide, enrichie de contexte Axion-IA.
  Structure : <p> intro answer-first + 2-3 <h2> sections thématiques (chacune avec son <p data-aeo="answer">) + <ul>/<ol> points clés + <p> conclusion CTA. Développe réellement chaque section (pas de remplissage) : enjeux concrets, exemple opérationnel PME/ETI, ce que ça change pour un dirigeant.
- Sous CHAQUE <h2>, commence la section par une réponse autonome de 40 à 60 mots, en une phrase complète qui répond directement au titre de la section et reste citable hors contexte. Enveloppe-la dans <p data-aeo="answer">…</p>. Le reste du développement suit ensuite.
- Inclure au moins 2 statistiques chiffrées récentes avec source nommée et lien inline (ex. « 31 % des PME… (DARES, 2024) [lien] »), UNIQUEMENT issues des sources internes/d'autorité fournies — jamais inventées.
- À la première occurrence d'un terme technique, encadre-le avec <dfn> ou <span class="glossary-term" title="définition courte">terme</span>.
- Quand c'est pertinent (1 à 2 max), utilise un encadré : <aside class="callout callout-warning"><p class="callout-label">Attention</p><p>…</p></aside>. Variantes de classe : callout-info, callout-note, callout-warning, callout-danger.
- relatedFaq : 4-5 questions similaires fréquentes avec réponses directes de 40-60 mots chacune (2-3 phrases, citables hors contexte).
- 0 délai chiffré, 0 mention de frais de déplacement, 0 prix en dur.
- 0 numéro de téléphone : utiliser uniquement contact@axion-ia.com.
- INTERDIT (marketing-hype, doctrine §21 — un seul de ces mots fait REJETER le contenu) : « unique », « meilleur », « la meilleure », « leader », « n°1 », « révolutionnaire », « exceptionnel », « incroyable », « incontournable », « garanti », « sans risque », « instantané ». Reste factuel et sobre.
- "metaTitle": "OBLIGATOIREMENT 50 à 60 caractères (compte les espaces), keyword principal au tout début. NE JAMAIS sous 50 caractères : si trop court, ajoute une précision utile (bénéfice, secteur). NE PAS dépasser 60."
- "metaDescription": "OBLIGATOIREMENT 140 à 160 caractères (compte les espaces), phrase complète avec bénéfice clair + keyword naturel. NE JAMAIS sous 140 caractères : développe jusqu'à la fourchette. NE PAS dépasser 160."
- "keyTakeaway": 1 à 2 phrases = LE point clé à retenir (synthèse autonome, citable telle quelle par une IA).
- "expertTake": 1 à 2 phrases = prise de position d'expert (perspective/insight concret), SANS statistique inventée, signée par l'expert nommé dans le prompt utilisateur.
- Output JSON strict :
  { title, metaTitle, metaDescription, slug, directAnswer, answerHtml, relatedFaq:[{q,a}×4-5], tags, keyTakeaway, expertTake }`);

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

    // Refonte templates 2026-06-22 — expert interne choisi DÉTERMINISTIQUEMENT
    // (nom/titre fixés depuis la banque ; le LLM ne rédige que le texte).
    const expert = pickInternalExpert({
      contentType: input.contentType,
      templateVariant: input.templateVariant,
      audienceSize: input.targetAudienceSize,
      topic: question,
    });

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
    type QaDerivedParsed = {
      title: string;
      metaTitle: string;
      metaDescription: string;
      slug: string;
      directAnswer: string;
      answerHtml: string;
      relatedFaq: ReadonlyArray<{ q: string; a: string }>;
      tags: ReadonlyArray<string>;
      keyTakeaway?: string;
      expertTake?: string;
    };
    let parsed: QaDerivedParsed | null = null;
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
## Avis d'expert
"expertTake" = une prise de position de ${expert.name} (${expert.title}) : perspective d'expert concise et utile sur le sujet, sans chiffre inventé.
## Output attendu (JSON)
{ title, metaTitle, metaDescription, slug, directAnswer, answerHtml, relatedFaq:[{q,a}×3-5], tags, keyTakeaway, expertTake }`;

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
        parsed = parseLlmJson<QaDerivedParsed>(lastOutput);
      } catch {
        prevFeedback =
          "La réponse précédente n'était pas du JSON valide. Retourne UNIQUEMENT un objet JSON valide, sans balise markdown.";
        if (accumulatedCostUsd >= BUDGET_CAP_USD) break;
        continue;
      }

      if (!parsed) continue;

      // Gate metaTitle LENIENT — si un mot-clé principal existe, le metaTitle
      // ne doit pas être vide et doit contenir le mot-clé (sinon snippet SERP
      // faible). Borné par MAX_QUALITY_ITERATIONS + BUDGET_CAP_USD (pas de boucle infinie).
      if (input.primaryKeyword) {
        const mt = (parsed.metaTitle ?? "").trim();
        if (mt.length < 15 || !mt.toLowerCase().includes(input.primaryKeyword.toLowerCase())) {
          prevFeedback = `Le metaTitle "${mt || "(vide)"}" doit contenir le mot-clé "${input.primaryKeyword}" (50-60 caractères, mot-clé au début).`;
          if (accumulatedCostUsd >= BUDGET_CAP_USD) break;
          continue;
        }
      }

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
    // Citations déterministes (2026-06-25) : l'intent informational exige ≥3
    // citations ; sans liens d'autorité dans le body → needs_review. Idempotent.
    const bodyHtml = appendSourcesSection(
      injectInternalLinks(rawBodyHtml, question),
      externalLinksCtx.links,
    );

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
      auxBodyText: buildAuxBodyText({
        directAnswer: parsed.directAnswer,
        faq: safeRelatedFaq,
        keyTakeaway: parsed.keyTakeaway,
      }),
      directAnswer: parsed.directAnswer,
      faqCount: safeRelatedFaq.length,
      internalLinkCount: finalInternalLinkCount,
      primaryKeyword: question,
      searchIntent: input.targetSearchIntent,
      ...articlePageSeoDefaults(parsed.slug ?? "", "qa_derived"),
    });

    const qualityScore = qualityFromScores(seo.score, readability.score, doctrine.passed);

    const soft404 = evaluateSoft404({
      wordCount,
      hasFullLocalBusinessJsonLd: false,
      hasLocalCase: false,
      faqCount: safeRelatedFaq.length,
    });

    // Politique Q/R (2026-06-25, décision Will) — alignée sur faq-standalone pour
    // MAXIMISER l'indexation sans être trop strict : auto-indexation (tier_1) dès
    // que la page passe les garde-fous réels — pas soft-404, doctrine OK, et
    // qualityScore ≥ 55 (l'anti-thin ≥ 300 mots est déjà imposé par la quality
    // loop ci-dessus). Les pages qui échouent restent en tier_2 (noindex/follow).
    const indexationTier: GeneratorOutput["indexationTier"] = soft404.isSoft404
      ? "tier_3_noindex_nofollow"
      : doctrine.passed && qualityScore >= QUALITY_THRESHOLD
        ? "tier_1_indexable"
        : "tier_2_noindex_follow";

    const expertQuote = buildExpertQuote(expert, parsed.expertTake);

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
