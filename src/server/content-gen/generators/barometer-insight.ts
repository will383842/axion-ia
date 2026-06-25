/**
 * Generator — `barometer_insight` (Observatoire IA 2026).
 *
 * Article d'analyse ANCRÉ sur les chiffres RÉELS du `BarometerSnapshot`. Le
 * snapshot est injecté comme bloc « DONNÉES VÉRIFIÉES — NE PAS MODIFIER »
 * (même doctrine que `local-anchor`) : le modèle ne cite QUE ces chiffres et
 * attribue « Observatoire Axion-IA 2026 ». Aucune invention de statistique.
 *
 * Si le snapshot est vide (aucune réponse réelle), la génération échoue
 * explicitement — on ne produit JAMAIS d'article à partir de chiffres absents.
 */

import { generate as routerGenerate } from "../providers/provider-router";
import { hashPrompt } from "../provenance/provenance-logger";
import { computeReadabilityFr } from "../quality/readability";
import { articlePageSeoDefaults, qualityFromScores } from "../quality/article-quality";
import { computeSeoScore } from "../quality/seo-score";
import { checkDoctrine } from "../quality/doctrine-check";
import { evaluateSoft404 } from "../quality/soft-404-gate";
import { sanitizeContentGenHtml } from "../shared/html-sanitizer";
import { parseLlmJson } from "../shared/parse-llm-json";
import { escapeLlmInput } from "../shared/prompt-input-escape";
import { logStep } from "../shared/generation-log";
import type { Generator, GeneratorBaseInput, GeneratorOutput } from "./types";
import { injectBrandVoice } from "../brand/brand-voice";
import { pickInternalExpert, buildExpertQuote } from "../brand/expert-bank";
import { injectInternalLinks } from "../links/internal-link-catalog";
import { injectExternalLinks } from "../links/external-links-injector";
import { getIntentPromptAddendum } from "../shared/intent-prompt-adapter";
import {
  readLatestSnapshot,
  countRealResponses,
  type BarometerSnapshotPayload,
} from "@/server/observatoire/snapshot";
import { STUDY_NAME_FR, STUDY_ATTRIBUTION } from "@/content/observatoire/study";

const QUALITY_THRESHOLD = 60;
const MAX_QUALITY_ITERATIONS = 3;
const BUDGET_CAP_USD = 0.15;

const INSIGHT_SENTENCE: Record<string, string> = {
  competitors_use_ai: "pensent que leurs concurrents utilisent déjà l'IA",
  no_formal_strategy: "n'ont pas de stratégie IA formalisée",
  rgpd_concern: "sont préoccupées par la souveraineté de leurs données",
  investment_intent: "prévoient d'augmenter leur budget IA",
};

const SYSTEM_PROMPT =
  injectBrandVoice(`Tu es Manon, experte IA chez Axion-IA. Rédige un article d'ANALYSE en français, optimisé SEO/AEO 2026, qui commente les résultats de « ${STUDY_NAME_FR} ».
Règles absolues :
- Tu ne cites QUE les chiffres présents dans le bloc « DONNÉES VÉRIFIÉES » fourni. Tu n'inventes AUCUN pourcentage, AUCUN effectif, AUCune donnée.
- Chaque chiffre cité est attribué à « Observatoire Axion-IA 2026 ».
- Si un angle n'est pas couvert par les données, tu restes qualitatif (pas de chiffre inventé).
- Angle opérationnel : ce que ces chiffres impliquent concrètement pour un dirigeant de TPE/PME/ETI française.
- 0 délai chiffré, 0 frais de déplacement, 0 prix en dur, 0 numéro de téléphone (contact@axion-ia.com uniquement).
- Anti-doorway HCU 2024 : minimum 600 mots de contenu substantiel, H2 structurants.
- Chaque H2 d'un constat chiffré commence par le chiffre, en phrase autoportante (ex. « 59 % des entreprises… »).
- 6 à 8 questions FAQ (People-Also-Ask) optimisées Featured Snippet — réponse answer-first : 1ère phrase directe autonome (≤ 25 mots, citable seule), puis 1-2 phrases ; 40 à 55 mots au total.
- ≥ 2 liens externes vers des sources d'autorité FR (INSEE, France Num, BPI France, etc.), rel="noopener noreferrer".
- "metaTitle": 50-60 caractères, "metaDescription": 140-155 caractères.
- "keyTakeaway": 1 à 2 phrases = LE point clé à retenir (synthèse autonome, citable telle quelle par une IA).
- "expertTake": 1 à 2 phrases = prise de position d'expert (perspective/insight concret), SANS statistique inventée, signée par l'expert nommé dans le prompt utilisateur.
- Output JSON strict : { title, metaTitle, metaDescription, slug, directAnswer, bodyHtml, faq:[{q,a}], tags, keyTakeaway, expertTake }`);

function buildVerifiedDataBlock(s: BarometerSnapshotPayload): string {
  const lines: string[] = [
    `Échantillon : ${s.totalResponses} répondants (entreprises françaises).`,
  ];
  for (const [key, sentence] of Object.entries(INSIGHT_SENTENCE)) {
    const v = s.insights?.[key];
    if (typeof v === "number" && v > 0) lines.push(`- ${v} % ${sentence}.`);
  }
  // Quelques distributions clés (maturité, budget) pour étoffer l'analyse.
  const addDist = (id: string, label: string) => {
    const dist = s.distributions?.[id];
    if (!dist || dist.length === 0) return;
    const top = dist
      .map((d) => `${d.value}=${d.pct}%`)
      .slice(0, 7)
      .join(", ");
    lines.push(`- Répartition ${label} : ${top}.`);
  };
  addDist("maturityLevel", "maturité IA");
  addDist("annualBudget", "budget IA annuel");
  addDist("barriers", "principaux freins");
  return [
    "=== DONNÉES VÉRIFIÉES — Observatoire Axion-IA 2026 (NE PAS MODIFIER, citer la source) ===",
    ...lines,
    `Attribution obligatoire : « ${STUDY_ATTRIBUTION} ».`,
    "=== FIN DONNÉES VÉRIFIÉES ===",
  ].join("\n");
}

type BarometerParsed = {
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

export const barometerInsightGenerator: Generator = {
  contentType: "barometer_insight",

  async generate(input: GeneratorBaseInput): Promise<GeneratorOutput> {
    // Intégrité : la garde porte sur le compte RÉEL (hors fixture seed `seed:%`),
    // pas sur `snapshot.totalResponses` qui inclut le seed dev (8627). Sans ça,
    // une base seedée publierait des chiffres fabriqués comme une vraie étude.
    const [snapshot, realResponses] = await Promise.all([
      readLatestSnapshot(),
      countRealResponses(),
    ]);
    if (!snapshot || realResponses === 0) {
      throw new Error(
        "barometer_insight: aucune réponse réelle (hors seed) — génération refusée (jamais de chiffre fabriqué).",
      );
    }

    const verifiedData = buildVerifiedDataBlock(snapshot);
    const topic =
      input.primaryKeyword ?? "état de l'adoption de l'IA dans les entreprises françaises 2026";
    const safeTopic = escapeLlmInput(topic, { maxLen: 140 });

    // Refonte templates 2026-06-22 — expert interne choisi DÉTERMINISTIQUEMENT
    // (nom/titre fixés depuis la banque ; le LLM ne rédige que le texte).
    const expert = pickInternalExpert({
      contentType: input.contentType,
      templateVariant: input.templateVariant,
      audienceSize: input.targetAudienceSize,
      topic,
    });

    const externalLinksCtx = injectExternalLinks(input, { count: 4, minAuthority: 4 });

    let iteration = 0;
    let accumulatedCostUsd = 0;
    let lastOutput = "";
    let parsed: BarometerParsed | null = null;
    let lastTokensInput = 0;
    let lastTokensOutput = 0;
    let lastCitations: ReadonlyArray<{ url: string; title: string; publishedAt?: string }> = [];
    let prevFeedback = input.improvementFeedback ?? "";
    let lastPromptHash = "";

    while (iteration < MAX_QUALITY_ITERATIONS) {
      const feedbackSection = prevFeedback
        ? `\n\n## Retour qualité passe précédente\n${prevFeedback}\nCorrige impérativement ces points.`
        : "";

      const userPrompt = `Rédige un article d'analyse Axion-IA commentant l'Observatoire de l'IA 2026 — angle : "${safeTopic}".

${verifiedData}
${externalLinksCtx.markdownSection}${feedbackSection}
## Avis d'expert
"expertTake" = une prise de position de ${expert.name} (${expert.title}) : perspective d'expert concise et utile sur le sujet, sans chiffre inventé.
## Output attendu (JSON)
{ title, metaTitle, metaDescription, slug, directAnswer, bodyHtml, faq:[{q,a}×6-8], tags, keyTakeaway, expertTake }`;

      const systemFull = SYSTEM_PROMPT + getIntentPromptAddendum(input.targetSearchIntent);
      lastPromptHash = hashPrompt(systemFull + userPrompt);

      const llmResult = await routerGenerate({
        jobId: input.jobId,
        contentType: "barometer_insight",
        role: "text",
        systemPrompt: systemFull,
        userPrompt,
        maxTokens: input.templateOverride?.maxTokens ?? 4096,
        temperature: input.templateOverride?.temperature ?? (iteration === 0 ? 0.6 : 0.4),
      });

      accumulatedCostUsd += llmResult.costUsd;
      lastTokensInput = llmResult.tokensInput;
      lastTokensOutput = llmResult.tokensOutput;
      lastCitations = llmResult.citations ?? [];
      lastOutput = llmResult.output;
      iteration++;

      try {
        parsed = parseLlmJson<BarometerParsed>(lastOutput);
      } catch {
        prevFeedback =
          "La réponse précédente n'était pas du JSON valide. Retourne UNIQUEMENT un objet JSON valide.";
        if (accumulatedCostUsd >= BUDGET_CAP_USD) break;
        continue;
      }
      if (!parsed) continue;

      // Gate metaTitle LENIENT — uniquement si un mot-clé principal existe.
      // Un metaTitle vide ou sans le mot-clé donne un snippet SERP faible.
      if (input.primaryKeyword) {
        const mt = (parsed.metaTitle ?? "").trim();
        if (mt.length < 15 || !mt.toLowerCase().includes(input.primaryKeyword.toLowerCase())) {
          prevFeedback = `Le metaTitle "${mt || "(vide)"}" doit contenir le mot-clé "${input.primaryKeyword}" (50-60 caractères, mot-clé au début).`;
          if (accumulatedCostUsd >= BUDGET_CAP_USD) break;
          continue;
        }
      }

      const bodyText = (parsed.bodyHtml ?? "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const wordCount = bodyText.split(/\s+/).filter((w) => w.length > 0).length;
      const _bh = parsed.bodyHtml ?? "";
      const internalLinkCount = (_bh.match(/<a\b[^>]*href="\/[^"]*"/gi) ?? []).length;
      const citationCount = (_bh.match(/<a\b[^>]*href="https?:\/\//gi) ?? []).length;
      const readability = computeReadabilityFr(bodyText);
      const seo = computeSeoScore({
        title: parsed.title ?? "",
        metaDescription: parsed.metaDescription ?? "",
        bodyHtml: _bh,
        bodyText,
        directAnswer: parsed.directAnswer,
        faqCount: (parsed.faq ?? []).length,
        internalLinkCount,
        citationCount,
        primaryKeyword: topic,
        searchIntent: input.targetSearchIntent,
        ...articlePageSeoDefaults(parsed.slug ?? "", "barometer_insight"),
      });
      const doctrine = await checkDoctrine(bodyText);
      const qualityScore = qualityFromScores(seo.score, readability.score, doctrine.passed);

      if (qualityScore >= QUALITY_THRESHOLD) {
        await logStep(
          input.jobId,
          "quality_loop_pass",
          `Pass ${iteration} — score ${qualityScore}/100, mots ${wordCount}`,
          { qualityScore, seoScore: seo.score, readabilityScore: readability.score, wordCount },
        );
        break;
      }
      if (accumulatedCostUsd >= BUDGET_CAP_USD || iteration >= MAX_QUALITY_ITERATIONS) break;

      const issues: string[] = [];
      if (seo.score < 60) issues.push("densité keyword/H2 insuffisante");
      if (readability.score < 60) issues.push("phrases trop longues");
      if (!doctrine.passed) {
        issues.push(`doctrine : ${doctrine.blockingViolations.map((v) => v.pattern).join(", ")}`);
      }
      if (wordCount < 600) issues.push(`contenu trop court (${wordCount} mots, min 600)`);
      prevFeedback = `Score ${qualityScore}/100 insuffisant. Améliore : ${issues.join(" ; ")}.`;
    }

    if (!parsed) {
      throw new Error("barometer-insight: aucun output valide après quality loop");
    }

    parsed = { ...parsed, bodyHtml: sanitizeContentGenHtml(parsed.bodyHtml ?? "") };
    parsed = { ...parsed, bodyHtml: injectInternalLinks(parsed.bodyHtml, topic) };

    const bodyText = parsed.bodyHtml
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const wordCount = bodyText.split(/\s+/).filter((w) => w.length > 0).length;
    const readingTimeMinutes = Math.max(1, Math.round(wordCount / 200));
    const finalInternalLinkCount = (parsed.bodyHtml.match(/<a\b[^>]*href="\/[^"]*"/gi) ?? [])
      .length;
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
      primaryKeyword: topic,
      searchIntent: input.targetSearchIntent,
      ...articlePageSeoDefaults(parsed.slug ?? "", "barometer_insight"),
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
      kbEntryIds: [],
    };
  },
};
