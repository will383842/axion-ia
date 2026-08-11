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
  // V4 — Knowledge Factory. Décision Will 2026-08-11 (« public assumé ») : les
  // types factory sont servis par les pages réelles `/[locale]/connaissances/[slug]`
  // (slug = slug de TRADUCTION, ex. `kb-fact-audit-006-fr`) — déjà en ligne,
  // liées depuis 10 pages services (`RelatedKnowledge`). Ce mapping les rend
  // visibles du sitemap/RSS/hub, alignant enfin l'exposition sur le site réel.
  // ⚠️ La page /connaissances est FR-only (`notFound()` si locale ≠ fr) : le
  // miroir EN déclaré ici ne devient réel que si la page gagne un rendu EN
  // (routing.ts déclare déjà fr === en pour ce segment).
  // Historique : la valeur `null` (décision 2026-06-17 anti-soft-404) visait les
  // URLs de hub `/ressources/<type>/<slug>` qui n'avaient AUCUNE route.
  automation_recipe: { fr: "/connaissances", en: "/connaissances" },
  tool_review: { fr: "/connaissances", en: "/connaissances" },
  industry_use_case: { fr: "/connaissances", en: "/connaissances" },
  comparison: { fr: "/connaissances", en: "/connaissances" },
  implementation_playbook: { fr: "/connaissances", en: "/connaissances" },
  prompt_pattern: { fr: "/connaissances", en: "/connaissances" },
  roi_calculator_template: { fr: "/connaissances", en: "/connaissances" },
  intervention_module: { fr: "/connaissances", en: "/connaissances" },
  competence_boost: { fr: "/connaissances", en: "/connaissances" },
  secteur_brief: { fr: "/connaissances", en: "/connaissances" },
  dept_brief: { fr: "/connaissances", en: "/connaissances" },
  metier_brief: { fr: "/connaissances", en: "/connaissances" },
};

/** Hub agrégateur (cross-type) — décision Will 2026-05-13. */
export const KB_HUB_ROUTE = { fr: "/ressources", en: "/resources" } as const;

/** Surface client connectée. */
export const KB_CLIENT_HUB_ROUTE = { fr: "/mes-ressources", en: "/my-resources" } as const;

/**
 * Construit l'URL publique d'une entrée KB.
 * Retourne `null` si le type n'a PAS de route de détail dédiée.
 *
 * Audit indexation 2026-06-17 : les types sans route (`null`) généraient une URL
 * de hub `/ressources/<type>/<slug>` **sans route** → soft-404 poussé dans
 * sitemap / RSS / maillage interne. Tous les call sites court-circuitent sur
 * `null` → ces URLs disparaissent proprement.
 * Audit KB 2026-08-11 (décision Will « public assumé ») : les types factory
 * pointent désormais vers `/connaissances/[slug]` — page réelle, déjà servie et
 * maillée depuis les pages services. Seuls les types INTERNES (methodology, sop,
 * adr, doctrine, commercial_doc, …) restent `null`.
 */
export function buildKbPublicUrl(type: KbType, locale: "fr" | "en", slug: string): string | null {
  const route = KB_PUBLIC_ROUTES[type];
  if (route) {
    return `${route[locale]}/${slug}`;
  }
  // Type sans route de détail dédiée → pas d'URL publique (anti soft-404).
  return null;
}
