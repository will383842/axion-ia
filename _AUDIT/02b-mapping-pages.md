# AxionIA — Mapping page-par-page

**Version 2 · 2026-05-07 · FR**
**Source de vérité** : code HEAD `axionia/` `fd91518` (DOC-SYNC V14, cf. `_AUDIT/sync-pages.json` + `sync-content.json` + `sync-infra.json`).
Cette v2 remplace la v1 du 06/05/2026 qui prétendait 75 templates pré-Sprint et listait des routes Module 2 Audit refactorées depuis (`/audit/complet|departement|point-de-vente|cabinet`).

> Document de référence pour les sprints en cours (M8 → M11) et l'audit de cohérence cross-pages.
> Chaque route publique listée avec : Slug FR · Slug EN · Type · `'use client'` · Source content · JSON-LD émis · `generateStaticParams` · Notes.
> **Légende Type** : `home` · `listing` · `produit` · `editorial` · `transversal` · `legal` · `system` · `dev`.
> **Volume** : **64 routes** live × 2 langues (FR canonical + EN miroir) via `next-intl` `pathnames` → ~128 URLs effectives. `getAll*Slugs()` génère ensuite les variantes dynamiques (~30 supplémentaires au lancement, ~400-600 en 12 mois).

---

## 1. Récap volumétrique

| Catégorie                              | Routes templates | Notes                                                                                                                  |
| -------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Home                                   | 1                | `/`                                                                                                                    |
| Module 1 — Interventions               | 6                | `/interventions` + 5 sous-pages                                                                                        |
| Module 2 — Audit (refactor 2026-05-07) | 6                | `/audit` + `/audit/{flash,process,strategique-pme,strategique-eti}` + `/audit/demande`                                 |
| Module 3 — Implémentation              | 11               | `/implementation` + 9 produits + `/par-fonction/[slug]` + `/par-techno`                                                |
| Cas concrets                           | 3                | listing + `[slug]` + `secteur/[slug]`                                                                                  |
| Blog                                   | 5                | listing + `[slug]` + `categorie/[slug]` + `tag/[slug]` + `auteur/[slug]`                                               |
| FAQ                                    | 2                | listing + `[slug]`                                                                                                     |
| Centre d'aide                          | 3                | listing + `[slug]` + `categorie/[slug]`                                                                                |
| Pages éditoriales (NEW)                | 8                | `/comparaisons` + `[slug]`, `/glossaire`, `/guide-ia`, `/methodologie`, `/presse`, `/recherche`, `/stack-ia`           |
| Transversales                          | 4                | `/a-propos`, `/contact`, `/confirmation`, `/desabonnement`                                                             |
| Réservation & ROI                      | 2                | `/reserver`, `/roi`                                                                                                    |
| Légales (droit estonien)               | 7                | mentions-legales, conditions-generales, politique-confidentialite, cookies, rgpd, politique-deplacement, accessibilite |
| Système & RGPD UX                      | 3                | `/mes-donnees`, `/preferences-cookies`, (404/500/maintenance via `not-found.tsx`/`error.tsx`/`/maintenance`)           |
| Dev-only (gates)                       | 3                | `/components`, `/sections`, `/design` (à conditionner `NODE_ENV !== 'production'` — dette P2)                          |
| **TOTAL templates**                    | **64**           | × 2 langues = ~128 URLs templates                                                                                      |

> **Croissance attendue** : avec contenus admin (1 article blog/sem, 2 cas concrets/mois, 5 FAQ/mois, 3 articles aide/mois, 8 catégories `automatisations` via `par-fonction/[slug]`), le volume effectif passe à **~400-600 URLs en 12 mois**, hors pSEO villes/régions (ADR 0006 propose V1 1160 villes >10000 hab + 5 DROM).

---

## 2. Module 1 — Interventions entreprise (6 templates)

| Slug FR                      | Slug EN                     | Type      | Client                          | Source content                                                             | JSON-LD émis                                    | Notes                                                                 |
| ---------------------------- | --------------------------- | --------- | ------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------- | -------- | ---------- |
| `/interventions`             | `/interventions`            | `listing` | non                             | `content/interventions.ts` (5 INTERVENTIONS)                               | `BreadcrumbList`, `ItemList`                    | Hub avec hero schema custom + bandeau « Pour qui » + 5 cartes format. |
| `/interventions/essentielle` | `/interventions/essential`  | `produit` | non + îles client (BookingForm) | `INTERVENTIONS.essentielle` + `ESSENTIELLE_TIERS` (3 tiers 490/790/1190 €) | `Service`, `Offer`, `FAQPage`, `BreadcrumbList` | OFFRE PHARE — 3 tarifs distincts via `?tier=intimiste                 | standard | complete`. |
| `/interventions/equipes`     | `/interventions/teams`      | `produit` | non + îles client               | `INTERVENTIONS.equipes`                                                    | `Service`, `FAQPage`, `BreadcrumbList`          | Sur devis.                                                            |
| `/interventions/managers`    | `/interventions/managers`   | `produit` | non + îles client               | `INTERVENTIONS.managers`                                                   | `Service`, `FAQPage`, `BreadcrumbList`          | Sur devis.                                                            |
| `/interventions/conference`  | `/interventions/conference` | `produit` | non + îles client               | `INTERVENTIONS.conference`                                                 | `Service`, `FAQPage`, `BreadcrumbList`          | ½ journée sur devis.                                                  |
| `/interventions/dirigeants`  | `/interventions/executives` | `produit` | non + îles client               | `INTERVENTIONS.dirigeants`                                                 | `Service`, `FAQPage`, `BreadcrumbList`          | Sur devis CODIR.                                                      |

**Notes Module 1**

- Hero schema custom : `InterventionsHeroSchema` (5 satellites + entreprise centre, halos terracotta/primary/sage).
- `BookingFlow` Client orchestre `HouseCalendar` → multi-step 4 étapes (Entreprise / Contact / Contexte IA / Récap+RGPD).
- Vocabulaire commercial réintégré (TPE/PME/grandes, France + international, dès 2 personnes) suite à ADR 0003.

---

## 3. Module 2 — Audit & optimisation (6 templates) ⚠️ REFACTOR 2026-05-07

> **Refactor** : module audit refactoré 2026-05-07. Anciennes routes `/audit/complet`, `/audit/departement`, `/audit/point-de-vente`, `/audit/cabinet` SUPPRIMÉES. Nouvelle architecture orientée parcours B2B :

| Slug FR                  | Slug EN                | Type      | Client         | Source content                | JSON-LD émis                           | Notes                                                                               |
| ------------------------ | ---------------------- | --------- | -------------- | ----------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------- |
| `/audit`                 | `/audit`               | `listing` | non            | `content/audit.ts` (4 AUDITS) | `BreadcrumbList`, `ItemList`           | Hub `AuditHeroSchema` + 4 cartes diagnostic.                                        |
| `/audit/flash`           | `/audit/flash`         | `produit` | non            | `AUDITS.flash`                | `Service`, `FAQPage`, `BreadcrumbList` | Diagnostic Flash — porte d'entrée la plus accessible.                               |
| `/audit/process`         | `/audit/process`       | `produit` | non            | `AUDITS.process`              | `Service`                              | Audit Ciblé processus.                                                              |
| `/audit/strategique-pme` | `/audit/strategic-sme` | `produit` | non            | `AUDITS.strategique-pme`      | `Service`                              | Audit stratégique PME (10-49 salariés).                                             |
| `/audit/strategique-eti` | `/audit/strategic-eti` | `produit` | non            | `AUDITS.strategique-eti`      | `Service`                              | Audit stratégique ETI (50+ salariés).                                               |
| `/audit/demande`         | `/audit/request`       | `system`  | **OUI** (form) | —                             | aucun                                  | Formulaire 5 étapes mutualisé pour les 4 niveaux. CTA tunnel depuis chaque produit. |

**Notes Module 2**

- Refactor 2026-05-07 (Sprint 6 réactualisé) : structure orientée niveau d'engagement (flash → process → stratégique) au lieu de structure « par taille d'entreprise ».
- Page produit ne contient plus de form intégré — tunnel commun `/audit/demande` (Client) avec routing `?audit=flash|process|strategique-pme|strategique-eti`.
- `AggregateOffer` listing à brancher Sprint 17 (settings DB-managées).

---

## 4. Module 3 — Implémentation IA (11 templates)

| Slug FR                               | Slug EN                              | Type        | Client            | Source content                                                     | JSON-LD émis                                              | Notes                                                                             |
| ------------------------------------- | ------------------------------------ | ----------- | ----------------- | ------------------------------------------------------------------ | --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `/implementation`                     | `/implementation`                    | `listing`   | non               | `content/implementation.ts` (9 IMPLEMENTATIONS)                    | `BreadcrumbList`, `ItemList`                              | Hub + 9 cartes produit + lien `par-fonction/[slug]`.                              |
| `/implementation/ia-custom`           | `/implementation/custom-ai`          | `produit`   | non + îles client | `IMPLEMENTATIONS.ia-custom`                                        | `Service`, `Offer` (8k-50k€), `FAQPage`, `BreadcrumbList` | PREMIUM.                                                                          |
| `/implementation/chatbot`             | `/implementation/chatbot`            | `produit`   | non + îles client | `IMPLEMENTATIONS.chatbot`                                          | `Service`, `Offer`                                        | À partir de 990€.                                                                 |
| `/implementation/processus`           | `/implementation/processes`          | `produit`   | non + îles client | `IMPLEMENTATIONS.processus`                                        | `Service`, `Offer`                                        |                                                                                   |
| `/implementation/structuration`       | `/implementation/structuring`        | `produit`   | non + îles client | `IMPLEMENTATIONS.structuration`                                    | `Service`, `Offer`                                        |                                                                                   |
| `/implementation/crm-erp`             | `/implementation/crm-erp`            | `produit`   | non + îles client | `IMPLEMENTATIONS.crm-erp`                                          | `Service`, `Offer`                                        |                                                                                   |
| `/implementation/documents`           | `/implementation/documents`          | `produit`   | non + îles client | `IMPLEMENTATIONS.documents`                                        | `Service`, `Offer`                                        |                                                                                   |
| `/implementation/agents`              | `/implementation/agents`             | `produit`   | non + îles client | `IMPLEMENTATIONS.agents`                                           | `Service`, `Offer`                                        |                                                                                   |
| `/implementation/integrations`        | `/implementation/integrations`       | `produit`   | non + îles client | `IMPLEMENTATIONS.integrations`                                     | `Service`, `Offer`                                        |                                                                                   |
| `/implementation/no-code`             | `/implementation/no-code`            | `produit`   | non + îles client | `IMPLEMENTATIONS.no-code`                                          | `Service`, `Offer`                                        |                                                                                   |
| `/implementation/par-fonction/[slug]` | `/implementation/by-function/[slug]` | `editorial` | non               | `content/automatisations.ts` (8 catégories × 6-7 items = 56 items) | `BreadcrumbList`, `ItemList`                              | `generateStaticParams` via `AUTOMATISATION_SLUGS_FR/EN`. 8 pages programmatiques. |
| `/implementation/par-techno`          | `/implementation/by-technology`      | `editorial` | non               | `content/stack-ia.ts` (5 catégories + 11 outils)                   | `BreadcrumbList`, `ItemList`                              | Hub par techno.                                                                   |

**Notes Module 3**

- 9 produits IMPLEMENTATIONS + 1 hub + 2 pages programmatiques (par-fonction/par-techno) = 11 templates au total (= 12 routes effectives car 8 sous-pages `[slug]` `par-fonction`).
- `content/automatisations.ts` source 56 items × FR/EN — `getAutomatisationByLocaleSlug()` gère la résolution.

---

## 5. Cas concrets (3 templates)

| Slug FR                        | Slug EN                       | Type      | Source                            | JSON-LD                        | Notes                                                |
| ------------------------------ | ----------------------------- | --------- | --------------------------------- | ------------------------------ | ---------------------------------------------------- |
| `/cas-concrets`                | `/case-studies`               | `listing` | `content/case-studies.ts` (5 cas) | `BreadcrumbList`               | Filtres URL-driven (industry+size, no client state). |
| `/cas-concrets/[slug]`         | `/case-studies/[slug]`        | `produit` | `getCaseStudy(slug)`              | `WebPage`, `Article`, `Review` | `generateStaticParams` via `getAllSlugs()`.          |
| `/cas-concrets/secteur/[slug]` | `/case-studies/sector/[slug]` | `listing` | `getCaseStudiesByIndustry(slug)`  | `BreadcrumbList`               | `generateStaticParams` via `getAllIndustrySlugs()`.  |

---

## 6. Blog (5 templates)

| Slug FR                  | Slug EN                 | Type        | Source                                            | JSON-LD                                  | Notes                                                   |
| ------------------------ | ----------------------- | ----------- | ------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------- |
| `/blog`                  | `/blog`                 | `listing`   | `content/transversal.ts` (BLOG_POSTS, 3 fixtures) | `BreadcrumbList`                         |                                                         |
| `/blog/[slug]`           | `/blog/[slug]`          | `editorial` | `getBlogPost(slug)`                               | `BlogPosting` (avec `dateModified`)      | `generateStaticParams` via `getAllBlogSlugs()`.         |
| `/blog/categorie/[slug]` | `/blog/category/[slug]` | `listing`   | `getBlogPostsByCategory()`                        | `BreadcrumbList`                         | `generateStaticParams` via `getAllBlogCategorySlugs()`. |
| `/blog/tag/[slug]`       | `/blog/tag/[slug]`      | `listing`   | `getBlogPostsByTag()`                             | `BreadcrumbList`                         | `generateStaticParams` via `getAllBlogTagSlugs()`.      |
| `/blog/auteur/[slug]`    | `/blog/author/[slug]`   | `listing`   | `getBlogPostsByAuthor()`                          | `BreadcrumbList` (+ `Person` à brancher) | `generateStaticParams` via `getAllBlogAuthorSlugs()`.   |

---

## 7. FAQ (2 templates)

| Slug FR       | Slug EN       | Type        | Source                                                     | JSON-LD                     | Notes                                        |
| ------------- | ------------- | ----------- | ---------------------------------------------------------- | --------------------------- | -------------------------------------------- |
| `/faq`        | `/faq`        | `listing`   | `content/transversal.ts` (FAQ_GLOBAL, 5 entrées initiales) | `FAQPage`, `BreadcrumbList` | Accordion.                                   |
| `/faq/[slug]` | `/faq/[slug]` | `editorial` | `getFaqEntry(slug)`                                        | `QAPage`, `BreadcrumbList`  | `generateStaticParams` via `getAllFaqIds()`. |

---

## 8. Centre d'aide (3 templates)

| Slug FR                         | Slug EN                        | Type        | Source                                              | JSON-LD                                    | Notes                                                   |
| ------------------------------- | ------------------------------ | ----------- | --------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------- |
| `/centre-aide`                  | `/help-center`                 | `listing`   | `content/transversal.ts` (HELP_ARTICLES, 6 entrées) | `BreadcrumbList`                           |                                                         |
| `/centre-aide/[slug]`           | `/help-center/[slug]`          | `editorial` | `getHelpArticle(slug)`                              | `Article` ou `HowTo` (selon `is_tutorial`) | `generateStaticParams` via `getAllHelpSlugs()`.         |
| `/centre-aide/categorie/[slug]` | `/help-center/category/[slug]` | `listing`   | `getHelpArticlesByCategory()`                       | `BreadcrumbList`                           | `generateStaticParams` via `getAllHelpCategorySlugs()`. |

---

## 9. Pages éditoriales (8 templates · NEW Sprints 5-14.6)

| Slug FR                | Slug EN               | Type          | Source                                                                                                       | JSON-LD                                                                                                                                                          | Notes                                                             |
| ---------------------- | --------------------- | ------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `/comparaisons`        | `/comparisons`        | `editorial`   | `content/comparaisons.ts` (3 articles)                                                                       | `BreadcrumbList`, `ItemList`                                                                                                                                     | Hub comparaisons.                                                 |
| `/comparaisons/[slug]` | `/comparisons/[slug]` | `editorial`   | `getComparison(slug)`                                                                                        | `Article`, `BreadcrumbList`                                                                                                                                      | `generateStaticParams` via `getAllComparisonSlugs()`.             |
| `/glossaire`           | `/glossary`           | `editorial`   | (statique en `messages/`)                                                                                    | `DefinedTermSet`, `BreadcrumbList`                                                                                                                               |                                                                   |
| `/guide-ia`            | `/ai-guide`           | `editorial`   | (statique)                                                                                                   | `Article`, `BreadcrumbList`                                                                                                                                      | Lead magnet.                                                      |
| `/methodologie`        | `/methodology`        | `editorial`   | (statique)                                                                                                   | `Article`, `BreadcrumbList`                                                                                                                                      | E-E-A-T. `MethodologyHeroSchema`.                                 |
| `/presse`              | `/press`              | `editorial`   | `content/press.ts` (Sprint 14.6 : 22 entités — 3 releases + 7 facts + 6 kit assets + 1 spokesperson + 6 FAQ) | `WebPage`, `Person` (knowsAbout/sameAs), `FAQPage`, `BreadcrumbList`, `ItemList(NewsArticle)` (si releases > 0), `Speakable` (#press-pitch + #press-boilerplate) | GEO E-E-A-T. États « vide médias » transparents anti-fabrication. |
| `/recherche`           | `/search`             | `transversal` | (FTS Postgres — Sprint 17)                                                                                   | `WebSite`, `SearchAction`, `BreadcrumbList`                                                                                                                      | `'use client'` léger pour input live.                             |
| `/stack-ia`            | `/ai-stack`           | `editorial`   | `content/stack-ia.ts` (5 catégories + 11 outils + 5 FAQ)                                                     | `WebPage`, `ItemList`, `BreadcrumbList`, `FAQPage`                                                                                                               | `StackHeroSchema` + monogrammes (pas de logos).                   |

---

## 10. Transversales (4 templates)

| Slug FR          | Slug EN         | Type          | Source                                                 | JSON-LD                                                           | Notes            |
| ---------------- | --------------- | ------------- | ------------------------------------------------------ | ----------------------------------------------------------------- | ---------------- |
| `/a-propos`      | `/about`        | `transversal` | `content/transversal.ts` (ABOUT_TIMELINE + ABOUT_TEAM) | `Person` (Will, knowsAbout/sameAs), `BreadcrumbList`, `AboutPage` | E-E-A-T fort.    |
| `/contact`       | `/contact`      | `transversal` | (statique + form)                                      | `ContactPage`, `Organization`, `ContactPoint`                     | 3 channels.      |
| `/confirmation`  | `/confirmation` | `transversal` | query params                                           | `WebPage`, `BreadcrumbList`                                       | Post-soumission. |
| `/desabonnement` | `/unsubscribe`  | `transversal` | token RFC 8058                                         | `WebPage`                                                         |                  |

---

## 11. Réservation & ROI (2 templates)

| Slug FR     | Slug EN | Type          | Source                                                   | Notes                                                                                                                                                                                      |
| ----------- | ------- | ------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/reserver` | `/book` | `transversal` | `BookingFlow` Client + `HouseCalendar` 3 états           | Calendrier rounded-3xl, sélecteur intervention IN-calendar, anti-chevauchement 2j, social proof Sophie L. flottant. Multi-step 4 étapes (Entreprise / Contact / Contexte IA / Récap+RGPD). |
| `/roi`      | `/roi`  | `transversal` | `RoiSimulator` Client (4 sliders ARIA + computeRoi pure) | 6 tests Vitest sur compute.                                                                                                                                                                |

---

## 12. Légales (7 templates · droit estonien OÜ)

| Slug FR                      | Slug EN                 | Type    | Source                                            | JSON-LD          | Notes                                           |
| ---------------------------- | ----------------------- | ------- | ------------------------------------------------- | ---------------- | ----------------------------------------------- |
| `/mentions-legales`          | `/legal-notice`         | `legal` | `content/legal.ts` (LEGAL_PAGES.mentions-legales) | `BreadcrumbList` | OÜ + registrikood + adresse Tallinn (env vars). |
| `/conditions-generales`      | `/terms-and-conditions` | `legal` | `LEGAL_PAGES.conditions-generales`                | `BreadcrumbList` | Droit estonien.                                 |
| `/politique-confidentialite` | `/privacy-policy`       | `legal` | `LEGAL_PAGES.politique-confidentialite`           | `BreadcrumbList` | RGPD + AKI.                                     |
| `/cookies`                   | `/cookies`              | `legal` | `LEGAL_PAGES.cookies`                             | `BreadcrumbList` | Plausible self-hosted, pas de bannière.         |
| `/rgpd`                      | `/gdpr`                 | `legal` | `LEGAL_PAGES.rgpd`                                | `BreadcrumbList` | Droits utilisateurs + recours AKI.              |
| `/politique-deplacement`     | `/travel-policy`        | `legal` | `LEGAL_PAGES.politique-deplacement`               | `BreadcrumbList` | Forfait journalier.                             |
| `/accessibilite`             | `/accessibility`        | `legal` | (statique)                                        | `BreadcrumbList` | Déclaration WCAG 2.2 AA.                        |

---

## 13. Système & RGPD UX (3 templates)

| Slug FR                                                                                                                            | Slug EN               | Type     | Source                     | Notes                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------- | --------------------- | -------- | -------------------------- | ------------------------------------------------------- |
| `/mes-donnees`                                                                                                                     | `/my-data`            | `system` | (server actions Sprint 17) | RGPD article 20 — export.                               |
| `/preferences-cookies`                                                                                                             | `/cookie-preferences` | `system` | client                     | Page UX (pas de bannière mais préférences accessibles). |
| `/maintenance` (root + `[locale]/`) + `not-found.tsx` (root + `[locale]/`) + `error.tsx` (root + `[locale]/`) + `global-error.tsx` | idem                  | `system` | env vars + i18n            | 503 hors locale + 404/500 i18n via `errors` namespace.  |

---

## 14. Dev-only (3 templates · gate `NODE_ENV !== 'production'` à appliquer P2)

| Slug          | Type  | Notes                                      |
| ------------- | ----- | ------------------------------------------ |
| `/components` | `dev` | SSG preview 22 atoms UI shadcn customisés. |
| `/sections`   | `dev` | SSG preview 11 composites + Hero variants. |
| `/design`     | `dev` | SSG preview design tokens + globals.css.   |

> **Dette P2 (cf. `_AUDIT/sync-snapshot.md` §3)** : conditionner ces 3 pages à `NODE_ENV !== 'production'` ou les déplacer sous `/dev/[...]` privatisé en build prod (gate par `notFound()` ou `redirect()` selon env).

---

## 15. JSON-LD — usage par catégorie (HEAD `fd91518`)

`src/lib/seo.ts` expose **19 factories** (cf. `_AUDIT/sync-infra.json`). Mapping global :

| Factory                     | Type Schema.org                     | Pages typiques                                                               |
| --------------------------- | ----------------------------------- | ---------------------------------------------------------------------------- |
| `buildOrganization`         | `Organization`                      | layout racine `/` + `/presse` + `/contact`                                   |
| `buildWebSite`              | `WebSite`                           | layout racine + `/recherche` (avec `SearchAction`)                           |
| `buildBreadcrumb`           | `BreadcrumbList`                    | toutes pages (helper transverse)                                             |
| `buildPersonJsonLd`         | `Person`                            | `/a-propos` (Will), `/blog/auteur/[slug]`, `/presse` (porte-parole)          |
| `buildArticleJsonLd`        | `Article`                           | `/methodologie`, `/guide-ia`, `/comparaisons/[slug]`, `/cas-concrets/[slug]` |
| `buildBlogPostingJsonLd`    | `BlogPosting` (avec `dateModified`) | `/blog/[slug]`                                                               |
| `buildServiceJsonLd`        | `Service`                           | toutes pages produit Module 1/2/3                                            |
| `buildOfferJsonLd`          | `Offer`                             | `/interventions/essentielle`, `/implementation/ia-custom`                    |
| `buildAggregateOfferJsonLd` | `AggregateOffer`                    | `/audit` (à brancher Sprint 17)                                              |
| `buildFaqPageJsonLd`        | `FAQPage`                           | `/faq`, page produit Modules, `/presse`                                      |
| `buildQaPageJsonLd`         | `QAPage`                            | `/faq/[slug]` (CRITIQUE AEO)                                                 |
| `buildHowToJsonLd`          | `HowTo`                             | `/centre-aide/[slug]` quand `is_tutorial = true`                             |
| `buildItemListJsonLd`       | `ItemList`                          | tous listings + hubs                                                         |
| `buildLocalBusinessJsonLd`  | `LocalBusiness`                     | layout racine (cabinet UE distant — minimal)                                 |
| `buildPlaceJsonLd`          | `Place`                             | (réservé à pSEO villes — ADR 0006)                                           |
| `buildFaqSpeakableJsonLd`   | `FAQPage` + `Speakable`             | `/` (home), `/presse` (#press-pitch + #press-boilerplate)                    |
| `buildReviewJsonLd`         | `Review`                            | `/cas-concrets/[slug]`                                                       |
| `buildDefinedTermSetJsonLd` | `DefinedTermSet`, `DefinedTerm`     | `/glossaire`                                                                 |
| `buildDatasetJsonLd`        | `Dataset`                           | (réservé `/recherche` Sprint 17)                                             |

**5 factories nouvelles depuis V1 mapping** : `Person`, `FaqSpeakable`, `LocalBusiness`, `Place`, `ItemList` (cf. AGT-INFRA + commit `eda574b`).

---

## 16. SEO infra (HEAD)

- **Sitemap-index Next 16** via `generateSitemaps()` + 6 sous-sitemaps (`pages` 0.6-1.0, `blog` 0.4-0.5, `help` 0.5-0.7, `cas-concrets` 0.5-0.6, `comparaisons` 0.5, `implementation` 0.6) avec `alternates.languages` (hreflang) et `lastModified` sur `BlogPosting.updatedAt`.
- **Robots** : disallow `/api/`, `/_next/`, `/design`, `/components`, `/sections` + variantes locale + sitemap pointer.
- **`llms.txt`** (4 sections) + **`llms-full.txt`** (6 sections : pitch, FAQ, cas concrets, comparaisons, glossaire, methodologie) — edge cache 1h/24h SWR.
- **OG images** : globales `/opengraph-image.tsx` (terracotta + serif italique) + per-route à étendre Sprint 14.7 (cf. ADR 0004).
- **IndexNow** : `public/.well-known/indexnow.txt` + ping automatique à la publication article (Server Action Sprint 17).

---

## 17. Versions de ce mapping

- **v1 06/05/2026** : 75 templates pré-Sprint, basé sur `Navigation-Complete-AxionIA.md` + CLAUDE.md v6 + `_DECISIONS-FINALES.md`. Module 2 Audit listait 5 pages `complet/departement/point-de-vente/cabinet`.
- **v2 2026-05-07** : 64 routes templates HEAD (`fd91518`). Réécriture intégrale post-DOC-SYNC V14 (cf. `_AUDIT/sync-snapshot.md`). Module 2 Audit refactor (Sprint 6 réactualisé). Section « Pages éditoriales » NEW. JSON-LD étendu à 19 factories (5 nouvelles).

**Sources de vérité** : `axionia/src/app/[locale]/**/page.tsx`, `axionia/src/content/*.ts`, `axionia/src/lib/seo.ts`, `axionia/src/i18n/routing.ts`, `axionia/src/app/sitemap.ts`. ADRs : 0001 stack, 0002 design pivot v3, 0003 lift formation ban, 0004 typography v3.1.
