# 🧭 PROMPT HEADER & NAVIGATION AUDIT 2026 — AxionIA · Architecture, scale & visibilité

> **Version 1.3 · 2026-05-07** (patch : `/stack-ia` reconnue comme LA page IA officielle AxionIA — refonte en cours avec `StackHeroSchema.tsx` + 108/81 modifs sur `page.tsx`. Plus de scénario « catalogue exhaustif distinct », mais question résiduelle : garder 11 outils sélectionnés ou étendre `stack-ia.ts` à plus large catalogue ?)
> Working directory : `C:\Users\willi\Documents\Projets\Axion-IA\axionia`.
> Sortie : `_AUDIT/AUDIT-HEADER-NAVIGATION-2026.md` + `header-architecture.json` + `nav-routes.csv` + **patch proposé** (diffs `Header.tsx`, `MobileNav.tsx`, `messages/*.json`, `app/[locale]/...` non commités) + **proposition ADR** révision CLAUDE.md v6 §9.2.
> Durée estimée : 100-140 min (5 agents parallèles + agent principal).
> **Empile** sur la séquence existante (post FRONTEND-DEEP-CHECK / TYPOGRAPHY / PARITY-CHECK / PAGE-AUDIT-PERFECT — avant Sprint 15 backend).

---

## 🎯 OBJECTIF

Will, fondateur d'AxionIA (cabinet IA opérationnel B2B premium, AxionIA OÜ — droit estonien limité aux pages légales, marketing copy purgé 2026-05-07), prépare une **expansion de surface de visibilité majeure** :

1. **Page "Toutes les IA"** (catalogue exhaustif des IA opérationnelles, en cours de création).
2. **Pages régions** (~13-18 régions FR métropole + DROM-COM si pertinent).
3. **Pages villes** (toutes communes FR > 5 000 habitants, soit ~3 200-3 500 communes — programmatic SEO à grande échelle).

Le Header actuel (`axionia/src/components/nav/Header.tsx`) est un **Server Component à 5 items, ZERO dropdown** (doctrine CLAUDE.md v6 §9.2), avec :

- Fond `bg-terracotta` figé (committed direction visuelle 2026-05-07, mémoire `axionia_design_pivot`).
- Logo badge ivoire « Axion-IA » serif italique sur "IA".
- Layout balanced : `[Logo] [Nav 1, 2] [CTA centré] [Nav 3, 4] [Locale]`.

**Mission** : auditer l'architecture de navigation actuelle vs. les meilleures pratiques 2026, proposer une **architecture cible** qui :

- ✅ **Préserve absolument** : couleur de fond `bg-terracotta` du bandeau header, logo (badge ivoire + Axion-IA serif italique), doctrine éditoriale v3 (mémoire `axionia_design_pivot`).
- ✅ **Absorbe la scale** : 1 page catalogue IA + ~15 pages régions + ~3 500 pages villes, **sans** transformer le header en sitemap ni dégrader l'image premium.
- ✅ **Maximise la visibilité** (SEO / AEO / GEO 2026) : maillage interne, schema.org, sitemap segmenté, breadcrumbs, hreflang, canonical, internal anchor strategy.
- ✅ **Tient les standards UX 2026** : mega-menus accessibles WCAG 2.2 AA, command palette ⌘K, mobile drawer multi-niveaux, sticky behavior, focus management.
- ✅ **Respecte la performance** : LCP/INP/CLS dans budget Sprint 12 (mémoire `axionia_progress`), pas de régression Lighthouse.

**STOP & ASK obligatoires** :

1. Avant de proposer la moindre révision de CLAUDE.md v6 §9.2 (ZERO dropdown).
2. Avant de proposer toute modification du logo ou de la couleur header (rappel : Will a explicitement interdit).
3. Avant de fixer les slugs URLs régions/villes (impact SEO durable, irréversible).
4. Avant de générer plus de N=20 pages templates (validation différenciation éditoriale).
5. **Avant de toucher à la page `/stack-ia`** : page **en cours de refonte active** (working tree 2026-05-07 : `page.tsx` +108/-81, nouveau composant `StackHeroSchema.tsx` non tracké, `stack-ia.ts` 682 lignes). Will a confirmé que **c'est SA page « toutes les IA »** (pas d'autre catalogue exhaustif prévu pour l'instant). Question résiduelle pour Will : (a) garder le format arsenal sélectif (11 outils, doctrine assumée) ; (b) étendre `stack-ia.ts` à un catalogue plus large (50-200 outils) en gardant la page actuelle comme conteneur. **Ne pas proposer de nouveau slug `/ia` ou `/catalogue-ia` séparé sans validation Will explicite.**

---

## 🧠 RÔLE & POSTURE

Tu es **directeur stratégique navigation & SEO technique 2026**, à mi-chemin entre :

- **architecte information** (Donna Spencer, Abby Covert : taxonomies, hub-spoke, polyhiérarchie),
- **lead designer navigation** (héritage Apple HIG / Material 3 / Vercel Geist / Linear),
- **ingénieur SEO programmatic** (Aleyda Solís school : pSEO sans doorway pages, différentiation éditoriale, ROI internal linking),
- **expert AEO/GEO 2026** (optimisation pour SGE Google, Perplexity, ChatGPT Search, Claude.ai citations, Bing Copilot).

Tu connais à froid les architectures de référence 2026 :

- **Anthropic** (anthropic.com) : 4-5 items header, mega-menu Solutions, footer dense organisé par persona.
- **Stripe** (stripe.com) : mega-menu massif mais hyper-structuré 4-col, ⌘K omniprésent, Sticky avec condensation.
- **Vercel** (vercel.com) : header minimal, ⌘K central, mega-menu Products avec preview cards visuelles.
- **Linear** (linear.app) : header 6 items max, sub-menu hover ultra-rapide, ⌘K = colonne vertébrale.
- **Apple** (apple.com) : sticky condensé, mega-menu plein écran sur certaines sections, mobile drawer impeccable.
- **OpenAI / Mistral / Cohere** : Solutions / Research / Company pattern, footer hub massif pour pSEO.
- **Booking.com / Airbnb** : référence absolue pour navigation localisée (régions/villes/quartiers) à grande échelle.

**Posture** :

- **exigeant** sur visibilité (chaque entrée header doit gagner sa place) et sur a11y (WCAG 2.2 AA non-négociable).
- **conservateur** sur la signature visuelle (fond terracotta + logo = sacrés).
- **pragmatique** sur la scale (templates oui, mais avec stratégie anti-doorway pages — Google pénalise les fermes de pages clones).
- **lecture seule strict** durant l'audit. Aucune modif code. Patch = annexe diff que Will applique manuellement après validation.

---

## 🏗️ STACK & CENTRALISATIONS EXISTANTES (à RESPECTER, ne pas réinventer)

> ⚠️ Avant toute proposition, l'agent DOIT lire et comprendre les centralisations en place. Toute architecture cible doit **étendre** ces patterns, pas les contourner. Une recommandation qui réinvente un pattern existant sera rejetée.

### Centralisation contenu — `src/content/*.ts` (TypeScript typé, pas MDX)

Tout le contenu structuré du site vit dans `src/content/` sous forme de modules TS typés avec exports `getAllSlugs()` / `getById()` / etc. Fichiers existants :

- `interventions.ts`, `audit.ts`, `implementation.ts`, `automatisations.ts` (offres).
- `case-studies.ts` (avec `getAllSlugs`, `getAllIndustrySlugs`).
- `comparaisons.ts` (avec `getAllComparisonSlugs`).
- `transversal.ts` (blog, FAQ, help center — `getAllBlogSlugs`, `getAllBlogCategorySlugs`, `getAllBlogTagSlugs`, `getAllBlogAuthorSlugs`, `getAllFaqIds`, `getAllHelpSlugs`, `getAllHelpCategorySlugs`).
- **`stack-ia.ts`** (arsenal 11 outils — page `/stack-ia` FR / `/ai-stack` EN livrée 2026-05-07). Types `StackCategory`, `StackTool`, monogrammes, vendor, maturity. **À ne PAS confondre avec un éventuel catalogue exhaustif d'IAs.**
- `press.ts`, `legal.ts`.

→ **Implication** : les pages **régions** et **villes** doivent suivre le même pattern. Créer `src/content/regions.ts` et `src/content/villes.ts` typés, avec exports `getAllRegionSlugs()`, `getAllVilleSlugs()`, `getRegionBySlug()`, `getVillesByRegion()`, etc. Le contenu rédactionnel par ville (démographie, secteurs, FAQ locale) vit là, pas dans des MDX éparpillés.

### Centralisation routing — `src/i18n/routing.ts`

`routing.pathnames` est la source de vérité unique pour les URLs FR↔EN avec slugs localisés. Toute nouvelle URL (régions, villes, catalogue IAs) DOIT être ajoutée à `routing.pathnames` avec ses variantes FR/EN. C'est ce mapping que `sitemap.ts` exploite via `localizedHref()` et `alternateLanguages()`.

→ **Implication** : ne pas créer de routes hors `routing.pathnames`. Tout slug villes doit avoir sa version EN si publication EN visée (sinon FR-only — décision Will).

### Centralisation SEO — `src/lib/seo.ts`

Helpers exposés (factories à étendre, pas à dupliquer) :

- `buildProductMetadata({ locale, path, title, description, alternates })` → `Metadata` Next.js avec canonical + hreflang + OG + Twitter + robots index.
- `buildServiceJsonLd({ locale, path, name, description, priceEur?, serviceType?, area? })` → JSON-LD `Service` + `Offer`.
- `buildFaqJsonLd({ items })` → JSON-LD `FAQPage`.
- Constante `SITE_URL` (env `NEXT_PUBLIC_SITE_URL`, fallback `https://axion-ia.com`).

→ **Implication** : pour les pages villes/régions, ÉTENDRE `lib/seo.ts` avec :

- `buildLocalBusinessJsonLd({ locale, path, name, areaServed, address?, geo? })` → schema `LocalBusiness`.
- `buildPlaceJsonLd({ locale, path, name, geo, containedInPlace })` → schema `Place`.
- `buildBreadcrumbJsonLd({ items: [{ name, url }] })` → schema `BreadcrumbList`.
- `buildItemListJsonLd({ items })` → catalogue IA + listes villes/régions.

### Centralisation JSON-LD côté composant — `src/components/marketing/JsonLd.tsx`

Composant unique pour injecter `<script type="application/ld+json">`. Ne pas créer de variantes par schema — passer le payload via props.

### Centralisation sitemap — `src/app/sitemap.ts`

Pattern `buildDynamic(entries, now)` déjà sophistiqué : prend une liste de `DynamicSlug` (path FR `:slug`, path EN optionnel, `slugs` array, `changeFrequency`, `priority`) et génère les paires FR+EN avec `alternates.languages`.

Routes programmatic existantes : blog, blog/categorie, blog/tag, blog/auteur, FAQ, centre-aide, centre-aide/categorie, cas-concrets, cas-concrets/secteur, comparaisons.

→ **Implication** : pour les villes (~3500), AJOUTER au tableau `entries` du `buildDynamic` :

```
{ fr: "/implantations/villes/:slug", en: "/locations/cities/:slug", slugs: getAllVilleSlugs(), changeFrequency: "monthly", priority: 0.4 }
```

Vérifier seuil 50 000 URLs / sitemap (limite Google) — 3500 villes + reste = OK dans 1 sitemap, mais split par région recommandé pour clarté humaine. Si split nécessaire, refactor de `sitemap.ts` en `sitemap-index.xml` + sous-sitemaps via `MetadataRoute.SitemapFile` (Next 16 supporte sitemaps multiples via routes `app/sitemap-[id]/route.ts`).

### Centralisation forms — `src/lib/schemas/forms.ts`

Schemas Zod centralisés. Un éventuel champ « ville » dans le formulaire de réservation doit être typé là, pas inline.

### Stack technique runtime (rappel critique — AGENTS.md)

- **Next.js 16** App Router (« This is NOT the Next.js you know » — lire `node_modules/next/dist/docs/` AVANT de proposer du code).
- **next-intl** pour i18n FR/EN (server components avec `getTranslations`).
- **Tailwind v4** (`@theme` block dans `globals.css`).
- **next/font** pour Manrope + Fraunces + Inconsolata.
- **Server Components par défaut** (Header.tsx est server). Mega-menu interactif et ⌘K seront forcément Client Components — minimiser leur surface (border-line client component, pas tout le header).
- **Pas de `middleware.ts`** actuel (mémoire `axionia_perf_audit_2026-05-07` — Will a noté cette absence comme suspect n°1 de lenteur). Si l'audit recommande d'ajouter un middleware (ex: redirections villes legacy → nouvelles URLs), c'est à coordonner avec ce diagnostic perf.

### Anti-patterns à NE PAS proposer

- ❌ Créer `src/data/regions.json` ou MDX pour les villes (le pattern est TS typé dans `src/content/`).
- ❌ Créer un nouveau composant `<LocalBusinessSchema>` (étendre `lib/seo.ts` + utiliser `<JsonLd>` existant).
- ❌ Créer un sitemap parallèle hors `app/sitemap.ts` (étendre `buildDynamic`).
- ❌ Hardcoder des slugs hors `routing.pathnames`.
- ❌ Créer un système d'i18n parallèle pour les villes (utiliser `next-intl` + `routing.pathnames`).
- ❌ Installer Algolia / Typesense Cloud sans avoir d'abord évalué Pagefind (build-time, gratuit, parfait pour ~3500 pages SSG).
- ❌ Proposer SSR pour les villes (SSG strict, sinon coût hosting prohibitif sur 3500 pages).

### Dossier `_AUDIT/` — pattern empilement

Mémoires Will : empiler des prompts dédiés (`PROMPT-*.md`), produire des audits dédiés (`AUDIT-*.md`), créer des ADR pour décisions structurelles (`adr-XXXX-*.md`). Cet audit doit produire `adr-0003-navigation-mega-menu-PROPOSITION.md` (révision §9.2) ET potentiellement `adr-0004-pseo-villes-PROPOSITION.md` (engagement scale 3500 pages = décision durable).

---

## 📚 SOURCES DE VÉRITÉ

### Référence interne (gold standard actuel)

1. `axionia/src/components/nav/Header.tsx` — Server Component, 5 items, ZERO dropdown, fond terracotta figé.
2. `axionia/src/components/nav/MobileNav.tsx` — drawer mobile actuel.
3. `axionia/src/components/nav/NavLink.tsx` — composant lien actif / focus.
4. `axionia/src/components/nav/LocaleSwitcher.tsx` — switcher FR/EN.
5. `axionia/src/components/nav/Breadcrumbs.tsx` — fil d'ariane existant (vérifier coverage).
6. `axionia/src/components/nav/Footer.tsx` — footer actuel (candidat hub pSEO).
7. `axionia/src/i18n/navigation.ts` + `messages/fr.json` + `messages/en.json` — i18n nav.
8. `axionia/src/app/[locale]/layout.tsx` — chargement Header.
9. `axionia/src/app/sitemap.ts` (si existe) — stratégie sitemap actuelle.
10. `axionia/src/app/robots.ts` (si existe) — directives crawl.
11. `axionia/CLAUDE.md` (v6) — §9.2 ZERO dropdown, §autres règles nav.
12. `axionia/Design.md` — doctrine v3 Editorial Premium Light.
13. `axionia/AGENTS.md` — **« This is NOT the Next.js you know »** — Next.js 16 a des breaking changes API. Lire `node_modules/next/dist/docs/` AVANT toute proposition de code.
14. ADRs existants : `_AUDIT/adr-0001-*.md` et `_AUDIT/adr-0002-*.md` (livré 2026-05-07 selon mémoire `axionia_session_2026-05-07_pivot_v3` — direction visuelle Editorial Premium Light v3). Lire les deux pour conventions de format ADR à respecter.
15. Mémoires Claude Code : `axionia_design_pivot.md`, `axionia_naming_cabinet.md`, `axionia_audit_pattern.md`, `axionia_progress.md`.

### Pages à auditer (couverture nav actuelle)

#### A. Pages présentes dans nav header actuelle (5)

- `/` (home).
- `/interventions` (gold standard parity).
- `/audit`.
- `/implementation`.
- `/cas-concrets`.

#### B. Pages présentes ailleurs (footer / liens contextuels)

> **Inventaire complet réel `src/app/[locale]/`** (vérifié 2026-05-07) :
>
> `accessibilite`, `a-propos`, `audit`, `blog`, `cas-concrets`, `centre-aide`, `comparaisons`, `components` (dev shell), `conditions-generales`, `confirmation`, `contact`, `cookies`, `desabonnement`, `design` (dev shell), `faq`, `glossaire`, `guide-ia`, `implementation`, `interventions`, `mentions-legales`, `mes-donnees`, `methodologie`, `politique-confidentialite`, `politique-deplacement`, `preferences-cookies`, `presse`, `recherche`, `reserver`, `rgpd`, `roi`, `sections` (dev shell), `stack-ia`.

- **Marketing/contenu** : `/a-propos`, `/contact`, `/methodologie`, `/faq`, `/blog`, `/presse`, `/roi`, `/reserver`, `/comparaisons`, `/cas-concrets/secteur/[slug]`, `/centre-aide` (FR) / `/help` (EN), `/glossaire`, `/guide-ia`.
- **Page IA officielle** : `/stack-ia` (FR) / `/ai-stack` (EN) — refonte en cours 2026-05-07 (cf. chapitre 3).
- **Recherche existante** : `/recherche` — page de recherche déjà présente. ⚠️ Le ⌘K (chapitre 6) doit s'articuler avec, pas dupliquer (soit ⌘K = overlay rapide qui propose « voir tous les résultats sur /recherche », soit ⌘K = page directe `/recherche` au focus).
- **Privacy / utilitaires** : `/preferences-cookies`, `/desabonnement`, `/mes-donnees`, `/confirmation`, `/cookies`, `/rgpd`, `/politique-deplacement` (toutes EXCLUDED_FROM_INDEX ou non-indexables dans `sitemap.ts`).
- **A11y / légal** : `/accessibilite`, `/mentions-legales`, `/conditions-generales`, `/politique-confidentialite`.
- **Dev shells** (à exclure de l'audit nav) : `/design`, `/components`, `/sections`.

#### C. Pages futures à intégrer (cible audit — **n'existent PAS encore sur disque, à architecturer**)

- ❌ Pas de `/ia` séparé : `/stack-ia` est la page IA officielle (cf. chapitre 3).
- `/implantations` (hub) — à créer.
- `/implantations/regions/[region]` (~15 pages) — à créer.
- `/implantations/villes/[ville]` (~3 500 pages programmatic) — à créer.
- Variantes possibles : `/implantations/[region]/[ville]` (hiérarchie plus profonde, meilleur PageRank flow mais URLs plus longues).
- ⚠️ **Aucun fichier `src/content/regions.ts` ou `villes.ts` ni dossier `app/[locale]/implantations/` ne existe à date 2026-05-07** — le prompt traite ces pages comme à concevoir, pas à auditer.

### Benchmarks externes 2026 (WebFetch + screenshots)

1. **anthropic.com** — header solution-driven, mega-menu Solutions.
2. **stripe.com** — mega-menu pro de référence, ⌘K, Sticky condensation.
3. **vercel.com** — minimalisme + ⌘K central + preview cards.
4. **linear.app** — sub-menu hover rapide, structure cristalline.
5. **apple.com** — mobile drawer impeccable, sticky condensation.
6. **openai.com** — Solutions / Research / Company.
7. **mistral.ai** — concurrent direct, observer leur navigation IA catalog.
8. **cohere.com** — solutions B2B.
9. **booking.com** — référence pSEO villes/régions à scale (3M+ pages).
10. **airbnb.com** — navigation localisée premium + recherche prédictive.
11. **deloitte.com / mckinsey.com / bcg.com** — concurrents B2B haut de gamme : structure conseil.
12. **shine.fr / qonto.com / pennylane.com** — comparables B2B FR premium.
13. **gouv.fr / data.gouv.fr** — référence pages régions/villes officielles FR (slugs, breadcrumbs, schema).

Pour chaque benchmark, extraire :

- Nombre d'items header (visible vs. mega-menu).
- Profondeur menu (1, 2, 3 niveaux).
- Présence ⌘K et son périmètre.
- Sticky behavior (figé / hide-on-scroll / condense).
- Mobile drawer (slide-in, full-screen, accordéons).
- Footer architecture (combien de colonnes, quels hubs).
- Breadcrumbs (présence, position, schema BreadcrumbList).
- Internal linking pSEO (villes proches, régions limitrophes).
- ⚠️ Faille observée (chez chaque benchmark) → leçon pour AxionIA.

---

## 🔍 PÉRIMÈTRE D'AUDIT (10 chapitres × 10 critères = 100 points)

### Chapitre 1 — Architecture du Header desktop (perfection 2026)

1.1 Nombre d'items visibles (cible : 5-7 max — 5 actuellement, headroom faible).
1.2 Hiérarchie : conversion CTA vs. exploration vs. utilitaire (logo / locale / ⌘K).
1.3 Distribution spatiale : centrée vs. asymétrique vs. balanced (actuel = balanced split CTA centré, juger).
1.4 Density / breathing : padding `px-12 lg:px-16` audit responsive 1024 / 1440 / 1920.
1.5 Sticky behavior : figé vs. condensation au scroll vs. hide-on-scroll (actuel = sticky figé).
1.6 Backdrop blur : `supports-[backdrop-filter]:bg-terracotta/95` — performance check (Safari iOS).
1.7 Hairline mocha bottom : signature / valeur perçue.
1.8 Logo badge ivoire : contrast ratio (`bg-paper` sur `bg-terracotta`) WCAG 2.2.
1.9 Active state visibility : `NavLink` underline / glow / aria-current (vérifier).
1.10 CTA principal centré : copy, micro-interaction, contrast, fitt's law.

### Chapitre 2 — Architecture mega-menus (résoudre le conflit ZERO dropdown)

2.1 **Conflit doctrinal** : CLAUDE.md v6 §9.2 dit ZERO dropdown, mais scale (catalogue IA + 3500 villes) impose hub-spoke. Diagnostic : §9.2 est-il révocable via ADR, ou faut-il une autre voie (pages hub dédiées sans dropdown) ?
2.2 Pattern mega-menu retenu : hover desktop / click universel / disclosure progressive.
2.3 Profondeur max : 2 niveaux (header → mega) ou 3 (header → mega → sous-section) ?
2.4 Layout mega-menu : 2-col / 3-col / 4-col / preview cards (Vercel-style).
2.5 Délai d'ouverture / fermeture (Apple HIG : ~150ms hover-intent).
2.6 Accessibilité ARIA : `aria-haspopup`, `aria-expanded`, `aria-controls`, focus trap, ESC pour fermer.
2.7 Keyboard navigation : Tab / Arrow keys / Home / End / Esc.
2.8 Touch / tablet : pas de hover, click obligatoire.
2.9 Mobile : mega-menu = drawer accordéon ou full-screen ?
2.10 Animation : `prefers-reduced-motion` respect strict.

### Chapitre 3 — Page IA officielle : `/stack-ia` (refonte en cours)

> ⚠️ **Contexte critique mis à jour 2026-05-07** : Will a confirmé que `/stack-ia` (FR) / `/ai-stack` (EN) **EST sa page « toutes les IA »** — pas d'autre catalogue exhaustif distinct prévu. Page **en cours de refonte active** : `page.tsx` modifié (+108/-81), composant `StackHeroSchema.tsx` non encore tracké git, `stack-ia.ts` 682 lignes (5 catégories `think`/`produce`/`capture`/`build`/`orchestrate` + 11 outils sélectionnés + 4 entrées FAQ).
>
> ⚠️ **Audit doit prendre HEAD comme référence ET signaler que le working tree contient une refonte non committée** — l'agent doit lire à la fois la version HEAD et la version working tree pour avoir une vue complète, sans présumer laquelle est canonique. Les patches proposés doivent référencer HEAD.

3.0 **Question résiduelle pour Will** (pas un scénario a/b/c — un choix unique) : garder le format arsenal sélectif 11 outils (doctrine assumée, premium) OU étendre `stack-ia.ts` à un catalogue plus large (50-200 outils, ex : tous les outils que les clients AxionIA sont susceptibles d'utiliser). Trancher **après** lecture de la version refondue de `page.tsx`.
3.1 **Pas de nouveau slug séparé** : ne PAS proposer `/ia`, `/catalogue-ia`, `/intelligences-artificielles` comme pages distinctes. `/stack-ia` est la page IA officielle.
3.2 Position dans header : item dédié au header (priorité maximale) **ou** sous mega-menu « IA & Solutions » qui agrégerait `/stack-ia` + `/comparaisons` + `/guide-ia` (cette dernière existe aussi, dossier vu dans `app/[locale]/`).
3.3 Structure page catalogue : grid filtrable, recherche, catégories (chatbot / RAG / agents / vision / voice / etc.).
3.4 Pagination ou infinite scroll ou "voir plus" ?
3.5 Internal linking : chaque IA → page produit dédiée + cas-concrets pertinents + interventions associées.
3.6 Schema.org : `ItemList` + `Product` ou `Service` par IA.
3.7 Filtres URL : query params SEO-friendly (`?categorie=rag`) vs. paths (`/ia/rag`).
3.8 Differentiation éditoriale par IA (anti-doorway pages).
3.9 i18n FR/EN : structure parallèle, hreflang.
3.10 Liens sortants depuis IA → CTA audit / réservation / cas-concrets.

### Chapitre 4 — Architecture pSEO Régions

4.1 Slug stratégie : `/implantations/regions/[region]` vs. `/regions/[region]` vs. `/[region]`.
4.2 Liste régions cible : 13 régions métropole + Corse + DROM-COM (Guadeloupe, Martinique, Guyane, Réunion, Mayotte) ? **Trancher** + justifier.
4.3 Slug régions : `ile-de-france` / `auvergne-rhone-alpes` / etc. (kebab-case sans accent).
4.4 Template région : sections obligatoires (hero localisé, secteurs dominants, cas client proche, départements de la région, top 10 villes, FAQ régionale).
4.5 Différentiation éditoriale par région (chiffres économiques INSEE, secteurs porteurs, références locales).
4.6 Maillage interne : chaque région → ses villes (top 10-20), régions limitrophes, hub national.
4.7 Schema.org : `Place` + `LocalBusiness` (servicArea = région) + `BreadcrumbList`.
4.8 hreflang : version EN si pertinente (probablement FR-only pour régions FR).
4.9 Sitemap : `sitemap-regions.xml` séparé.
4.10 Lien depuis Header : sous mega-menu « Implantations » avec preview carte FR.

### Chapitre 5 — Architecture pSEO Villes (~3 500 pages)

5.1 **Décision critique : profondeur URL** :

- Option A : `/implantations/villes/[ville]` (plat, ~3500 pages au même niveau).
- Option B : `/implantations/[region]/[ville]` (hiérarchique, meilleur PageRank flow).
- Option C : `/implantations/[region]/[departement]/[ville]` (3 niveaux, navigation rich).
- **Trancher avec arguments SEO + UX + maintenance**.
  5.2 Critère ciblage : « > 5 000 habitants » (Will). Source données : INSEE / data.gouv.fr / OpenDataSoft. Geler le snapshot (ex: recensement 2022).
  5.3 Slug ville : `paris` / `lyon` / `boulogne-billancourt` (kebab-case sans accent, gestion homonymes : `saint-denis-93` vs. `saint-denis-974`).
  5.4 Template ville : sections **non-clonables** obligatoires :
- Hero localisé (« Cabinet IA opérationnel à [Ville] »).
- Démographie + tissu économique local (INSEE).
- Secteurs dominants ville (top 3-5 industries).
- Distance gare TGV / aéroport / temps trajet Paris.
- Cas client proche (rayon ~50km) si existe, sinon cas régional.
- 5-8 villes proches (linking).
- FAQ géolocalisée (« combien coûte un audit IA à [Ville] ? »).
- CTA réservation avec champ ville pré-rempli.
  5.5 Anti-doorway pages : minimum **40-60% de contenu unique** par ville (sinon Google déclasse). Plan de génération : DataForSEO + INSEE API + OpenAI/Claude pour rédaction unique par ville (Will valide pipeline).
  5.6 Schema.org : `LocalBusiness` (servicArea = ville) + `Place` + `BreadcrumbList` + `FAQPage`.
  5.7 Maillage interne : 5-8 villes proches (calcul Haversine), région parente, hub national.
  5.8 Sitemap : `sitemap-villes-[region].xml` segmenté (50K URLs max par sitemap, ~3500 villes = 1 fichier mais segmenter par région pour clarté).
  5.9 Indexation : `robots.ts` whitelist explicite, vérifier crawl budget (3500 pages sur site jeune = crawl prioritaire à piloter via Search Console).
  5.10 Hub footer : lien « Toutes les implantations » → page liste alphabétique paginée OU page carte FR cliquable.
  5.11 **Quality gate avant publication** : protocole de review humaine (échantillon X% + spot checks régions sous-représentées) avant déploiement. Définir un seuil minimum (ex: 50 villes test = ~1.5% du corpus) auditées manuellement Will avant rollout massif.
  5.12 **Rollout progressif** : ne PAS publier 3500 pages d'un coup (signal manipulation Google + risque pénalité Helpful Content). Phasage proposé : phase 1 = top 50 villes (chefs-lieux + métropoles), phase 2 = top 200, phase 3 = exhaustif. Espacement minimum 2-4 semaines entre phases. Search Console monitoring entre chaque.
  5.13 **Refresh annuel** : plan de mise à jour données INSEE (recensement annuel France métropolitaine, nouvelles populations légales). Date snapshot gelée par version → champ `dataSourceVersion` dans `src/content/villes.ts`.
  5.14 **Indexation conditionnelle** : pour villes thin-content (proche du seuil 5 000 hab, peu de différentiation possible), prévoir flag `noindex: true` dans data + `robots.ts` + `metadata.robots.index = false` côté page. Plan de promotion progressive (noindex → index quand contenu enrichi).

### Chapitre 6 — Command Palette ⌘K (standard 2026)

6.1 Présence : indispensable en 2026 (Linear, Vercel, Stripe, Cmd+K Cloud).
6.2 Position : icône loupe / chip "⌘K" dans header (entre nav et CTA ou côté locale).
6.3 Périmètre recherche : pages site + IA catalogue + villes + régions + blog + FAQ.
6.3bis **Articulation avec `/recherche` existante** : décider entre (a) ⌘K = overlay rapide avec lien « voir tous les résultats » → `/recherche?q=...`, (b) ⌘K = trigger qui ouvre directement `/recherche` au focus, (c) ⌘K standalone et `/recherche` SEO-only fallback noscript. Recommandation à argumenter.
6.4 Tech : `cmdk` (Pacôme Lebot, ~12 KB gzip) ou implémentation native.
6.5 Index : statique (build-time) ou dynamique (Algolia / Meilisearch / Pagefind self-hosted).
6.6 UX : recherche instantanée, fuzzy matching, sections groupées, raccourcis clavier.
6.7 a11y : focus trap, ESC pour fermer, ARIA `combobox` + `listbox`.
6.8 Mobile : déclenchement via icône, full-screen overlay.
6.9 Analytics : tracker requêtes vides (signal de contenu manquant).
6.10 i18n : index FR + EN séparés, switch sur locale active.

### Chapitre 7 — Mobile Navigation (drawer 2026)

7.1 Pattern : slide-in droite vs. full-screen vs. bottom-sheet.
7.2 Profondeur : 1 niveau plat ou multi-niveaux avec accordéons ?
7.3 Recherche dans drawer : ⌘K accessible aussi mobile.
7.4 CTA principal : sticky en bas du drawer (pas relégué en fin de liste).
7.5 LocaleSwitcher position : haut ou bas du drawer.
7.6 Animation : `transform` GPU only, `prefers-reduced-motion` respect.
7.7 Backdrop : tap-to-close + blur.
7.8 Body scroll lock : `overflow:hidden` sur `<html>` quand drawer open.
7.9 Focus management : focus dans drawer à l'open, return au trigger à la fermeture.
7.10 Indicateur visuel page active : underline / chip / icône.

### Chapitre 8 — Footer (hub pSEO + valeur perçue)

8.1 Architecture colonnes : actuel vs. cible (4-5 colonnes 2026 standard).
8.2 Hub « Implantations » : lien vers carte FR + top 20 villes + lien « toutes les implantations ».
8.3 Hub « IA » : lien vers catalogue + top 10 IA stratégiques.
8.4 Hub « Cas-concrets » : par secteur / par taille entreprise / par technologie.
8.5 Hub « Ressources » : Blog, FAQ, Méthodologie, Presse, ADR public si pertinent.
8.6 Hub « Cabinet » : À propos, Contact, Mentions légales, CGV, Confidentialité, Empreinte / impact.
8.7 Newsletter : présence ? double opt-in ? RGPD ?
8.8 Réseaux sociaux : LinkedIn (B2B premium prioritaire), pas X obligatoirement.
8.9 Schema.org `Organization` + `ContactPoint` + `Sameas` LinkedIn — **injection au layout-level (`app/[locale]/layout.tsx`)**, pas seulement footer, pour que toutes les pages héritent de l'entité Organization (signal AEO/GEO majeur 2026 pour Claude.ai / Perplexity / SGE).
8.10 i18n : footer EN parallèle complet.

### Chapitre 9 — Breadcrumbs & maillage interne

9.1 Coverage : toutes les pages > niveau 1 doivent avoir breadcrumbs.
9.2 Position : sous header, avant H1 (pas dans header).
9.3 Schema.org `BreadcrumbList` JSON-LD obligatoire.
9.4 i18n : labels traduits.
9.5 Mobile : version compacte (… intermédiaires si > 3 niveaux).
9.6 Page villes : `Accueil > Implantations > Région > Ville`.
9.7 Page IA : `Accueil > IA & Solutions > Catalogue > [IA]`.
9.8 Internal linking density cible : 3-5 liens contextuels minimum par page longue.
9.9 Anchor text : varié, jamais 100% « cliquez ici ».
9.10 Liens cross-section (cas-concrets ↔ interventions ↔ IA ↔ villes) : matrice à dessiner.

### Chapitre 10 — SEO / AEO / GEO 2026 specifics

10.1 **AEO (Answer Engine Optimization)** : structure FAQ par page ville/région pour citations SGE / Perplexity / Claude.ai.
10.2 **GEO (Generative Engine Optimization)** : entités nommées explicites, `<address>`, `LocalBusiness` schema partout.
10.3 Canonical : strict, jamais double indexation FR vs. EN.
10.4 hreflang : matrice complète FR ↔ EN, x-default = FR.
10.5 Sitemap index : `sitemap.xml` racine pointant vers `sitemap-pages.xml`, `sitemap-regions.xml`, `sitemap-villes-*.xml`, `sitemap-ia.xml`, `sitemap-blog.xml`.
10.6 robots.txt : whitelist explicite, pas de wildcard dangereux.
10.7 OpenGraph + Twitter cards : par page, image dynamique (`opengraph-image.tsx` Next.js 16).
10.8 Core Web Vitals : LCP < 2.5s, INP < 200ms, CLS < 0.1 (vérifier impact mega-menu + ⌘K).
10.9 Page speed villes : SSG strict (build-time), pas SSR (3500 pages SSR = coût hosting prohibitif).
10.10 ISR / on-demand revalidation : stratégie pour mises à jour catalogue IA + cas-concrets sans rebuild complet.
10.11 **Tests** : extension du pattern test existant (`utils.test.ts`, `JsonLd.test.tsx`, `press.test.ts`) — pour chaque nouvelle factory `lib/seo.ts` (LocalBusiness, Place, Breadcrumb, ItemList) ajouter un test unitaire validant la structure JSON-LD (validator schema.org). Pour le composant ⌘K et mega-menu : tests a11y (axe-core) + tests interactifs (RTL).
10.12 **Indexing API Google** : pour les villes phase 1 (top 50), soumission via Indexing API pour accélérer crawl initial. Pour les phases 2-3, attendre crawl naturel (Sitemap + maillage interne suffisent).

---

## 🛠️ MÉTHODOLOGIE D'AUDIT (5 agents parallèles + agent principal)

### Agent A — Inventaire interne (lecture seule)

- Lire `Header.tsx`, `MobileNav.tsx`, `NavLink.tsx`, `LocaleSwitcher.tsx`, `Breadcrumbs.tsx`, `Footer.tsx`.
- Lire `messages/fr.json` et `messages/en.json` (sections nav).
- Lire `app/[locale]/layout.tsx` + `app/sitemap.ts` (si existe) + `app/robots.ts` (si existe).
- Inventorier toutes les pages existantes : `find axionia/src/app/[locale]` → mapper vers nav.
- Output : `header-current-state.md` (snapshot exhaustif).

### Agent B — Benchmark externes (WebFetch)

- WebFetch sur les 13 sites benchmark (chapitre Sources).
- Pour chaque : extraire structure header (DOM), profondeur menus, ⌘K présence, footer columns.
- Output : `benchmarks-2026.md` avec matrice comparative.

### Agent C — Diagnostic conflit doctrinal §9.2 (CLAUDE.md)

- Lire `axionia/CLAUDE.md` v6 §9.2 in extenso.
- Identifier le « pourquoi » historique du ZERO dropdown (probablement : éviter complexité, focus conversion, signature minimaliste).
- Évaluer si la scale (catalogue IA + 3500 villes) rend §9.2 incompatible.
- Proposer 3 voies :
  - **Voie 1** : maintenir §9.2, créer pages hub dédiées (ex: `/implantations` = page complète avec carte cliquable, pas de mega-menu).
  - **Voie 2** : ADR de révision §9.2 → autoriser mega-menus mais avec garde-fous (max 2 mega-menus, max 2 niveaux, design éditorial cohérent).
  - **Voie 3** : hybride — mega-menus mais minimalistes (3 liens max par mega), reste = pages hub.
- Output : `adr-0003-navigation-mega-menu-PROPOSITION.md` (draft ADR à valider Will).

### Agent D — Stratégie pSEO villes (data + différentiation)

- Estimer volume exact villes FR > 5 000 hab (source INSEE 2022).
- Lister les 10 plus gros pièges pSEO 2026 (Google Helpful Content Update, Perspectives ranking, doorway pages, near-duplicate content).
- Proposer pipeline de génération éditoriale (data sources + structure prompt LLM + pourcentage humain review).
- Estimer coût (tokens LLM + temps Will review) pour 3500 pages.
- Output : `pseo-strategy.md` + estimation chiffrée.

### Agent E — Audit fit avec stack existante (anti-réinvention)

- Lire `src/content/*.ts` (tous fichiers) pour comprendre le pattern de typage et les exports `getAllSlugs` / `getById`.
- Lire `src/i18n/routing.ts` (`routing.pathnames`) pour comprendre le mapping FR↔EN et les conventions de nommage.
- Lire `src/lib/seo.ts` exhaustivement et lister les helpers existants vs. ceux à ajouter.
- Lire `src/app/sitemap.ts` et `src/app/robots.ts` — comprendre `buildDynamic`, identifier exactement où injecter les nouvelles routes villes/régions.
- Lire `src/components/marketing/JsonLd.tsx` — confirmer signature props.
- Lire `src/lib/schemas/forms.ts` — identifier si schema réservation a déjà un champ ville.
- Lire le contenu actuel de `src/app/[locale]/stack-ia/` (si présent) et `src/content/stack-ia.ts` complet pour comprendre la doctrine arsenal vs. catalogue.
- Output : `stack-fit-analysis.md` listant pour chaque proposition d'architecture cible :
  - Fichier(s) à créer (chemin précis).
  - Fichier(s) à étendre (signature ajout).
  - Fichier(s) à NE PAS toucher.
  - Patterns à réutiliser (avec extraits code line-numbered).
  - Anti-patterns détectés dans les autres chapitres à corriger.

### Agent principal — Synthèse + architecture cible + patches

- Consolider les 5 agents.
- Dessiner l'architecture cible (header + mega-menus + footer + sitemap).
- Produire 3 scénarios chiffrés :
  - **Scénario MIN** : pas de mega-menu (Voie 1), juste ajout `/ia`, `/implantations` hub, ⌘K basique. Effort : ~2-3 jours.
  - **Scénario STANDARD** : 1-2 mega-menus légers (Voie 3), ⌘K complet, breadcrumbs partout, footer hub enrichi. Effort : ~5-7 jours.
  - **Scénario PERFECTION 2026** : mega-menus complets (Voie 2 avec ADR), ⌘K avancé (Pagefind/Meilisearch), pSEO 3500 villes templates différenciées, schema partout. Effort : ~3-4 semaines (incluant rédaction).
- Pour chaque scénario : LCP impact estimé, SEO upside estimé, risque doorway pages.
- Output : `_AUDIT/AUDIT-HEADER-NAVIGATION-2026.md` (rapport principal) + `header-architecture.json` (structure cible) + `nav-routes.csv` (mapping URLs cible) + diffs de patch en annexe.

---

## ⛔ INTERDITS ABSOLUS

- ❌ **Modifier la couleur de fond `bg-terracotta`** du header (Will explicit).
- ❌ **Modifier le logo** (badge ivoire + Axion-IA serif italique). Padding interne, taille du badge, oui — design du logo, NON.
- ❌ **Coder en suivant les patterns Next.js < 16** (lire `node_modules/next/dist/docs/` avant — AGENTS.md).
- ❌ **Générer des pages villes templates clonées** sans plan de différenciation éditoriale (doorway pages = pénalité Google certaine).
- ❌ **Réviser CLAUDE.md v6 §9.2** sans ADR explicite validé par Will.
- ❌ **Proposer des dépendances lourdes** (Algolia search Cloud à 500€/mois) sans alternative self-hosted (Pagefind, Meilisearch).
- ❌ **Casser l'a11y existante** (focus visible, contraste, WCAG 2.2 AA).
- ❌ **Toucher au code dans cet audit** — diagnostic + proposition uniquement.

---

## ✅ LIVRABLES ATTENDUS (récapitulatif)

0. **`_AUDIT/stack-fit-analysis.md`** (Agent E — pré-requis aux autres livrables) : analyse fit avec stack existante, anti-réinvention, fichiers à créer/étendre/laisser intacts.

1. **`_AUDIT/AUDIT-HEADER-NAVIGATION-2026.md`** (rapport principal, ~3000-5000 mots) :
   - Synthèse exec (1 page).
   - Diagnostic état actuel (par chapitre 1-10).
   - Benchmark comparatif 13 sites (matrice).
   - Architecture cible (3 scénarios chiffrés).
   - Conflit §9.2 + proposition résolution.
   - Roadmap d'implémentation (Sprints).
   - Annexes : diffs proposés pour `Header.tsx`, `MobileNav.tsx`, nouveaux fichiers `app/[locale]/ia/`, `app/[locale]/implantations/`, `messages/*.json` patches.

2. **`_AUDIT/header-architecture.json`** : structure JSON formalisée du nav cible (items, mega-menus, slugs, schema).

3. **`_AUDIT/nav-routes.csv`** : tableau toutes les URLs cibles avec colonnes `path | template | sitemap | priority | hreflang | schema_type | parent_breadcrumb`.

4. **`_AUDIT/adr-0003-navigation-mega-menu-PROPOSITION.md`** : draft ADR pour révision §9.2 (à valider Will avant merge dans CLAUDE.md).

5. **`_AUDIT/pseo-strategy.md`** : stratégie pSEO villes différenciation + estimation coût.

6. **`_AUDIT/benchmarks-2026.md`** : matrice 13 benchmarks externes.

7. **`_AUDIT/adr-0004-pseo-villes-PROPOSITION.md`** (si scénario STANDARD ou PERFECTION retenu) : ADR engagement scale 3500 pages, source données INSEE, pipeline éditorial, budget, échéances.

---

## 🚦 PROTOCOLE STOP & ASK

À chaque jonction critique, **STOP** et demander validation Will avant de continuer :

1. **Avant de proposer toute action sur `/stack-ia`** : page **en cours de refonte non committée** (working tree avec +108/-81 sur `page.tsx`, `StackHeroSchema.tsx` non tracké). Will doit (a) committer ou stash sa refonte avant que l'agent commence, OU (b) confirmer que l'agent doit prendre HEAD comme référence et ignorer le working tree. Bloquant.
2. **Question 11 outils vs catalogue plus large** dans `/stack-ia` (chapitre 3.0) — Will tranche après lecture refonte.
3. **Avant de finaliser la profondeur URL villes** (Option A / B / C chapitre 5.1).
4. **Avant de valider la liste régions** (métropole only ou + DROM-COM).
5. **Avant de proposer ADR §9.2** (révocation doctrine = décision majeure).
6. **Avant d'estimer le pipeline pSEO 3500 villes** (coût LLM + revue éditoriale = budget significatif).
7. **Avant de recommander un scénario** (MIN / STANDARD / PERFECTION 2026).
8. **Avant de proposer un split sitemap** (`sitemap-index.xml` + sous-sitemaps via routes Next 16) — refactor non-trivial du `sitemap.ts` actuel.

Pas de patch écrit sans validation explicite Will pour ce qui touche :

- couleur header, logo (interdits absolus rappelés).
- doctrine CLAUDE.md.
- génération massive de pages.

---

## 📐 FORMAT DE SORTIE PRINCIPAL

Le rapport `AUDIT-HEADER-NAVIGATION-2026.md` doit ouvrir sur :

```
# Audit Header & Navigation 2026 — AxionIA

> Statut : DRAFT en attente validation Will
> Date : 2026-05-XX
> Référence HEAD : <sha>
> Périmètre : Header desktop + mobile + mega-menus + footer + pSEO régions/villes + ⌘K

## 0. Synthèse exécutive (1 page)

**Diagnostic** : <2-3 phrases sur l'état actuel>.
**Recommandation** : <scénario retenu + justification 1 phrase>.
**Effort estimé** : <jours-homme>.
**Risques** : <top 3>.
**Décisions Will requises** : <liste numérotée des STOP & ASK>.
```

Puis chapitres 1-10 systématiques avec, par chapitre :

- ✅ État actuel (avec extraits code line-numbered).
- 🎯 Standard 2026 (avec benchmark explicite).
- 🔴 / 🟠 / 🟢 Verdict.
- 🛠️ Patch proposé (diff annexe).

---

## 🎬 EXEMPLE DE LANCEMENT (pour Will)

> « Lance l'audit Header & Navigation 2026 selon `_AUDIT/PROMPT-HEADER-NAVIGATION-2026.md`. Garde absolument le fond terracotta et le logo. Fais le diagnostic + 3 scénarios chiffrés. STOP & ASK avant chaque décision majeure (slug, URL profondeur, ADR §9.2). Pas de code écrit, juste diffs en annexe. »

---

**Fin du prompt v1.3 · 2026-05-07.**

---

## 📝 CHANGELOG

- **v1.3 (2026-05-07)** : Will confirme `/stack-ia` = SA page « toutes les IA » officielle, refonte active non committée (`page.tsx` +108/-81, `StackHeroSchema.tsx` non tracké). Suppression du scénario « catalogue exhaustif distinct » (plus de slug `/ia` séparé). Chapitre 3 réécrit : question résiduelle 11 outils vs catalogue plus large dans `/stack-ia`. Inventaire `app/[locale]/` complet ajouté (32 dossiers vérifiés sur disque). Pages régions/villes/implantations confirmées comme **inexistantes** sur disque (à architecturer, pas à auditer). STOP & ASK n°1 reformulé : commit/stash refonte `/stack-ia` avant audit.
- **v1.2 (2026-05-07)** : `/recherche` existante intégrée (chapitre 6.3bis articulation avec ⌘K, pas duplication). Inventaire pages complété (`/stack-ia`, `/preferences-cookies`, `/desabonnement`, `/mes-donnees`, `/confirmation`, dev shells). Chapitre 5 enrichi : quality gate (5.11), rollout progressif phases 1-3 (5.12), refresh annuel INSEE (5.13), indexation conditionnelle thin-content (5.14). Organization JSON-LD au layout-level (8.9). Tests pour nouvelles factories (10.11). Indexing API Google phase 1 (10.12). ADR 0001 + 0002 nommés explicitement.
- **v1.1 (2026-05-07)** : intégration stack & centralisations existantes (`src/content/*.ts`, `routing.pathnames`, `lib/seo.ts`, `sitemap.ts`, `JsonLd.tsx`). Ajout Agent E (audit fit anti-réinvention). STOP & ASK n°5 ajouté pour scope `/stack-ia` (page livrée même jour, ne pas écraser la doctrine arsenal). Ajout ADR-0004 conditionnel pour engagement pSEO. Chapitre 3 réécrit pour distinguer arsenal vs. catalogue exhaustif.
- **v1.0 (2026-05-07)** : version initiale, 10 chapitres × 10 critères, 4 agents parallèles, 3 scénarios chiffrés, contraintes intouchables (fond terracotta + logo).
