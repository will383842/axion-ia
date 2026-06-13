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

    // Module 1 — Formations IA (remplace l'offre /interventions collective).
    // /formations est PUBLIC/live (décision Will 2026-06-11). en == fr : EN est
    // redirigé 301→FR (proxy) et fr==en évite le bug next-intl 307 self-loop
    // (qui ne survient que sur un mapping fr≠en) si EN était réactivé.
    "/formations": { fr: "/formations", en: "/formations" },
    "/formations/tarifs": { fr: "/formations/tarifs", en: "/formations/tarifs" },
    "/formations/duree/[duree]": {
      fr: "/formations/duree/[duree]",
      en: "/formations/duree/[duree]",
    },
    "/formations/[slug]": { fr: "/formations/[slug]", en: "/formations/[slug]" },

    // Module 1 — Interventions entreprise (1-to-1 conservé ; collectif → /formations)
    "/interventions": { fr: "/interventions", en: "/interventions" },

    // Anciennes routes collectives (`/interventions/collectives/*`) +
    // `demarrage-ia-express` RETIRÉES (2026-06-12) : remplacées par /formations/*
    // et redirigées en 301 permanent via next.config.ts. Plus aucune page React
    // ni lien interne ne les vise — on les sort du pathnames pour clarifier la
    // carte des routes vivantes (le 301 reste géré au niveau redirects()).
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

    // `essentielle` / `approfondie` (anciennes collectives) retirées 2026-06-12
    // → /formations (301 next.config.ts).
    "/interventions/dirigeants": {
      fr: "/interventions/dirigeants",
      en: "/interventions/executives",
    },
    "/interventions/dirigeant-vision-strategique": {
      fr: "/interventions/dirigeant-vision-strategique",
      en: "/interventions/executive-strategic-vision",
    },
    // Formats Claude 1-to-1 retirés le 2026-06-13 (301 → page équivalente, next.config.ts).
    // `gagner-du-temps` / `intervention-claude` (anciennes collectives) retirées
    // 2026-06-12 → /formations (301 next.config.ts).

    // Module 2 — Audit & optimisation (pyramide 4 niveaux 2026-05-07)
    "/audit": { fr: "/audit", en: "/audit" },
    "/audit/tpe-1-jour": { fr: "/audit/tpe-1-jour", en: "/audit/tpe-1-jour" },
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

    // Module 3C — Sites web & plateformes SaaS augmentés par l'IA (ServiceSector:
    // sites_web_augmentes). Page hub canonique unique : fusion 2026-06-01 (Will)
    // de l'ancien `/codage-developpement` (+ sous-page `/web-digital`) dans cette
    // page — voir 301 dans next.config.ts. Anti-cannibalisation keyword.
    "/sites-web-augmentes": "/sites-web-augmentes",
    // 2026-06-03 — landings pages-intention sites/SaaS (déclarées ici pour
    // inclusion sitemap + canonical/hreflang ; fr=en, pas de mapping fr≠en).
    "/sites-web-augmentes/chatbot-rag": "/sites-web-augmentes/chatbot-rag",
    "/sites-web-augmentes/recherche-semantique": "/sites-web-augmentes/recherche-semantique",
    "/sites-web-augmentes/sans-refonte": "/sites-web-augmentes/sans-refonte",
    "/sites-web-augmentes/plateforme-native": "/sites-web-augmentes/plateforme-native",
    "/sites-web-augmentes/recommandation": "/sites-web-augmentes/recommandation",
    "/sites-web-augmentes/wordpress": "/sites-web-augmentes/wordpress",
    "/sites-web-augmentes/creer-saas-ia": "/sites-web-augmentes/creer-saas-ia",
    "/sites-web-augmentes/shopify": "/sites-web-augmentes/shopify",
    "/sites-web-augmentes/personnalisation": "/sites-web-augmentes/personnalisation",

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
    // Sprint S+4-D 2026-05-18 (audit 19-TYPE-8-PRESSE P1-18) — page détail
    // communiqué de presse. Slug = `PressRelease.slug` côté `src/content/press.ts`.
    // FR canonique `/presse/[slug]`, EN miroir `/press/[slug]` (cohérence /presse).
    "/presse/[slug]": { fr: "/presse/[slug]", en: "/press/[slug]" },
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
    "/appel": { fr: "/appel", en: "/book-a-call" },
    "/reserver": { fr: "/reserver", en: "/book" },
    // Sprint Header refonte 2026-05-24 (Will) — page récap tarifs multi-modules
    // (Audit / Formations / 1-to-1 / Implémentation / Plateforme). Source de
    // vérité unique = pricing.ts. Sert le nouvel onglet header « Tarifs ».
    "/tarifs": { fr: "/tarifs", en: "/pricing" },
    "/roi": "/roi",
    "/recherche": { fr: "/recherche", en: "/search" },
    "/guide-ia": { fr: "/guide-ia", en: "/ai-guide" },
    "/methodologie": { fr: "/methodologie", en: "/methodology" },
    "/stack-ia": { fr: "/stack-ia", en: "/ai-stack" },
    // Sprint S+4-B City Domination 2026-05-18 (audit P1-17 TYPE-9-STACK-IA) —
    // pages détail par outil (`claude`, `chatgpt`, `cursor`, ...). 11 slugs
    // statiques fournis par STACK_TOOLS. EN miroir `/ai-stack/[tool]` aligné
    // avec la convention hub (`/stack-ia → /ai-stack`).
    "/stack-ia/[tool]": { fr: "/stack-ia/[tool]", en: "/ai-stack/[tool]" },
    "/glossaire": { fr: "/glossaire", en: "/glossary" },
    // Sprint S+4-A 2026-05-18 (audit 22-TYPE-11 P1-19) — pages détail terme
    // glossaire (60 slugs au 2026-05-18, source `glossary-extension.ts`).
    // EN miroir `/glossary/[slug]` aligné avec la convention hub.
    "/glossaire/[slug]": { fr: "/glossaire/[slug]", en: "/glossary/[slug]" },
    "/comparaisons": { fr: "/comparaisons", en: "/comparisons" },
    "/comparaisons/[slug]": { fr: "/comparaisons/[slug]", en: "/comparisons/[slug]" },

    // Sprint S+3 P0-7 (audit 18-TYPE-7) — hub + détail guides piliers.
    // Le hub `/guides` liste les Articles `templateVariant="guide-pilier"`
    // publiés (DB-driven, FR-only doctrine v1.2). Détail `/guides/[slug]` =
    // page rendue par `loadGuideForView` (HowTo JSON-LD si steps fiables).
    // Les guides individuels apparaissent aussi dans le sub-sitemap `blog`
    // (continuité éditoriale Articles) ; le hub a son propre sub-sitemap
    // `guides` (1 URL : le hub lui-même).
    "/guides": { fr: "/guides", en: "/guides" },
    "/guides/[slug]": { fr: "/guides/[slug]", en: "/guides/[slug]" },

    // Banque d'images / Image bank (Sprint M? — axionia-image-bank skill v1.0).
    // CC BY 4.0, indexable Google Images / Bing / LLMs. Pages publiques uniquement
    // ici ; routes admin sont sous `(admin)/[adminPrefix]/image-bank/*` et non
    // déclarées dans pathnames (slug `[adminPrefix]` random + accès role-gated).
    // Carrières — système d'offres d'emploi DB-piloté (FR canonique, EN miroir).
    "/carrieres": { fr: "/carrieres", en: "/careers" },
    // Widget embarquable des offres : routes STATIQUES déclarées AVANT
    // `/carrieres/[slug]` — sinon next-intl les résout via le template `[slug]`
    // (« Insufficient params provided for localized pathname » → 500). Plus
    // spécifique d'abord = match correct.
    "/carrieres/widget": { fr: "/carrieres/widget", en: "/careers/widget" },
    "/carrieres/widget-builder": {
      fr: "/carrieres/widget-builder",
      en: "/careers/widget-builder",
    },
    "/carrieres/[slug]": { fr: "/carrieres/[slug]", en: "/careers/[slug]" },
    "/carrieres/[slug]/postuler": {
      fr: "/carrieres/[slug]/postuler",
      en: "/careers/[slug]/apply",
    },
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
    // avec les sous-pages services dédiées (/audit/tpe-1-jour, /interventions/essentielle).
    "/audit/par-ville/[ville]": {
      fr: "/audit/par-ville/[ville]",
      en: "/audit/by-city/[ville]",
    },
    "/formations/par-ville/[ville]": {
      fr: "/formations/par-ville/[ville]",
      en: "/formations/by-city/[ville]",
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
