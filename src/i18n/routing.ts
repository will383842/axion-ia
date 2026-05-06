import { defineRouting } from "next-intl/routing";

// Locales supportées : FR canonique, EN miroir.
// CLAUDE.md v6 §3 — FR rédigé d'abord, EN s'adapte.
//
// `pathnames` lists every route Link can target. Sprint 2 declares the full
// public sitemap so navigation/footer links typecheck without `as never`,
// even before the actual page files are written (Sprint 5+).
//
// French = canonical slug. English mirrors per CLAUDE.md v6 §3 nav table.
export const routing = defineRouting({
  locales: ["fr", "en"],
  defaultLocale: "fr",
  localePrefix: "always",
  pathnames: {
    "/": "/",
    "/design": "/design",
    "/components": "/components",
    "/sections": "/sections",

    // Module 1 — Interventions entreprise
    "/interventions": { fr: "/interventions", en: "/interventions" },
    "/interventions/essentielle": {
      fr: "/interventions/essentielle",
      en: "/interventions/essential",
    },
    "/interventions/equipes": { fr: "/interventions/equipes", en: "/interventions/teams" },
    "/interventions/managers": { fr: "/interventions/managers", en: "/interventions/managers" },
    "/interventions/conference": {
      fr: "/interventions/conference",
      en: "/interventions/conference",
    },
    "/interventions/dirigeants": {
      fr: "/interventions/dirigeants",
      en: "/interventions/executives",
    },

    // Module 2 — Audit & optimisation
    "/audit": { fr: "/audit", en: "/audit" },
    "/audit/complet": { fr: "/audit/complet", en: "/audit/full" },
    "/audit/departement": { fr: "/audit/departement", en: "/audit/department" },
    "/audit/point-de-vente": { fr: "/audit/point-de-vente", en: "/audit/storefront" },
    "/audit/cabinet": { fr: "/audit/cabinet", en: "/audit/firm" },

    // Module 3 — Implémentation IA
    "/implementation": { fr: "/implementation", en: "/implementation" },
    "/implementation/ia-custom": {
      fr: "/implementation/ia-custom",
      en: "/implementation/custom-ai",
    },
    "/implementation/chatbot": "/implementation/chatbot",
    "/implementation/processus": {
      fr: "/implementation/processus",
      en: "/implementation/processes",
    },
    "/implementation/structuration": {
      fr: "/implementation/structuration",
      en: "/implementation/structuring",
    },
    "/implementation/crm-erp": "/implementation/crm-erp",
    "/implementation/documents": "/implementation/documents",
    "/implementation/agents": "/implementation/agents",
    "/implementation/integrations": "/implementation/integrations",
    "/implementation/no-code": "/implementation/no-code",

    // Cas concrets
    "/cas-concrets": { fr: "/cas-concrets", en: "/case-studies" },

    // Transversales
    "/a-propos": { fr: "/a-propos", en: "/about" },
    "/contact": { fr: "/contact", en: "/contact" },
    "/blog": "/blog",
    "/blog/categorie/[slug]": { fr: "/blog/categorie/[slug]", en: "/blog/category/[slug]" },
    "/blog/tag/[slug]": "/blog/tag/[slug]",
    "/blog/auteur/[slug]": { fr: "/blog/auteur/[slug]", en: "/blog/author/[slug]" },
    "/faq": "/faq",
    "/faq/[slug]": "/faq/[slug]",
    "/faq/categorie/[slug]": { fr: "/faq/categorie/[slug]", en: "/faq/category/[slug]" },
    "/centre-aide": { fr: "/centre-aide", en: "/help" },
    "/centre-aide/[slug]": { fr: "/centre-aide/[slug]", en: "/help/[slug]" },
    "/centre-aide/categorie/[slug]": {
      fr: "/centre-aide/categorie/[slug]",
      en: "/help/category/[slug]",
    },
    "/cas-concrets/secteur/[slug]": {
      fr: "/cas-concrets/secteur/[slug]",
      en: "/case-studies/industry/[slug]",
    },
    "/reserver": { fr: "/reserver", en: "/book" },
    "/roi": "/roi",
    "/recherche": { fr: "/recherche", en: "/search" },
    "/guide-ia": { fr: "/guide-ia", en: "/ai-guide" },
    "/methodologie": { fr: "/methodologie", en: "/methodology" },
    "/glossaire": { fr: "/glossaire", en: "/glossary" },
    "/comparaisons": { fr: "/comparaisons", en: "/comparisons" },
    "/comparaisons/[slug]": { fr: "/comparaisons/[slug]", en: "/comparisons/[slug]" },
    "/confirmation": { fr: "/confirmation", en: "/confirmation" },
    "/desabonnement": { fr: "/desabonnement", en: "/unsubscribe" },
    "/preferences-cookies": { fr: "/preferences-cookies", en: "/cookie-preferences" },
    "/mes-donnees": { fr: "/mes-donnees", en: "/my-data" },
    "/accessibilite": { fr: "/accessibilite", en: "/accessibility" },

    // Légales
    "/mentions-legales": { fr: "/mentions-legales", en: "/legal-notice" },
    "/conditions-generales": { fr: "/conditions-generales", en: "/terms" },
    "/politique-confidentialite": {
      fr: "/politique-confidentialite",
      en: "/privacy-policy",
    },
    "/cookies": "/cookies",
    "/rgpd": "/rgpd",
    "/politique-deplacement": {
      fr: "/politique-deplacement",
      en: "/travel-policy",
    },
  },
});

export type Locale = (typeof routing.locales)[number];
