// Descriptions éditoriales des 5 catégories de blog content-gen (SSOT partagé).
// Utilisé par : le hub /blog/categorie (cartes), la meta description des pages
// /blog/categorie/[slug] (audit SEO 2026-06-24 — éviter une description thin/
// générique « Articles Axion-IA dans la catégorie X » dupliquée sur 5 pages).
import type { Locale } from "@/i18n/routing";

export const CATEGORY_DESCRIPTIONS: Record<string, { readonly fr: string; readonly en: string }> = {
  "blog-formations-ia": {
    fr: "Monter en compétence sur l'IA : méthodologie de formation, quick-wins et cas d'usage testés en mission auprès des PME et ETI.",
    en: "Upskilling on AI: training methodology, quick-wins and field-tested use cases for small and mid-sized businesses.",
  },
  "blog-coaching-1-to-1": {
    fr: "Accompagnement individuel sur l'IA : trancher une décision, débloquer un projet, structurer une pratique durable.",
    en: "One-on-one AI support: settling a decision, unblocking a project, structuring a durable practice.",
  },
  "blog-audits-ia": {
    fr: "Diagnostiquer le potentiel IA d'une organisation : cadrage, priorisation, ROI et feuille de route opérationnelle.",
    en: "Diagnosing an organisation's AI potential: scoping, prioritisation, ROI and an operational roadmap.",
  },
  "blog-implementations-ia": {
    fr: "Déployer et automatiser l'IA : intégration concrète, mise en production et industrialisation des workflows.",
    en: "Deploying and automating AI: concrete integration, production rollout and workflow industrialisation.",
  },
  "blog-sites-web-augmentes": {
    fr: "Sites web augmentés par l'IA : contenu, conversion, SEO/AEO et expérience utilisateur pensés pour la visibilité.",
    en: "AI-enhanced websites: content, conversion, SEO/AEO and user experience built for visibility.",
  },
};

/** Description éditoriale d'une catégorie (≈110-140 car.), ou null si inconnue. */
export function categoryDescription(slug: string, locale: Locale): string | null {
  const d = CATEGORY_DESCRIPTIONS[slug];
  return d ? d[locale] : null;
}
