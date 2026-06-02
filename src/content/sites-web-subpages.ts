// Config de maillage des landings sites-web/SaaS (pages suggérées + label géo).
// Calqué sur interventions-subpages / implementation-subpages.

import type { SitesWebSlug } from "./sites-web";

/** Pages sœurs suggérées par landing (le cross-link hub + audit est ajouté par le composant). */
export const SITESWEB_RELATED: Record<SitesWebSlug, SitesWebSlug[]> = {
  "chatbot-rag": ["recherche-semantique", "sans-refonte"],
  "recherche-semantique": ["chatbot-rag", "sans-refonte"],
  "sans-refonte": ["chatbot-rag", "plateforme-native"],
  "plateforme-native": ["sans-refonte", "chatbot-rag"],
};

/** Label de la brique pour la couverture nationale (« {label} disponible partout en France »). */
export const SITESWEB_GEO_LABEL: Record<SitesWebSlug, { fr: string; en: string }> = {
  "chatbot-rag": { fr: "Le chatbot RAG sur votre site", en: "RAG chatbot on your site" },
  "recherche-semantique": { fr: "La recherche sémantique IA", en: "AI semantic search" },
  "sans-refonte": { fr: "L'ajout d'IA sans refonte", en: "Adding AI without rebuild" },
  "plateforme-native": { fr: "La plateforme SaaS IA-native", en: "The AI-native SaaS platform" },
};
