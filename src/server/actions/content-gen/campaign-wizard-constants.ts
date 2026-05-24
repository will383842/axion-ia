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
  // Section 1 — Core (3)
  "landing_ville",
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

export const WIZARD_SECTIONS = [
  {
    id: "core",
    label: "Core (essentiels)",
    types: ["landing_ville", "blog_article", "guide_pilier"] as const,
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
    types: [
      "pain_point_solution",
      "case_study_local",
      "calculator_roi",
      "glossary_term",
    ] as const,
  },
] as const;
