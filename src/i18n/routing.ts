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
  // GEO-005 (audit GEO/AEO 2026-08-15) — next-intl émet par défaut un en-tête
  // HTTP `Link: <…/fr/x>; hreflang="fr", <…/en/x>; hreflang="en", <…/x>;
  // hreflang="x-default"` sur CHAQUE réponse HTML dès que `locales.length > 1`.
  // Or EN est désactivé depuis 2026-05-16 : `/en/*` répond 301 → FR et l'URL
  // sans préfixe redirige elle aussi. On annonçait donc à Google, sur 100 % des
  // pages, un alternate `en` vers une redirection et un `x-default` différent de
  // celui du HTML — signal contradictoire, gaspillage de crawl-budget,
  // impressions résiduelles `/en/*` en GSC.
  //
  // Le hreflang reste porté par le HTML (`buildProductMetadata` dans
  // `src/lib/seo.ts` + `src/app/[locale]/layout.tsx`), qui est déjà correctement
  // gaté par `isEnLocaleDisabled()`. C'est le canal de référence : couper
  // l'en-tête HTTP supprime la contradiction sans rien perdre.
  //
  // ⚠️ NE PAS « corriger » en retirant `en` de `locales` : la toggle EN doit
  // rester (AGENTS.md). Si EN est un jour réactivé, le hreflang HTML se
  // repeuple tout seul via `EN_LOCALE_ENABLED=true`.
  // Garde : `src/i18n/__tests__/alternate-links-header.spec.ts`.
  alternateLinks: false,
  pathnames: {
    "/": "/",
    "/design": "/design",
    "/components": "/components",

    // Module 1 — Formations IA (remplace l'offre /interventions collective).
    // /formations est PUBLIC/live (décision Will 2026-06-11). en == fr : EN est
    // redirigé 301→FR (proxy) et fr==en évite le bug next-intl 307 self-loop
    // (qui ne survient que sur un mapping fr≠en) si EN était réactivé.
    "/formations": { fr: "/formations", en: "/formations" },
    // Landing catalogue « Toutes nos formations IA entreprise » (2026-07-05) —
    // page flagship qui liste À PLAT les 17 formations (durée = badge par carte,
    // pas d'axe de tri). Cible « formation IA entreprise France ». Segment static
    // déclaré AVANT `/formations/[slug]` (priorité match static > dynamique).
    // fr==en : EN redirigé 301→FR (proxy), fr==en évite le bug next-intl 307.
    "/formations/entreprise": { fr: "/formations/entreprise", en: "/formations/entreprise" },
    "/formations/tarifs": { fr: "/formations/tarifs", en: "/formations/tarifs" },
    // Refonte 2026-07-19 (Will) — l'axe durée (`/formations/duree/[duree]`) est
    // SUPPRIMÉ (301 → hub via next.config). Les 2 listings par catégorie le
    // remplacent. Segments statiques déclarés AVANT `/formations/[slug]`.
    "/formations/metiers": { fr: "/formations/metiers", en: "/formations/metiers" },
    "/formations/secteurs": { fr: "/formations/secteurs", en: "/formations/secteurs" },
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
    // Hub par-fonction (audit maillage 2026-07-03 : de-orphelinise les pages
    // [slug] qui n'avaient aucun lien entrant HTML ni page hub).
    "/implementation/par-fonction": {
      fr: "/implementation/par-fonction",
      en: "/implementation/by-function",
    },
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

    // Bénéfices client — la visibilité offerte (podcast, interviews, page dédiée,
    // backlink dofollow, LinkedIn) valable pour TOUS les services (2026-07-05).
    // fr==en : EN redirigé 301→FR (proxy), évite le bug next-intl 307.
    "/visibilite-entreprise": { fr: "/visibilite-entreprise", en: "/visibilite-entreprise" },

    // Podcast dirigeant — tournage gratuit dans les locaux du client (2026-07-21).
    // Cible du flyer papier + du QR dynamique `/qr/podcast`. Offre indépendante
    // des formations. fr==en : EN redirigé 301→FR (proxy), évite le bug
    // next-intl 307 self-loop des mappings fr≠en.
    "/podcast": { fr: "/podcast", en: "/podcast" },

    // Certification Qualiopi — page de réassurance (agrément, qualité, sérieux)
    // fr==en : EN redirigé 301→FR (proxy), évite le bug next-intl 307.
    "/certification-qualiopi": { fr: "/certification-qualiopi", en: "/certification-qualiopi" },

    // Financement OPCO / France Travail — page dédiée (Phase B, gatée comme Qualiopi)
    "/financement-opco-france-travail": {
      fr: "/financement-opco-france-travail",
      en: "/financement-opco-france-travail",
    },

    // Transversales
    "/a-propos": { fr: "/a-propos", en: "/about" },
    "/contact": { fr: "/contact", en: "/contact" },
    "/presse": { fr: "/presse", en: "/press" },
    // Sprint S+4-D 2026-05-18 (audit 19-TYPE-8-PRESSE P1-18) — page détail
    // communiqué de presse. Slug = `PressRelease.slug` côté `src/content/press.ts`.
    // FR canonique `/presse/[slug]`, EN miroir `/press/[slug]` (cohérence /presse).
    "/presse/[slug]": { fr: "/presse/[slug]", en: "/press/[slug]" },
    // Observatoire de l'IA 2026 — slug FR = EN (EN désactivé : on évite le bug
    // 307 self-loop next-intl qui n'apparaît que sur les mappings fr ≠ en).
    "/observatoire-ia": { fr: "/observatoire-ia", en: "/observatoire-ia" },
    "/observatoire-ia/participer": {
      fr: "/observatoire-ia/participer",
      en: "/observatoire-ia/participer",
    },
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
    // Hub des catégories (2026-06-24) — page d'atterrissage taxonomique listant
    // les 5 catégories de blog (navigation + maillage interne).
    "/blog/categorie": { fr: "/blog/categorie", en: "/blog/category" },
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
    // Sprint Header refonte 2026-05-24 (Will) — page récap tarifs multi-modules
    // (Audit / Formations / 1-to-1 / Implémentation / Plateforme). Source de
    // vérité unique = pricing.ts. Sert le nouvel onglet header « Tarifs ».
    "/tarifs": { fr: "/tarifs", en: "/pricing" },
    "/roi": "/roi",
    // Simulateur de gains v2 (2026-08-12) — même moteur que `/roi`, servi sans
    // en-tête ni pied de page pour le trafic payant. `noindex` : c'est la
    // variante tunnel d'une page déjà indexée, pas une page de plus.
    "/simulateur": "/simulateur",
    // Page d'atterrissage publicitaire (VSL vidéo) — envoie sur `/simulateur`.
    // `noindex` + hors sitemap : contenu redondant avec `/roi`, qui est la page
    // canonique et indexée.
    // ⚠️ À ne pas confondre avec `/interventions/gagner-du-temps`, ancienne
    // formation collective retirée le 2026-06-12 et redirigée 301 vers
    // `/formations` (cf. next.config.ts).
    "/diagnostic": "/diagnostic",
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
    // (continuité éditoriale Articles). Le hub est émis par `pages.xml` — son
    // sub-sitemap dédié a été retiré le 2026-08-16 (GEO-147, redondant à 1 URL).
    "/guides": { fr: "/guides", en: "/guides" },
    "/guides/[slug]": { fr: "/guides/[slug]", en: "/guides/[slug]" },

    // GEO-131 (audit GEO/AEO 2026-08-14) — `/ressources` existe, répond 200 et
    // est indexable, mais n'était déclarée dans AUCUN sitemap : la clé manquait
    // ici, et `pages.xml` est construit en parcourant `routing.pathnames`.
    // Vérifié en production le 2026-08-16 : `GET /fr/ressources` → 200, et
    // 0 occurrence dans `sitemap/pages.xml`.
    //
    // Slug IDENTIQUE en EN, comme `/guides` juste au-dessus : c'est le motif qui
    // évite d'avoir à déclarer une entrée dédiée dans `mapEnToFr` (le repli
    // « slugs identiques » la couvre) et qui n'expose pas la route au bug de
    // boucle 307 de next-intl, lequel ne frappe que les mappings `fr ≠ en`.
    "/ressources": { fr: "/ressources", en: "/ressources" },

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

    // Catalogue imprimé — page d'atterrissage du QR code imprimé en page 03 du
    // catalogue papier (2026-08-15). L'URL courte `axion-ia.com/catalogue` est
    // IMPRIMÉE : elle ne doit jamais changer. fr==en (EN redirigé 301→FR).
    "/catalogue": { fr: "/catalogue", en: "/catalogue" },

    // Avis clients — système d'avis modérés soumis par les clients (2026-07-06).
    // fr==en : EN redirigé 301→FR (proxy), évite le bug next-intl 307 self-loop.
    // ⚠️ Routes STATIQUES + facettes (2 segments) déclarées AVANT `/avis/[slug]`
    // (1 segment) : « plus spécifique d'abord » = reverse-mapping correct.
    "/avis": { fr: "/avis", en: "/avis" },
    "/avis/deposer": { fr: "/avis/deposer", en: "/avis/deposer" },
    "/avis/service/[service]": { fr: "/avis/service/[service]", en: "/avis/service/[service]" },
    "/avis/secteur/[secteur]": { fr: "/avis/secteur/[secteur]", en: "/avis/secteur/[secteur]" },
    "/avis/ville/[ville]": { fr: "/avis/ville/[ville]", en: "/avis/ville/[ville]" },
    "/avis/departement/[code]": {
      fr: "/avis/departement/[code]",
      en: "/avis/departement/[code]",
    },
    "/avis/[slug]": { fr: "/avis/[slug]", en: "/avis/[slug]" },

    "/confirmation": { fr: "/confirmation", en: "/confirmation" },
    "/desabonnement": { fr: "/desabonnement", en: "/unsubscribe" },
    // Lot L4 — confirmation d'opposition à la conservation en vivier.
    // ⚠️ Chemin IDENTIQUE en fr et en, volontairement : le bug next-intl v4.11 /
    // Next 16.2 (boucle 307 auto-redirect, cf. AGENTS.md) ne se déclenche QUE
    // sur les routes dont le mapping diffère entre locales. Un chemin unique
    // met cette page hors d'atteinte du bug, sans rien attendre de son
    // correctif — et le mot « vivier » n'a de toute façon pas à être traduit
    // sur un site francophone.
    "/vivier-opposition": { fr: "/vivier-opposition", en: "/vivier-opposition" },
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
    // Qualiopi — surfaces publiques (procédure réclamations + règlement intérieur
    // stagiaires). Routes ajoutées après 2026-05-16 → doctrine fr==en (EN 301→FR
    // par le proxy) pour éviter le bug next-intl 307 self-loop des mappings fr≠en.
    "/reclamations": { fr: "/reclamations", en: "/reclamations" },
    "/reglement-interieur": { fr: "/reglement-interieur", en: "/reglement-interieur" },
  },
});

export type Locale = (typeof routing.locales)[number];

// Locales réellement PRÉ-RENDUES au build (SSG / generateStaticParams).
//
// EN désactivé (2026-05-16) → on ne pré-rend plus `/en/*` : le proxy 301 les
// redirige au runtime (src/proxy.ts) et les sitemaps/hreflang les excluent déjà
// (filterEnIfDisabled). Pré-rendre EN ne faisait que (a) doubler le SSG (~17 k
// routes) et (b) laisser des fichiers HTML EN latents sur le CDN. On les retire
// donc du build = défense en profondeur « zéro anglais indexé ».
//
// ⚠️ NE PAS confondre avec `routing.locales` : celui-ci DOIT rester ["fr","en"]
// pour (1) la validation runtime `hasLocale`, (2) la table `pathnames`, (3) la
// réactivation EN par flag. Seul le PRÉ-RENDU est restreint ici.
//
// Réversibilité : `EN_LOCALE_ENABLED=true` ré-inclut EN au PROCHAIN BUILD. Sans
// rebuild, EN reste servi à la demande (dynamicParams=true) — la réactivation
// fonctionne, simplement sans pré-rendu. Symétrique de `effectiveLocales`
// (src/app/sitemap.ts).
export const STATIC_LOCALES: readonly Locale[] =
  process.env["EN_LOCALE_ENABLED"] === "true" ? routing.locales : (["fr"] as const);
