// HMR trigger 2026-05-11 (force re-index after routes.d.ts cache invalidation).
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

    // Sprint 14.10.7 (2026-05-11) — refonte taxonomique en 3 blocs famille.
    // Hub famille « Formations équipe » + 4 paliers durée.
    "/interventions/collectives": {
      fr: "/interventions/collectives",
      en: "/interventions/team-trainings",
    },
    "/interventions/collectives/4h": {
      fr: "/interventions/collectives/4h",
      en: "/interventions/team-trainings/4h",
    },
    "/interventions/collectives/1-jour": {
      fr: "/interventions/collectives/1-jour",
      en: "/interventions/team-trainings/1-day",
    },
    "/interventions/collectives/2-jours": {
      fr: "/interventions/collectives/2-jours",
      en: "/interventions/team-trainings/2-days",
    },
    "/interventions/collectives/3-jours-plus": {
      fr: "/interventions/collectives/3-jours-plus",
      en: "/interventions/team-trainings/3-days-plus",
    },
    // Page dédiée formulaire interventions (pattern miroir de /audit/demande).
    // Sprint 14.10.7 — Will exige une page indexable, pas un scroll anchor.
    "/interventions/demande": {
      fr: "/interventions/demande",
      en: "/interventions/request",
    },

    // Famille « Coaching individuel » + 2 formats 1 jour (Sprint 14.10.7).
    "/interventions/individuel": {
      fr: "/interventions/individuel",
      en: "/interventions/individual",
    },
    "/interventions/coaching-decouverte": {
      fr: "/interventions/coaching-decouverte",
      en: "/interventions/discovery-coaching",
    },
    "/interventions/coaching-avance": {
      fr: "/interventions/coaching-avance",
      en: "/interventions/advanced-coaching",
    },

    "/interventions/essentielle": {
      fr: "/interventions/essentielle",
      en: "/interventions/essential",
    },
    "/interventions/approfondie": {
      fr: "/interventions/approfondie",
      en: "/interventions/deep-dive",
    },
    "/interventions/conference": {
      fr: "/interventions/conference",
      en: "/interventions/conference",
    },
    "/interventions/dirigeants": {
      fr: "/interventions/dirigeants",
      en: "/interventions/executives",
    },
    "/interventions/gagner-du-temps": {
      fr: "/interventions/gagner-du-temps",
      en: "/interventions/save-time",
    },
    "/interventions/intervention-claude": {
      fr: "/interventions/intervention-claude",
      en: "/interventions/intervention-claude",
    },

    // Module 2 — Audit & optimisation (pyramide 4 niveaux 2026-05-07)
    "/audit": { fr: "/audit", en: "/audit" },
    "/audit/flash": { fr: "/audit/flash", en: "/audit/flash" },
    "/audit/process": { fr: "/audit/process", en: "/audit/process" },
    "/audit/strategique-pme": {
      fr: "/audit/strategique-pme",
      en: "/audit/strategic-pme",
    },
    "/audit/strategique-eti": {
      fr: "/audit/strategique-eti",
      en: "/audit/strategic-eti",
    },
    "/audit/demande": { fr: "/audit/demande", en: "/audit/request" },

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

    // Module 3 — Catalogue par fonction d'entreprise (8 catégories)
    "/implementation/par-fonction/[slug]": {
      fr: "/implementation/par-fonction/[slug]",
      en: "/implementation/by-function/[slug]",
    },
    // Module 3 — Approche par technologie (9 prestations)
    "/implementation/par-techno": {
      fr: "/implementation/par-techno",
      en: "/implementation/by-technology",
    },

    // Cas concrets
    "/cas-concrets": { fr: "/cas-concrets", en: "/case-studies" },
    "/cas-concrets/[slug]": { fr: "/cas-concrets/[slug]", en: "/case-studies/[slug]" },

    // Transversales
    "/a-propos": { fr: "/a-propos", en: "/about" },
    "/contact": { fr: "/contact", en: "/contact" },
    "/presse": { fr: "/presse", en: "/press" },
    "/blog": "/blog",
    "/blog/[slug]": "/blog/[slug]",
    "/blog/categorie/[slug]": { fr: "/blog/categorie/[slug]", en: "/blog/category/[slug]" },
    "/blog/tag/[slug]": "/blog/tag/[slug]",
    "/blog/auteur/[slug]": { fr: "/blog/auteur/[slug]", en: "/blog/author/[slug]" },
    "/blog/secteur/[slug]": { fr: "/blog/secteur/[slug]", en: "/blog/sector/[slug]" },
    "/blog/taille/[slug]": { fr: "/blog/taille/[slug]", en: "/blog/size/[slug]" },
    "/blog/service/[slug]": { fr: "/blog/service/[slug]", en: "/blog/service/[slug]" },
    "/faq": "/faq",
    "/faq/[slug]": "/faq/[slug]",
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
    "/stack-ia": { fr: "/stack-ia", en: "/ai-stack" },
    "/glossaire": { fr: "/glossaire", en: "/glossary" },
    "/comparaisons": { fr: "/comparaisons", en: "/comparisons" },
    "/comparaisons/[slug]": { fr: "/comparaisons/[slug]", en: "/comparisons/[slug]" },
    "/confirmation": { fr: "/confirmation", en: "/confirmation" },
    "/desabonnement": { fr: "/desabonnement", en: "/unsubscribe" },
    "/preferences-cookies": { fr: "/preferences-cookies", en: "/cookie-preferences" },
    "/mes-donnees": { fr: "/mes-donnees", en: "/my-data" },
    "/mes-donnees/export": { fr: "/mes-donnees/export", en: "/my-data/export" },
    "/accessibilite": { fr: "/accessibilite", en: "/accessibility" },

    // pSEO services × villes (Sprint 14.10.1) — ranking #1 sur « audit IA <ville> »,
    // « formation IA <ville> », « implémentation IA <ville> ». Pattern aligné sur
    // l'existant `/implementation/par-fonction/[slug]` pour éviter collisions URL
    // avec les sous-pages services dédiées (/audit/flash, /interventions/essentielle).
    "/audit/par-ville/[ville]": {
      fr: "/audit/par-ville/[ville]",
      en: "/audit/by-city/[ville]",
    },
    "/interventions/par-ville/[ville]": {
      fr: "/interventions/par-ville/[ville]",
      en: "/interventions/by-city/[ville]",
    },
    "/implementation/par-ville/[ville]": {
      fr: "/implementation/par-ville/[ville]",
      en: "/implementation/by-city/[ville]",
    },

    // pSEO Implantations (régions + villes >5000 hab + 5 DROM, ADR 0006)
    "/implantations": { fr: "/implantations", en: "/locations" },
    "/implantations/[region]": { fr: "/implantations/[region]", en: "/locations/[region]" },
    "/implantations/[region]/[ville]": {
      fr: "/implantations/[region]/[ville]",
      en: "/locations/[region]/[ville]",
    },

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
