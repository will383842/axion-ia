/**
 * Knowledge Base — mapping `type` → URL publique (FR + EN parity).
 * Cf. master prompt §12.4. Décision Will 2026-05-13 : hub `/ressources/` FR + `/resources/` EN.
 *
 * URLs publiques pré-existantes PRÉSERVÉES via cette table (zéro 301 SEO Phase 2 KB-6).
 * Types `null` = pas d'URL dédiée par type → URL canonique `/ressources/[type]/[slug]`.
 */

import type { KbType } from "../../../prisma/generated/client";

export type KbRouteMap = Record<KbType, { readonly fr: string; readonly en: string } | null>;

export const KB_PUBLIC_ROUTES: KbRouteMap = {
  article: { fr: "/blog", en: "/blog" },
  case_study: { fr: "/cas-concrets", en: "/case-studies" },
  help_article: { fr: "/centre-aide", en: "/help-center" },
  faq: { fr: "/faq", en: "/faq" },
  glossary_term: { fr: "/glossaire", en: "/glossary" },
  guide: { fr: "/guide-ia", en: "/ai-guide" },
  methodology: null,
  doctrine: null,
  adr: null,
  prompt_template: null,
  sop: null,
  post_mortem: null,
  tool_card: null,
  competitor_card: null,
  commercial_doc: null,
  onboarding_step: null,
  // V4 — Knowledge Factory : tous les types factory passent par hub /ressources/[type]/[slug] V1.
  // Paths dédiés type-spécifiques (ex. /comparaisons-ia/, /automatisations/) = décision V2.
  automation_recipe: null,
  tool_review: null,
  industry_use_case: null,
  comparison: null,
  implementation_playbook: null,
  prompt_pattern: null,
  roi_calculator_template: null,
  intervention_module: null,
  competence_boost: null,
  secteur_brief: null,
  dept_brief: null,
  metier_brief: null,
};

/** Hub agrégateur (cross-type) — décision Will 2026-05-13. */
export const KB_HUB_ROUTE = { fr: "/ressources", en: "/resources" } as const;

/** Surface client connectée. */
export const KB_CLIENT_HUB_ROUTE = { fr: "/mes-ressources", en: "/my-resources" } as const;

/**
 * Construit l'URL publique d'une entrée KB.
 * Retourne `null` si le type n'a PAS de route de détail dédiée.
 *
 * Audit indexation 2026-06-17 (décision Will « ne plus les exposer ») : les types
 * sans route (`null` dans KB_PUBLIC_ROUTES — methodology, sop, industry_use_case,
 * comparison, automation_recipe, etc.) généraient auparavant une URL de hub
 * `/ressources/<type>/<slug>` **qui n'a aucune route** → soft-404 (HTTP 200) poussé
 * dans sitemap / RSS / llms.txt / maillage interne, gaspillant du crawl budget.
 * Ce sont des faits RAG/grounding, pas des pages destinées au public. On renvoie
 * donc `null` : tous les call sites (knowledge-sitemap/rss/llms-txt, client-surface,
 * actions KB) court-circuitent déjà sur `null` → ces URLs disparaissent proprement.
 */
export function buildKbPublicUrl(type: KbType, locale: "fr" | "en", slug: string): string | null {
  const route = KB_PUBLIC_ROUTES[type];
  if (route) {
    return `${route[locale]}/${slug}`;
  }
  // Type sans route de détail dédiée → pas d'URL publique (anti soft-404).
  return null;
}
