/**
 * Sprint v7 Phase 8 commit 4/4 — Constantes wizard (sans "use server").
 *
 * Extraction des constantes purement déclaratives depuis `campaign-wizard.ts`
 * (qui est marqué `"use server"` et chaîne next-auth → next/server, ce qui
 * empêche l'import depuis vitest unit tests sans mock complet).
 *
 * Ce fichier reste FR (no JSX, no I/O, no Sentry, no auth) — pure data.
 * Réutilisable côté client (CampaignWizardV2.tsx) ET côté tests vitest.
 */

export const WIZARD_CONTENT_TYPES = [
  // Section 1 — Core (2)
  // NB : `landing_ville` (page hub ville) est VOLONTAIREMENT hors wizard — généré
  // par script CLI uniquement (contrôle des coûts, cf. generators/index.ts). Le
  // proposer ici créait des jobs voués à échouer (« No generator registered »).
  // La couverture « ville & alentours » se fait via le SCOPE de la campagne sur du
  // contenu blog ancré ville, pas via ce type.
  "blog_article",
  "guide_pilier",
  // Section 2 — Sources externes (3)
  "blog_from_rss",
  "blog_from_keywords",
  "blog_from_title",
  // Section 3 — Comparatifs (3)
  "comparison",
  "vs_comparator",
  "alternative_to",
  // Section 4 — Q&A (3)
  "qa_derived",
  "faq_standalone",
  "faq_geo",
  // Section 5 — SEO long-tail (5)
  "long_tail_keyword",
  "top_x_in_y",
  "how_to_x_in_y",
  "best_for_x_in_y",
  "what_is_x",
  // Section 6 — Conversion locale (4)
  "pain_point_solution",
  "case_study_local",
  "calculator_roi",
  "glossary_term",
] as const;

export type WizardContentType = (typeof WIZARD_CONTENT_TYPES)[number];

// ─── Axes multi-axes (2026-06-21) — vocabulaires partagés UI + validation ────

/** Axe 2 — les 5 ACTIVITÉS Axion-IA (clés serviceSectorWeights). */
export const WIZARD_SERVICE_SECTORS = [
  { value: "interventions_formations", labelFr: "Formations & interventions" },
  { value: "audits", labelFr: "Audits IA" },
  { value: "implementations", labelFr: "Implémentation & automatisation" },
  { value: "un_a_un", labelFr: "Accompagnement 1-to-1" },
  { value: "sites_web_augmentes", labelFr: "Sites web & SaaS IA" },
] as const;

/** Axe 4 — intentions de recherche (clés searchIntentMix, alignées enum DB). */
export const WIZARD_SEARCH_INTENTS = [
  { value: "informational", labelFr: "Informationnel" },
  { value: "commercial_investigation", labelFr: "Commercial / comparaison" },
  { value: "transactional", labelFr: "Transactionnel" },
  { value: "local", labelFr: "Local" },
  { value: "navigational", labelFr: "Navigationnel" },
] as const;

/** Axe 5 — tailles d'entreprise (préfixe des clés audienceMix « SIZE:ORG »). */
export const WIZARD_COMPANY_SIZES = [
  { value: "TPE", labelFr: "TPE (< 10)" },
  { value: "PME", labelFr: "PME (10-249)" },
  { value: "ETI", labelFr: "ETI (250-4999)" },
  { value: "GRANDE_ENTREPRISE", labelFr: "Grande entreprise (5000+)" },
] as const;

// Axe 5 — types d'organisation (suffixe des clés audienceMix « SIZE:ORG »).
// ⚠️ Les `value` DOIVENT être des membres réels de l'enum Prisma `OrganisationType`
// (schema.prisma) sinon l'insertion du job échoue silencieusement à
// l'échantillonnage (cast `as OrganisationType` non validé en DB).
export const WIZARD_ORG_TYPES = [
  { value: "entreprise_privee", labelFr: "Entreprise privée" },
  { value: "association", labelFr: "Association" },
  { value: "collectivite", labelFr: "Collectivité" },
  { value: "etablissement_public", labelFr: "Établissement public" },
] as const;

/** Axe 6 — mode « ville & alentours ». */
export const WIZARD_SURROUNDING_MODES = [
  { value: "none", labelFr: "Villes choisies uniquement" },
  { value: "radius", labelFr: "Ville + alentours (rayon km)" },
  { value: "same_departement", labelFr: "Ville + tout le département" },
] as const;

/** Axe 8 — mode de durée. */
export const WIZARD_DURATION_MODES = [
  { value: "fixed", labelFr: "Durée fixe (s'arrête à la cible)" },
  { value: "unlimited", labelFr: "Sans limite (jusqu'à arrêt manuel)" },
] as const;

export const WIZARD_SECTIONS = [
  {
    id: "core",
    label: "Core (essentiels)",
    types: ["blog_article", "guide_pilier"] as const,
  },
  {
    id: "sources",
    label: "Sources externes",
    types: ["blog_from_rss", "blog_from_keywords", "blog_from_title"] as const,
  },
  {
    id: "comparatifs",
    label: "Comparatifs",
    types: ["comparison", "vs_comparator", "alternative_to"] as const,
  },
  {
    id: "qa",
    label: "Q&A",
    types: ["qa_derived", "faq_standalone", "faq_geo"] as const,
  },
  {
    id: "seo-longtail",
    label: "SEO long-tail",
    types: [
      "long_tail_keyword",
      "top_x_in_y",
      "how_to_x_in_y",
      "best_for_x_in_y",
      "what_is_x",
    ] as const,
  },
  {
    id: "conversion-local",
    label: "Conversion locale",
    types: ["pain_point_solution", "case_study_local", "calculator_roi", "glossary_term"] as const,
  },
] as const;
