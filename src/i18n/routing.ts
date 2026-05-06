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
    "/faq": "/faq",
    "/centre-aide": { fr: "/centre-aide", en: "/help" },

    // Légales
    "/mentions-legales": { fr: "/mentions-legales", en: "/legal-notice" },
    "/conditions-generales": { fr: "/conditions-generales", en: "/terms" },
    "/politique-confidentialite": {
      fr: "/politique-confidentialite",
      en: "/privacy-policy",
    },
    "/cookies": "/cookies",
    "/rgpd": "/rgpd",
  },
});

export type Locale = (typeof routing.locales)[number];
