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

// Sprint Quality 2026 P1-4 — scoring moins rigide pour landing pages courtes.
// Avant : 60 ; landing 600-1000 mots produit naturellement des scores SEO un peu
// plus faibles (densité keyword diluée). Threshold abaissé pour permettre
// l'auto-approve sur du contenu de bonne qualité.
const QUALITY_THRESHOLD = 50;

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

  // Quality loop 3 iter + $0.20 budget cap (Sprint Quality 2026 V2 — output structuré)
  // V2 (2026-05-25) : bodyHtml ne contient plus TOUT le contenu — il est complété par
  // whyHere/methodology/pricingTable/guarantees structurés rendus en sections dédiées
  // par le template. Donc bodyHtml peut être plus court : 400-600 mots (storytelling).
  const MAX_QUALITY_ITERATIONS = 3;
  const BUDGET_CAP_USD = 0.25;
  // Plan B Will 2026-05-25 — body 500-700 mots pour anti-duplicate Google (les sections
  // shared sont identiques entre villes, donc le body LLM unique doit faire ≥ 500 mots
  // pour différencier suffisamment chaque ville). Rendu en cards visuelles (split par H2)
  // pour éviter le "wall of text".
  const MIN_WORD_COUNT = 500;
  const MAX_WORD_COUNT = 750;

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
    // Sprint Quality 2026 P0 — sections structurées pour rendu visuel par sections.
    // Optionnel (backward compat avec anciens articles sans ces champs).
    whyHere?: ReadonlyArray<string>;
    methodology?: ReadonlyArray<{ step: string; detail: string }>;
    pricingTable?: ReadonlyArray<{ size: string; price: string; detail: string }>;
    guarantees?: string;
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

    const userPrompt = `Génère une LANDING PAGE Axion-IA (≠ article) pour la ville "${safeVilleSlug}".
Audience : ${safeAudienceSize} × ${safeOrgType}.
Intent : ${safeIntent}.
Primary keyword : ${safePrimaryKeyword}.
Verticale : ${config.slug} (${config.label}).

## 🚨 RÈGLE ABSOLUE — Axion-IA est un cabinet NATIONAL qui SE DÉPLACE
- Axion-IA n'a AUCUNE implantation locale dans aucune ville (pas de bureau, pas d'antenne, pas d'équipe locale)
- INTERDIT : "expertise locale", "équipe locale", "présence locale", "implantation locale", "notre antenne à X", "nous sommes basés à X", "bureau à X", "à proximité"
- AUTORISÉ : "intervention à X", "audit à X", "nous nous déplaçons à X", "nos clients à X", "les entreprises de X"

## 👥 Personas cibles — écris COMME SI tu leur parles directement (HCU 2024 people-first)
1. TPE/artisan (1-10) — pragmatique, sans DSI : veut ROI sous 4 semaines sur tâches admin/devis/relance
2. PME 10-250 — DG : veut audit clair, 3 chantiers prioritaires, implémentation clés en main
3. ETI 250-4999 — Dir.Transformation : veut multi-sites, intégration CRM/ERP, formation managers + ops
4. Grande entreprise 5000+ — DSI/CAIO : veut conformité AI Act, partenaire indépendant sans vendor lock-in

${config.userPromptFocusSection}

## CONTRAINTES STRICTES (re-gen si non-respect)
- **bodyHtml : 500-700 mots** — 4-6 paragraphes structurés, angle storytelling local unique (perspective ville). 2-3 balises <h2> dans le body (le template les rend en cards visuelles distinctes). PAS de H3.
- bodyHtml ne doit PAS contenir : section "pour qui", "tarifs", "méthode", "comment ça marche", "raisons clés", "garanties", "sécurité", "experts" — TOUT cela est déjà rendu en sections dédiées du template.
- **whyHere : OBLIGATOIRE — 4-6 raisons** factuelles ≤ 18 mots chacune (puisées dans le KB économique ville, citables, sans répétition body).
- **methodology : OBLIGATOIRE — 3-5 étapes** avec step (titre court) + detail (1 phrase factuelle).
- **pricingTable : OBLIGATOIRE — EXACTEMENT 4 LIGNES couvrant TPE / PME / ETI / Grande Entreprise** :
  - { size: "TPE (1-10 collab)", price: "À partir de X € HT", detail: "1 phrase" }
  - { size: "PME (10-250 collab)", price: "À partir de X € HT", detail: "1 phrase" }
  - { size: "ETI (250-4 999 collab)", price: "À partir de X € HT", detail: "1 phrase" }
  - { size: "Grande entreprise (5 000+)", price: "Sur mesure", detail: "1 phrase" }
- **guarantees : OBLIGATOIRE — 40-80 mots** d'engagement (RGPD, no lock-in, satisfaction, transparence).
- FAQ : 6-8 paires Q/R concises (40-80 mots par réponse), couvrant TOUTES les tailles d'entreprise.
- ≥ 2 liens externes (INSEE, BPI, France Num, AI Act eur-lex, CNIL, ANSSI…) DANS le bodyHtml.
- ≥ 1 lien interne vers /audit ou /interventions/essentielle ou /implementations ou /cas-concrets DANS le bodyHtml.
- Le primary keyword DOIT apparaître textuellement dans le <h1> ET début du metaTitle.
- Tarifs PUBLICS — cite les vrais prix d'entrée (pas "contactez-nous").
- INTERDIT : claims inventés ("certifié AFNOR", "anciens Big 4", "anciens CTO", "n nombre de clients", "X % de satisfaction") sauf si fournis dans le KB factuel.
- INTERDIT : mention "NDA possible", "accord de confidentialité signable", "NDA disponible sur demande" — la confidentialité est implicite, jamais mentionnée comme argument.
- INTERDIT : email "contact@axion-ia.com" ou autre adresse email. Tous les contacts passent par le formulaire UnifiedContactForm (/contact) ou la prise de rendez-vous (/appel). Dire "via notre formulaire" ou "via prise de rendez-vous", JAMAIS d'email.
- INTERDIT : "axion-ia.com" en tant qu'URL mentionnée dans le contenu. L'URL canonique est dans les metadata, pas dans le body.

## 🚫 BANNED PHRASES (pénalité dure)
- Marketing-speak : "transformation digitale efficace", "gain de compétitivité", "solutions sur mesure", "acteurs majeurs", "centre névralgique", "dynamique et innovant", "expertise dédiée", "tirer parti", "leviers IA"
- Vague tarifs : "contactez-nous pour devis", "selon vos besoins", "selon la complexité"
- Implication implantation : "expertise locale", "équipe locale", "présence locale", "notre antenne", "à proximité"

## 🚨🚨🚨 INTERDICTION ABSOLUE DE FABRIQUER DES PARTENARIATS 🚨🚨🚨
Les noms d'entreprises/pôles/incubateurs présents dans le KB économique (LVMH, BNP Paribas, Sanofi, Cap Digital, Station F, Inria, ENS, Sciences Po, Hermès, AXA, etc.) :
- décrivent l'ÉCOSYSTÈME ÉCONOMIQUE LOCAL de la ville (qui est implanté là)
- NE SONT PAS nos clients, partenaires ou collaborateurs
- Nous N'AVONS PAS de relation commerciale avec ces entités

INTERDIT (mensonger + risque juridique) :
- "Axion-IA collabore avec LVMH"
- "Nous travaillons avec Cap Digital"
- "En partenariat avec Inria"
- "Nos clients comme BNP Paribas"
- "Notamment chez Sanofi"
- Tout phrasing impliquant lien commercial ou contractuel

AUTORISÉ (contexte neutre uniquement) :
- "Paris abrite Cap Digital, Station F…" (description objective)
- "Le tissu économique parisien compte LVMH, BNP Paribas…" (description écosystème)
- Si tu ne sais pas formuler sans ambiguïté, NE LES MENTIONNE PAS du tout.

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
{
  "title": "...",
  "metaTitle": "≤ 70 chars",
  "metaDescription": "140-160 chars",
  "slug": "kebab-case",
  "directAnswer": "40-90 mots citable LLM",
  "bodyHtml": "Body HTML court 400-600 mots — UNIQUEMENT le storytelling unique ville/verticale. Pas de duplication des sections structurées ci-dessous.",
  "whyHere": ["4-6 raisons concises ≤ 18 mots — pourquoi cette verticale dans cette ville (data INSEE + KB economic-data)"],
  "methodology": [
    { "step": "Cadrage", "detail": "1 phrase ≤ 25 mots" },
    { "step": "Analyse / Atelier / Build", "detail": "1 phrase" },
    { "step": "Restitution / Livrable", "detail": "1 phrase" }
  ],
  "pricingTable": [
    { "size": "TPE / PME / ETI / GE", "price": "À partir de X € HT", "detail": "1 phrase contextuelle ≤ 20 mots" }
  ],
  "guarantees": "1 paragraphe 40-80 mots — engagement Axion-IA (RGPD, no lock-in, satisfaction, transparence)",
  "faq": [{"q": "...", "a": "..."}],
  "tags": ["string × 4-8"]
}`;

    lastPromptHash = hashPrompt(systemPromptWithBrandVoice + userPrompt);

    const llmResult = await routerGenerate({
      jobId: input.jobId,
      contentType: "landing_ville",
      role: "text",
      systemPrompt: systemPromptWithBrandVoice,
      userPrompt,
      maxTokens: 4500, // Sprint Quality 2026 — landing page : 800-1100 mots → 4500 tokens output suffisants
      temperature: iteration === 0 ? 0.5 : iteration === 1 ? 0.35 : 0.2,
      // Sprint Quality 2026 — Claude Sonnet préféré pour les landing pages ville
      // (meilleur respect des word counts + qualité éditoriale Manon).
      preferredProvider: "anthropic",
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

    // Sprint Quality 2026 — Strip patterns INTERDITS post-LLM (NDA, email contact,
    // claims inventés). Le LLM peut ne pas respecter le ban du prompt, donc
    // double-filtrage côté serveur.
    const stripBannedPatterns = (html: string): string => {
      let out = html;
      // NDA mentions — phrase entière supprimée
      out = out.replace(
        /[^.!?]*\b(NDA|non-divulgation|accord de confidentialité)\b[^.!?]*[.!?]?/gi,
        "",
      );
      // Emails contact — supprime entièrement la phrase qui contient l'email
      out = out.replace(/[^.!?]*\b[\w._%+-]+@axion-ia\.com\b[^.!?]*[.!?]?/gi, "");
      out = out.replace(/[^.!?]*\bcontact@[\w.-]+\b[^.!?]*[.!?]?/gi, "");
      // URLs axion-ia.com dans le body (gardons que dans canonical/JSON-LD)
      out = out.replace(/\b(www\.)?axion-ia\.com\b\s*»?\s*\.?/gi, "");
      // Cleanup doubles espaces résultants
      out = out.replace(/\s{2,}/g, " ").replace(/<p[^>]*>\s*<\/p>/gi, "");
      return out;
    };
    parsed.bodyHtml = stripBannedPatterns(parsed.bodyHtml);

    // Strip aussi dans FAQ answers
    parsed.faq = parsed.faq.map((qa) => ({
      q: qa.q,
      a: stripBannedPatterns(qa.a),
    }));

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

    // Sprint Quality 2026 P1-4 — scoring moins rigide :
    // - Pénalité doctrine -30 → -15 (doctrine check parfois trop sévère sur landing courtes)
    // - +10 bonus si wordCount dans la cible [800-1100] (récompense respect des caps)
    const wordCountBonus = wordCount >= MIN_WORD_COUNT && wordCount <= MAX_WORD_COUNT ? 10 : 0;
    const baseScore = Math.round((seo.score + readability.score) / 2);
    const score = Math.min(
      100,
      Math.max(0, doctrine.passed ? baseScore + wordCountBonus : baseScore - 15 + wordCountBonus),
    );

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

    if (score >= QUALITY_THRESHOLD && wordCount >= MIN_WORD_COUNT && wordCount <= MAX_WORD_COUNT)
      break;
    if (accumulatedCostUsd >= BUDGET_CAP_USD) break;

    const issues: string[] = [];
    if (wordCount < MIN_WORD_COUNT)
      issues.push(`wordCount=${wordCount} < ${MIN_WORD_COUNT} requis — étoffer chaque section`);
    if (wordCount > MAX_WORD_COUNT)
      issues.push(
        `wordCount=${wordCount} > ${MAX_WORD_COUNT} max — RACCOURCIR (landing page ≠ article, vise concision)`,
      );
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
  const seo = { score: bestExtras.seoScore };

  // City Domination 2026-05-18 P1-5 — Soft-404 word count gate anti-doorway HCU.
  const soft404 = evaluateSoft404({
    wordCount,
    hasFullLocalBusinessJsonLd: false,
    hasLocalCase: false,
    faqCount: parsed.faq.length,
  });

  // Sprint Quality 2026 P0-A — tier graduel à 3 niveaux (vs 2 avant) :
  //   < QUALITY_THRESHOLD (50) OU soft404  → tier_3 noindex,nofollow (rejet)
  //   ≥ 65 ET doctrine.passed              → tier_1_indexable (page indexable, suivi crawl)
  //   sinon (≥ 50, ou doctrine fail)       → tier_2_noindex_follow (suivi liens, pas indexée)
  // Avant le fix : aucune page ne montait à tier_1 → 5 verticales en noindex permanent
  // malgré qualité acceptable (50-66). Bug confirmé par Vérification 2.
  const indexationTier: GeneratorOutput["indexationTier"] =
    soft404.isSoft404 || qualityScore < QUALITY_THRESHOLD
      ? "tier_3_noindex_nofollow"
      : qualityScore >= 55
        ? "tier_1_indexable" // doctrine check pas obligatoire à ce seuil (souvent strict sur landing courtes)
        : "tier_2_noindex_follow";

  // Sprint S+2 Phase C — extraction villes mentionnées (forceInclude anchor).
  const mentionedCities = extractMentionedCitiesFromText(bodyText, {
    forceInclude: input.anchorVilleSlug,
    maxCities: 10,
  });

  // Sprint Quality 2026 V2 — payload structuré complet stocké dans faqJson
  // (en plus de l'array faq classique). Le template parse ce payload pour rendre
  // chaque section avec son layout dédié (whyHere, methodology, pricingTable, guarantees).
  const structuredFaqJson = {
    version: 2 as const,
    faq: parsed.faq,
    whyHere: parsed.whyHere ?? [],
    methodology: parsed.methodology ?? [],
    pricingTable: parsed.pricingTable ?? [],
    guarantees: parsed.guarantees ?? "",
  };

  return {
    title: parsed.title,
    metaTitle: parsed.metaTitle,
    metaDescription: parsed.metaDescription,
    slug: parsed.slug,
    directAnswer: parsed.directAnswer,
    bodyHtml: parsed.bodyHtml,
    bodyText,
    faq: parsed.faq.map((q) => ({ question: q.q, answer: q.a })),
    // Le content-publish-worker (et le test-script) lisent ce champ pour le
    // persister dans Article.faqJson (Json?) — donc backward compat assurée.
    faqJson: structuredFaqJson,
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
