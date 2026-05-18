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
    // Pages détail indexables des 2 formations 4 h (Sprint 14.10.7 fix).
    "/interventions/demarrage-ia-express": {
      fr: "/interventions/demarrage-ia-express",
      en: "/interventions/ai-express-kickoff",
    },
    "/interventions/atelier-ia-cible": {
      fr: "/interventions/atelier-ia-cible",
      en: "/interventions/targeted-ai-workshop",
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
    "/interventions/conference-pleniere": {
      fr: "/interventions/conference-pleniere",
      en: "/interventions/conference-plenary",
    },
    "/interventions/conference-keynote": {
      fr: "/interventions/conference-keynote",
      en: "/interventions/conference-keynote",
    },
    "/interventions/dirigeants": {
      fr: "/interventions/dirigeants",
      en: "/interventions/executives",
    },
    "/interventions/dirigeant-productivite": {
      fr: "/interventions/dirigeant-productivite",
      en: "/interventions/executive-productivity",
    },
    "/interventions/dirigeant-vision-strategique": {
      fr: "/interventions/dirigeant-vision-strategique",
      en: "/interventions/executive-strategic-vision",
    },
    "/interventions/claude-dirigeant": {
      fr: "/interventions/claude-dirigeant",
      en: "/interventions/claude-executive",
    },
    "/interventions/claude-implementation-individuel": {
      fr: "/interventions/claude-implementation-individuel",
      en: "/interventions/claude-implementation-individual",
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
    // Sprint 14.10.8 (Will 2026-05-12) — /audit/cible remplace /audit/process.
    // Slug aligné sur pricing.ts AUDIT_TIERS id "audit-cible".
    // Le slug legacy /audit/process est géré via 301 dans next.config.ts
    // (sortie sitemap+routing pour ne pas exposer une URL 301 indexable).
    "/audit/cible": { fr: "/audit/cible", en: "/audit/targeted" },
    "/audit/strategique-pme": {
      fr: "/audit/strategique-pme",
      en: "/audit/strategic-pme",
    },
    "/audit/strategique-eti": {
      fr: "/audit/strategique-eti",
      en: "/audit/strategic-eti",
    },
    "/audit/demande": { fr: "/audit/demande", en: "/audit/request" },

    // Sprint X.5bis (Booking V1) — parcours B « devis qualifié » dédié pour
    // les formats > 5k€ HT / IA Custom / packs annuels (D44).
    "/demande-devis": { fr: "/demande-devis", en: "/request-quote" },
    "/demande-devis/confirmation": {
      fr: "/demande-devis/confirmation",
      en: "/request-quote/confirmation",
    },

    // Sprint X.15 (Booking V1) — self-service client via magic-link HMAC.
    // Slug `[token]` = token signé. Pages publiques minimalistes (noindex).
    "/booking/[token]/cancel": {
      fr: "/booking/[token]/cancel",
      en: "/booking/[token]/cancel",
    },
    "/booking/[token]/reschedule": {
      fr: "/booking/[token]/reschedule",
      en: "/booking/[token]/reschedule",
    },

    // Sprint X.17 (Booking V1) — page transparence sous-processeurs RGPD.
    "/sous-processeurs": { fr: "/sous-processeurs", en: "/subprocessors" },

    // Méta-cert 2026-05-15 AGENT 20 P0-2 — hub transparence IA Act EU 2026.
    // Consolide /equipe/manon (persona) + /politique-confidentialite §IA + /sous-processeurs.
    "/transparence": { fr: "/transparence", en: "/transparency" },

    // City Domination 2026-05-18 P1-14 (audit A11 P0) — déclaration explicite
    // de /equipe/[slug] dans pathnames. La page existe (`src/app/[locale]/
    // equipe/[slug]/page.tsx`) mais sans entry routing.ts, les Link<typedRoutes>
    // côté layout/footer/JSON-LD ne typechecknet pas et tombent en `as never`.
    // EN miroir `/team/[slug]` aligné avec la convention `/a-propos → /about`.
    "/equipe/[slug]": { fr: "/equipe/[slug]", en: "/team/[slug]" },

    // City Domination 2026-05-18 P1-21 (audit cross-cut 14 EEAT 2026) — pages
    // EEAT trust signals publiques. Couplée au hub /transparence (AI Act art.
    // 50) elles construisent la posture éditoriale machine-readable + humain-
    // readable attendue par Google AI Overviews / Perplexity / Claude pour
    // citation préférentielle. +30 pts EEAT mesurés.
    "/charte-editoriale": { fr: "/charte-editoriale", en: "/editorial-policy" },
    "/corrections": "/corrections",

    // Sprint S+2 City Domination — 4e verticale `un-a-un` (décision Will
    // Option A 2026-05-18). Naming brand canonique `un-a-un` (URL +
    // breadcrumb), sémantique = coaching 1-to-1 dirigeant. EN miroir
    // `/one-to-one` aligné convention (`/a-propos → /about`).
    "/un-a-un": { fr: "/un-a-un", en: "/one-to-one" },
    "/un-a-un/par-ville/[ville]": {
      fr: "/un-a-un/par-ville/[ville]",
      en: "/one-to-one/by-city/[ville]",
    },

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
    // Sprint actualités factory (P0-5 audit E2E 2026-05-15) — FR-only par
    // doctrine v1.2 (contenus content-gen). Slug EN conservé identique pour
    // que LocaleSwitcher route correctement vers le 404 attendu (la page
    // détaille un notFound() pour locale !== "fr").
    "/actualites": { fr: "/actualites", en: "/actualites" },
    "/actualites/[slug]": { fr: "/actualites/[slug]", en: "/actualites/[slug]" },
    // P1-18 audit E2E NAV+CTA 2026-05-15 — KB V4 publique (hub + détail).
    // Filtres triple-strict côté server : status=published + audience=public
    // + confidentiality=public. FR-only par doctrine v1.2 (KB V1 = FR only).
    "/connaissances": { fr: "/connaissances", en: "/connaissances" },
    "/connaissances/[slug]": { fr: "/connaissances/[slug]", en: "/connaissances/[slug]" },
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

    // Banque d'images / Image bank (Sprint M? — axionia-image-bank skill v1.0).
    // CC BY 4.0, indexable Google Images / Bing / LLMs. Pages publiques uniquement
    // ici ; routes admin sont sous `(admin)/[adminPrefix]/image-bank/*` et non
    // déclarées dans pathnames (slug `[adminPrefix]` random + accès role-gated).
    "/galerie": { fr: "/galerie", en: "/gallery" },
    "/galerie/[slug]": { fr: "/galerie/[slug]", en: "/gallery/[slug]" },
    "/galerie/[slug]/telecharger": {
      fr: "/galerie/[slug]/telecharger",
      en: "/gallery/[slug]/download",
    },

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
