// Config de maillage des landings sites-web/SaaS (pages suggérées + label géo).
// Calqué sur interventions-subpages / implementation-subpages.

import type { SitesWebSlug } from "./sites-web";

/** Pages sœurs suggérées par landing (le cross-link hub + audit est ajouté par le composant). */
export const SITESWEB_RELATED: Record<SitesWebSlug, SitesWebSlug[]> = {
  "chatbot-rag": ["recherche-semantique", "wordpress"],
  "recherche-semantique": ["chatbot-rag", "recommandation"],
  "sans-refonte": ["wordpress", "plateforme-native"],
  "plateforme-native": ["creer-saas-ia", "sans-refonte"],
  recommandation: ["recherche-semantique", "personnalisation"],
  wordpress: ["chatbot-rag", "shopify"],
  "creer-saas-ia": ["plateforme-native", "sans-refonte"],
  shopify: ["wordpress", "recommandation"],
  personnalisation: ["recommandation", "recherche-semantique"],
};

/** Label de la brique pour la couverture nationale (« {label} disponible partout en France »). */
export const SITESWEB_GEO_LABEL: Record<SitesWebSlug, { fr: string; en: string }> = {
  "chatbot-rag": { fr: "Le chatbot RAG sur votre site", en: "RAG chatbot on your site" },
  "recherche-semantique": { fr: "La recherche sémantique IA", en: "AI semantic search" },
  "sans-refonte": { fr: "L'ajout d'IA sans refonte", en: "Adding AI without rebuild" },
  "plateforme-native": { fr: "La plateforme SaaS IA-native", en: "The AI-native SaaS platform" },
  recommandation: { fr: "La recommandation produit IA", en: "AI product recommendation" },
  wordpress: { fr: "Le chatbot IA WordPress", en: "WordPress AI chatbot" },
  "creer-saas-ia": { fr: "La création de SaaS IA", en: "AI SaaS creation" },
  shopify: { fr: "L'IA pour Shopify", en: "AI for Shopify" },
  personnalisation: { fr: "La personnalisation de site IA", en: "AI site personalisation" },
};
