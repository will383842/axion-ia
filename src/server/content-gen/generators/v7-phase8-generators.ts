/**
 * Content Generator — 12 generators Phase 8 (Sprint v7 commit 2/4).
 *
 * Pattern strict : chaque generator = 1 const config + 1 export Generator
 * appelant `runV7Phase8Pipeline(input, config)`. Toutes les configs sont
 * regroupées dans ce fichier pour minimiser la surface code (12 files
 * séparés serait du bruit pour des configs déclaratives).
 *
 * Productionisation par type prévue Sessions 7+ : KB retrieve sectoriel
 * dédié, prompt templates affinés, validations métier spécifiques (ex:
 * calculator_roi → schema InteractiveContent JSON-LD, glossary_term →
 * schema DefinedTerm, etc.).
 */

import type { ContentType } from "../../../../prisma/generated/client";
import type { Generator, GeneratorBaseInput, GeneratorOutput } from "./types";
import { runV7Phase8Pipeline, type V7Phase8GeneratorConfig } from "./v7-phase8-shared";
import { INTERVENTION_TIERS, getTierById, formatAmount } from "@/content/pricing";

// Prix d'entrée Essentielle dérivé de la SSOT (pricing.ts) pour les CTA — évite
// tout montant en dur. (Avant : « 490 € » en dur, faux : 490 = Audit Flash, et
// l'Essentielle vaut le prix ci-dessous.)
const ESSENTIELLE_CTA_PRICE = formatAmount(
  getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!,
  "fr",
  { compact: true },
);

// Doctrine commune partagée par les 12 (rappel doctrine Manon brand-voice
// + AI Act art. 50 disclosure + interdiction superlatifs marketing creux).
const DOCTRINE_COMMUNE = `Tu es Manon, plume éditoriale d'Axion-IA (société française).
Cabinet IA opérationnel français. Doctrine v2.5 stricte :
- Axion-IA-centric ≥ 90 % (méthodologie + cas concrets + tarifs SSOT)
- Anti-doorway HCU 2024 : angle unique par contenu
- Mots bannis : "révolutionner", "disruptif", "game-changer", "innovation", "transformation digitale"
- FR uniquement (FR-FR + x-default)
- metaTitle OBLIGATOIREMENT 50 à 60 chars (jamais sous 50 : si trop court ajoute une précision utile), keyword principal au début
- metaDescription OBLIGATOIREMENT 140 à 160 chars (jamais sous 140 : développe jusqu'à la fourchette), phrase complète bénéfice clair
- directAnswer (quand demandé) OBLIGATOIREMENT 40 à 80 mots, jamais sous 40`;

function buildConfig(
  slug: string,
  label: string,
  focus: string,
  ctaHref: string,
  ctaLabel: string,
  systemAdditional: string = "",
): V7Phase8GeneratorConfig {
  return {
    contentTypeSlug: slug,
    humanLabel: label,
    systemPromptOverride: `${DOCTRINE_COMMUNE}\n\n${systemAdditional}`,
    userPromptFocusSection: focus,
    recommendedCtaHref: ctaHref,
    recommendedCtaLabel: ctaLabel,
  };
}

// ─── 12 configs déclaratives ─────────────────────────────────────────────────

const LONG_TAIL_KEYWORD_CONFIG = buildConfig(
  "long_tail_keyword",
  "Article long-tail SEO",
  `## Focus LONG-TAIL KEYWORD
Cible une requête longue (4-7 mots) avec intent informationnel ou commercial.
Body : 1200-1800 mots, structure H2/H3 logique. FAQ × 6 répond aux variations
de la requête. Mention tarif Axion-IA en CTA final.`,
  "/audit",
  "Demander un audit IA",
);

const PAIN_POINT_SOLUTION_CONFIG = buildConfig(
  "pain_point_solution",
  "Pain point métier → solution IA",
  `## Focus PAIN POINT → SOLUTION
Story arc : présente un pain point métier concret (avec data sectorielle),
puis la solution IA pas-à-pas. Cas concret anonymisé recommandé. FAQ × 8.`,
  "/formations",
  `Réserver une formation · ${ESSENTIELLE_CTA_PRICE}`,
);

const VS_COMPARATOR_CONFIG = buildConfig(
  "vs_comparator",
  "Comparatif vs concurrent",
  `## Focus VS COMPARATOR
Compare Axion-IA vs un concurrent nommé sur 6-8 critères (méthodologie,
tarifs, transparence, lock-in, support FR, ROI mesuré). Ton analytique
factuel, pas de dénigrement. <table> récapitulatif OBLIGATOIRE (Featured
Snippet 2026). Verdict final nuancé.`,
  "/audit",
  "Comparer avec un audit IA",
);

const ALTERNATIVE_TO_CONFIG = buildConfig(
  "alternative_to",
  "Alternative à X",
  `## Focus ALTERNATIVE TO
Liste 3-5 alternatives à un outil/service IA cité. Axion-IA en position 1
(plus opérationnelle), 4-5 concurrents avec forces/limites neutres.
<table> récapitulatif comparatif OBLIGATOIRE (alternatives × critères — intent
commercial, Featured Snippet 2026). FAQ × 6. CTA audit personnalisé.`,
  "/audit",
  "Faire un audit IA personnalisé",
);

const TOP_X_IN_Y_CONFIG = buildConfig(
  "top_x_in_y",
  "Top X dans Y (ville/secteur)",
  `## Focus TOP X IN Y
Liste numérotée 10 éléments (outils IA, agences IA, cas d'usage, etc.) dans
le contexte Y (ville française ou secteur métier). Critères clairs en intro.
<table> récapitulatif OBLIGATOIRE (les 10 éléments × critères — intent
commercial, Featured Snippet 2026). Axion-IA en position raisonnable (pas
systématique #1). FAQ × 6.`,
  "/audit",
  "Découvrir Axion-IA",
);

const HOW_TO_X_IN_Y_CONFIG = buildConfig(
  "how_to_x_in_y",
  "How-to localisé",
  `## Focus HOW TO X IN Y
Tutoriel pas-à-pas (5-8 étapes) pour réaliser X dans le contexte Y (ville).
Chaque étape = h3 + paragraphe court + tip pratique. FAQ × 8. Mention
intervention Axion-IA en alternative pro.`,
  "/interventions/essentielle",
  `Faire faire par Axion-IA · ${ESSENTIELLE_CTA_PRICE}`,
);

const BEST_FOR_X_IN_Y_CONFIG = buildConfig(
  "best_for_x_in_y",
  "Best for X dans Y",
  `## Focus BEST FOR X IN Y
Recommandation ciblée audience : "Best [solution] for [audience] in [context]".
3-5 options avec critères match, pricing, fit-score Axion-IA. FAQ × 6.`,
  "/audit",
  "Audit IA personnalisé",
);

const CALCULATOR_ROI_CONFIG = buildConfig(
  "calculator_roi",
  "Calculateur ROI IA",
  `## Focus CALCULATOR ROI
Page explique méthodologie de calcul ROI IA pour un use case (gain temps ×
salaire moyen × volume mensuel - coût IA). Tableau de 3-5 scenarios. FAQ × 6
sur l'interprétation. Mention "calculateur interactif arrive Session 12+".`,
  "/audit",
  "Demander un audit ROI précis",
);

const GLOSSARY_TERM_CONFIG = buildConfig(
  "glossary_term",
  "Terme glossaire IA",
  `## Focus GLOSSARY TERM
Définition complète d'un terme IA professionnel (300-500 mots) : définition
courte (50 mots), définition étendue, exemple concret, related terms (3-5
liens internes), FAQ × 4.`,
  "/audit",
  "Audit IA pour votre entreprise",
);

const WHAT_IS_X_CONFIG = buildConfig(
  "what_is_x",
  "Qu'est-ce que X (définition)",
  `## Focus WHAT IS X
Réponse à "Qu'est-ce que X ?" (intent informationnel pur). Direct answer
40-80 mots citable LLMs. Body 800-1200 mots structuré. FAQ × 6 variations
de la question. CTA discret en fin.`,
  "/audit",
  "En savoir plus avec Axion-IA",
);

const FAQ_GEO_CONFIG = buildConfig(
  "faq_geo",
  "FAQ géolocalisée",
  `## Focus FAQ GEO
8-10 questions/réponses ciblées sur un topic IA × une ville française.
Speakable JSON-LD émis par template render. Réponses 80-150 mots chacune.
Pas de body long, juste FAQ.`,
  "/reserver",
  "Réserver une intervention locale",
);

const CASE_STUDY_LOCAL_CONFIG = buildConfig(
  "case_study_local",
  "Cas concret client local",
  `## Focus CASE STUDY LOCAL
Cas client anonymisé localisé : contexte (ville + secteur), problème,
solution Axion-IA (méthodo 5 étapes), résultats chiffrés (KPI avant/après),
témoignage anonymisé. FAQ × 4 sur la reproductibilité.`,
  "/audit",
  "Auditer votre situation",
);

// ─── 12 generators ───────────────────────────────────────────────────────────

const makeGenerator = (contentTypeSlug: string, config: V7Phase8GeneratorConfig): Generator => ({
  contentType: contentTypeSlug as ContentType,
  async generate(input: GeneratorBaseInput): Promise<GeneratorOutput> {
    return runV7Phase8Pipeline(input, config);
  },
});

export const longTailKeywordGenerator = makeGenerator(
  "long_tail_keyword",
  LONG_TAIL_KEYWORD_CONFIG,
);
export const painPointSolutionGenerator = makeGenerator(
  "pain_point_solution",
  PAIN_POINT_SOLUTION_CONFIG,
);
export const vsComparatorGenerator = makeGenerator("vs_comparator", VS_COMPARATOR_CONFIG);
export const alternativeToGenerator = makeGenerator("alternative_to", ALTERNATIVE_TO_CONFIG);
export const topXInYGenerator = makeGenerator("top_x_in_y", TOP_X_IN_Y_CONFIG);
export const howToXInYGenerator = makeGenerator("how_to_x_in_y", HOW_TO_X_IN_Y_CONFIG);
export const bestForXInYGenerator = makeGenerator("best_for_x_in_y", BEST_FOR_X_IN_Y_CONFIG);
export const calculatorRoiGenerator = makeGenerator("calculator_roi", CALCULATOR_ROI_CONFIG);
export const glossaryTermGenerator = makeGenerator("glossary_term", GLOSSARY_TERM_CONFIG);
export const whatIsXGenerator = makeGenerator("what_is_x", WHAT_IS_X_CONFIG);
export const faqGeoGenerator = makeGenerator("faq_geo", FAQ_GEO_CONFIG);
export const caseStudyLocalGenerator = makeGenerator("case_study_local", CASE_STUDY_LOCAL_CONFIG);

export const V7_PHASE8_CONTENT_TYPE_SLUGS = [
  "long_tail_keyword",
  "pain_point_solution",
  "vs_comparator",
  "alternative_to",
  "top_x_in_y",
  "how_to_x_in_y",
  "best_for_x_in_y",
  "calculator_roi",
  "glossary_term",
  "what_is_x",
  "faq_geo",
  "case_study_local",
] as const;
