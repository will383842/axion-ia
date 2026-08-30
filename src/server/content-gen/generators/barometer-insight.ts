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
 *
 * ARCHITECTURE 2-APPELS (2026-06-25) — voir blog-from-keywords. Le bloc «
 * DONNÉES VÉRIFIÉES » est ré-injecté dans LES DEUX appels (PLAN et EXPANSION)
 * pour que les chiffres viennent toujours des données fournies, jamais inventés.
 */

import { generate as routerGenerate } from "../providers/provider-router";
import { hashPrompt } from "../provenance/provenance-logger";
import { computeReadabilityFr } from "../quality/readability";
import {
  articlePageSeoDefaults,
  qualityFromScores,
  appendSourcesSection,
} from "../quality/article-quality";
import { computeSeoScore, buildAuxBodyText } from "../quality/seo-score";
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
import { injectInternalLinks } from "../links/internal-link-catalog";
import { injectExternalLinks } from "../links/external-links-injector";
import { getIntentPromptAddendum } from "../shared/intent-prompt-adapter";
import { keywordPresentInText } from "@/server/content-gen/shared/keyword-match";
import {
  readLatestSnapshot,
  countRealResponses,
  type BarometerSnapshotPayload,
} from "@/server/observatoire/snapshot";
import { STUDY_NAME_FR, STUDY_ATTRIBUTION } from "@/content/observatoire/study";

// ARCHITECTURE 2-APPELS (2026-06-25) — voir audit content-gen profond.
// Le mono-appel JSON faisait écrire le modèle court car il devait produire
// title+meta+FAQ+body en un seul objet. On scinde :
//   1) PLAN (1 appel, UNE fois) : title/meta/directAnswer/FAQ/keyTakeaway +
//      outline de 8 sections H2 (titre + brief).
//   2) EXPANSION (1 appel, dans la boucle qualité max 2 itérations) : développe
//      les 8 sections en bodyHtml complet (130-190 mots/section).
// Le bloc « DONNÉES VÉRIFIÉES » du baromètre est ré-injecté dans LES DEUX
// appels → les chiffres viennent toujours du snapshot, jamais inventés.
const QUALITY_THRESHOLD = 75;
const MAX_QUALITY_ITERATIONS = 2;
const BUDGET_CAP_USD = 0.3;
// Plancher de longueur DUR. La boucle ne sort pas tant que le corps n'atteint
// pas ce seuil (analyse de données = contenu substantiel attendu).
const MIN_WORD_COUNT = 1000;

const INSIGHT_SENTENCE: Record<string, string> = {
  competitors_use_ai: "pensent que leurs concurrents utilisent déjà l'IA",
  no_formal_strategy: "n'ont pas de stratégie IA formalisée",
  rgpd_concern: "sont préoccupées par la souveraineté de leurs données",
  investment_intent: "prévoient d'augmenter leur budget IA",
};

// ───────────────────────────────────────────────────────────────────────────
// ARCHITECTURE 2-APPELS (2026-06-25)
// ───────────────────────────────────────────────────────────────────────────

// APPEL 1 — PLAN : produit l'ossature (métadonnées + FAQ + outline 8 sections).
// PAS de bodyHtml ici. Le bloc « DONNÉES VÉRIFIÉES » est fourni dans le user
// prompt → le plan ne s'appuie que sur les chiffres réels du baromètre.
const SYSTEM_PROMPT_PLAN =
  injectBrandVoice(`Tu es Manon, experte IA chez Axion-IA. Tu prépares le PLAN d'un article d'ANALYSE en français, optimisé SEO/AEO 2026, qui commente les résultats de « ${STUDY_NAME_FR} » (le corps sera rédigé séparément). Règles absolues :
- Tu ne cites QUE les chiffres présents dans le bloc « DONNÉES VÉRIFIÉES » fourni. Tu n'inventes AUCUN pourcentage, AUCUN effectif, AUCUNE donnée.
- Chaque chiffre cité est attribué à « Observatoire Axion-IA 2026 ».
- Si un angle n'est pas couvert par les données, tu restes qualitatif (pas de chiffre inventé).
- Angle opérationnel : ce que ces chiffres impliquent concrètement pour un dirigeant de PME, d'ETI ou de grand groupe français.
- 0 délai chiffré, 0 frais de déplacement, 0 prix en dur, 0 numéro de téléphone (contact@axion-ia.com uniquement).
- "title" (le H1 affiché) : **50 à 60 caractères**, mot-clé/angle au tout début, cliquable. NE JAMAIS dépasser 60 caractères.
- "metaTitle" : OBLIGATOIREMENT 50 à 60 caractères (compte les espaces), mot-clé au tout début. NE JAMAIS descendre sous 50 caractères : si trop court, ajoute une précision utile (bénéfice, secteur, « pour PME/ETI »…). NE PAS dépasser 60.
- "metaDescription" : OBLIGATOIREMENT 140 à 160 caractères (compte les espaces), phrase complète avec bénéfice clair + mot-clé naturel. NE JAMAIS descendre sous 140 caractères : développe jusqu'à atteindre la fourchette. NE PAS dépasser 160.
- "directAnswer" : OBLIGATOIREMENT **40 à 80 mots** (ni moins, ni plus), réponse autonome et complète à l'angle, citable seule par une IA (AI Overview / vocal). NE JAMAIS répondre en moins de 40 mots : ajoute le « comment » / « pourquoi » concret jusqu'au plancher.
- "faq" : 8 questions People-Also-Ask réelles — chaque réponse answer-first : 1ʳᵉ phrase = réponse directe ≤ 25 mots, puis 1-2 phrases ; 40-55 mots au total.
- "keyTakeaway" : 1-2 phrases = LE point clé à retenir (synthèse autonome citable).
- "expertTake" : 1-2 phrases = prise de position d'expert, sans statistique inventée.
- "outline" : **8 sections <h2>** couvrant une progression logique d'analyse des données : enjeu/contexte → lecture des constats chiffrés majeurs → implications terrain pour le dirigeant → erreurs à éviter → recommandations opérationnelles. Chaque section d'un constat chiffré doit commencer par le chiffre (phrase autoportante). Chaque entrée = { h2 (titre de section, 5-9 mots), brief (1 phrase : ce que la section doit développer, ancré sur un chiffre PRÉCIS du bloc « DONNÉES VÉRIFIÉES » quand pertinent) }. PAS de section définitionnelle creuse.
- INTERDIT (marketing-hype, doctrine § 21 — rejet automatique) : « unique », « meilleur », « la meilleure », « leader », « n°1 », « révolutionnaire », « exceptionnel », « incroyable », « incontournable », « garanti », « sans risque », « instantané ». Reste factuel et sobre.
- Output JSON strict : { title, metaTitle, metaDescription, slug, directAnswer, faq:[{q,a}×8], tags, keyTakeaway, expertTake, outline:[{h2,brief}×8] }`);

// APPEL 2 — EXPANSION : développe l'outline en bodyHtml complet et long.
// C'est ici que se joue la LONGUEUR : chaque section doit faire 130-190 mots.
// Le bloc « DONNÉES VÉRIFIÉES » est ré-injecté dans le user prompt de chaque
// tranche → tous les chiffres rédigés proviennent du snapshot.
const SYSTEM_PROMPT_EXPAND =
  injectBrandVoice(`Tu es Manon, experte IA chez Axion-IA. Tu RÉDIGES le corps HTML d'un article d'ANALYSE FR commentant « ${STUDY_NAME_FR} », à partir d'un plan déjà validé. Règles absolues :
- Tu ne cites QUE les chiffres présents dans le bloc « DONNÉES VÉRIFIÉES » fourni. Tu n'inventes AUCUN pourcentage, AUCUN effectif, AUCUNE donnée. Chaque chiffre est attribué à « Observatoire Axion-IA 2026 ». Si un angle n'est pas couvert, reste qualitatif (pas de chiffre inventé).
- Angle opérationnel : ce que ces chiffres impliquent concrètement pour un dirigeant de PME, d'ETI ou de grand groupe français. 0 prix en dur, 0 délai chiffré, 0 numéro de téléphone (contact@axion-ia.com uniquement).
- LONGUEUR DÉTERMINANTE POUR LE RANG : développe EXACTEMENT les sections de l'outline fourni (une <h2> par entrée, dans l'ordre), **chacune de 130 à 190 mots** (2-3 paragraphes pleins). Corps total visé : **1000 à 1800 mots**. JAMAIS une section de 2 phrases. Développe pleinement l'analyse, ne résume pas.
- Chaque <h2> d'un constat chiffré commence par le chiffre, en phrase autoportante (ex. « 59 % des entreprises… »).
- NE PAS inclure de <h1> dans le corps (le titre est rendu séparément par la page).
- Sous CHAQUE <h2>, commence par une réponse autonome de 40-60 mots citable hors contexte, enveloppée dans <p data-aeo="answer">…</p>. Le développement suit.
- ANTI-MONOTONIE : alterne les formats — chaque constat chiffré majeur en bloc chiffre-clé <aside class="ax-stat" data-aeo="stat"><span class="ax-stat-num">59 %</span><span class="ax-stat-label">…</span></aside> (chiffre RÉEL « Observatoire Axion-IA 2026 »), + 1 à 2 encadrés <aside class="callout callout-note"><p class="callout-label">…</p><p>…</p></aside>. Jamais plus de 3 paragraphes consécutifs sans élément visuel.
- Inclure ≥ 2 liens externes <a href="https://…" rel="noopener noreferrer"> vers des sources d'autorité FR fournies (INSEE, France Num, BPI France, etc.).
- À la première occurrence d'un terme technique, encadre-le avec <dfn> ou <span class="glossary-term" title="définition courte">terme</span>.
- INTERDIT (marketing-hype, doctrine § 21 — un seul de ces mots fait REJETER l'article) : « unique », « meilleur », « la meilleure », « leader », « n°1 », « révolutionnaire », « exceptionnel », « incroyable », « incontournable », « garanti », « sans risque », « instantané ». Écris factuel et sobre, sans superlatif.
- Output JSON strict : { bodyHtml }  (UNIQUEMENT le corps HTML des sections, rien d'autre).`);

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
type BarometerParsed = Omit<PlanParsed, "outline"> & { bodyHtml: string };

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

    // DONNÉES CHIFFRÉES DU BAROMÈTRE — injectées dans LES DEUX appels (plan +
    // expansion) pour que tout chiffre rédigé vienne du snapshot, jamais inventé.
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

    let accumulatedCostUsd = 0;
    let lastTokensInput = 0;
    let lastTokensOutput = 0;
    let lastCitations: ReadonlyArray<{ url: string; title: string; publishedAt?: string }> = [];
    let lastPromptHash = ""; // P0-3 AI Act art. 50

    // ── APPEL 1 — PLAN (une seule fois) ──────────────────────────────────────
    const planSystem = SYSTEM_PROMPT_PLAN + getIntentPromptAddendum(input.targetSearchIntent);
    const planUserPrompt = `Prépare le PLAN d'un article d'analyse Axion-IA commentant l'Observatoire de l'IA 2026 — angle : "${safeTopic}".

${verifiedData}
${externalLinksCtx.markdownSection}
## Avis d'expert
"expertTake" = une prise de position de ${expert.name} (${expert.title}) : perspective d'expert concise et utile sur le sujet, sans chiffre inventé.
## Output attendu (JSON)
{ title, metaTitle, metaDescription, slug, directAnswer, faq:[{q,a}×8], tags, keyTakeaway, expertTake, outline:[{h2,brief}×8] }`;

    let plan: PlanParsed | null = null;
    for (let planAttempt = 0; planAttempt < 2 && !plan; planAttempt++) {
      const planResult = await routerGenerate({
        jobId: input.jobId,
        contentType: "barometer_insight",
        role: "text",
        responseFormatJson: true,
        systemPrompt: planSystem,
        userPrompt:
          planAttempt === 0
            ? planUserPrompt
            : `${planUserPrompt}\n\n## Correction\nLe "title" et le "metaTitle" DOIVENT couvrir l'angle "${safeTopic}" (≤ 60 caractères ; « IA » accepté pour « intelligence artificielle »).`,
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
      throw new Error("barometer-insight: plan invalide après 2 tentatives");
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
    let parsed: BarometerParsed | null = null;
    let prevFeedback = input.improvementFeedback ?? "";
    const expandSystem = SYSTEM_PROMPT_EXPAND + getIntentPromptAddendum(input.targetSearchIntent);

    while (iteration < MAX_QUALITY_ITERATIONS) {
      const feedbackSection = prevFeedback
        ? `\n\n## Retour qualité passe précédente\n${prevFeedback}\nCorrige impérativement ces points.`
        : "";

      // L'expansion développe l'outline en 2 tranches de 4 sections (chunkSize 4)
      // → chaque appel a moins à écrire → sections plus denses. Le bloc « DONNÉES
      // VÉRIFIÉES » est ré-injecté dans CHAQUE tranche → chiffres toujours sourcés.
      lastPromptHash = hashPrompt(
        planSystem + expandSystem + outlineText + verifiedData + prevFeedback,
      );
      const expandResult = await expandOutlineChunked({
        jobId: input.jobId,
        contentType: "barometer_insight",
        outline: plan.outline ?? [],
        chunkSize: 4,
        expandSystem,
        maxTokens: input.templateOverride?.maxTokens ?? 5000,
        temperature: input.templateOverride?.temperature ?? (iteration === 0 ? 0.6 : 0.4),
        buildUserPrompt: ({ chunkText, isFirst, isLast }) =>
          `Rédige le CORPS HTML (sections de l'article) d'analyse Axion-IA commentant l'Observatoire de l'IA 2026 — angle : "${safeTopic}".
${isFirst ? "Ce sont les PREMIÈRES sections de l'article." : "Suite de l'article (ne répète pas l'introduction)."}${isLast ? " Ce sont les DERNIÈRES sections." : ""}

## Sections à développer MAINTENANT (une <h2> par entrée, dans l'ordre, 130-190 mots chacune)
${chunkText}

${verifiedData}
${externalLinksCtx.markdownSection}${feedbackSection}
## Output attendu (JSON)
{ bodyHtml }  (UNIQUEMENT les <h2> de CES sections, rien d'autre — chiffres issus UNIQUEMENT du bloc « DONNÉES VÉRIFIÉES »)`,
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
        bodyHtml: _bh,
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
        searchIntent: input.targetSearchIntent,
        ...articlePageSeoDefaults(parsed.slug ?? "", "barometer_insight"),
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
      if (seo.score < 60) issues.push("densité keyword/H2 insuffisante");
      if (readability.score < 60) issues.push("phrases trop longues");
      if (!doctrine.passed) {
        issues.push(`doctrine : ${doctrine.blockingViolations.map((v) => v.pattern).join(", ")}`);
      }
      if (wordCount < MIN_WORD_COUNT)
        issues.push(
          `corps trop court (${wordCount} mots, minimum ${MIN_WORD_COUNT}) — développe CHAQUE section de l'outline en 130-190 mots (lecture des chiffres, implications terrain), sans inventer aucun fait`,
        );
      prevFeedback = `Score ${qualityScore}/100 insuffisant (SEO=${seo.score}, lisibilité=${readability.score}). Améliore : ${issues.join(" ; ")}.`;
    }

    if (!parsed) {
      throw new Error("barometer-insight: aucun corps valide après expansion");
    }

    parsed = { ...parsed, bodyHtml: sanitizeContentGenHtml(parsed.bodyHtml ?? "") };
    parsed = { ...parsed, bodyHtml: injectInternalLinks(parsed.bodyHtml, topic) };
    // CORRECTIF INTENT 2026-06-25 : pose les liens d'autorité de façon
    // DÉTERMINISTE (section « Sources ») avant le comptage final, garantissant
    // citationCount ≥ liens sélectionnés. Idempotent (no-op si section présente).
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
