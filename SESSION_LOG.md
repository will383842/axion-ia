# SESSION_LOG — Axion-IA

> Append-only journal of work sessions on the Next.js codebase.
> One entry per significant session. Most recent on top.

---

## 2026-05-07 — Sprint AEO/GEO 2026 + audit Header & Nav + obsolescences purgées

**Auteur** : Will + Claude Opus 4.7 (1M context)

**Commits** (cette session, sur `main`) :

- `e245d13` `fix(seo+nav)` — audit Header/Nav 2026 quick wins (sitemap G5, footer orphelines, Organization JSON-LD enrichi).
- `1626aaa` `feat(header)` — badge prix CTA central + tracking + drawer mobile étendu §9.4.
- `acd8080` `feat(seo)` — sitemap-index split Next 16 (`generateSitemaps`, 6 sous-sitemaps) + factories Organization/WebSite + cleanup `SITE_URL` × 8 fichiers.
- `eda574b` `feat(aeo+geo)` — obsolescences audit closes (tarifs audit alignés sur pyramide actuelle, placeholders légaux neutralisés, OG image v3 `#1a4dd9`, /blog/[slug] câblé `buildArticleJsonLd`) + 5 nouvelles factories (Person, Article, FaqSpeakable, LocalBusiness, Place, ItemList).
- `5d9d527` `refactor(seo+css)` — dedupe homepage Organization + rename `--ease-out-webflow` → `--ease-out-editorial` + nettoyage commentaires Webflow.

**Audit livré** (`_AUDIT/`, ~272 KB de docs) :

- `AUDIT-HEADER-NAVIGATION-2026.md` (rapport principal, 5 agents A-E parallèles + synthèse).
- `header-architecture.json` + `nav-routes.csv` (50+ routes mappées).
- `01-A-inventaire-nav.md` (Agent A inventaire interne, ~830 lignes).
- `benchmarks-2026.md` (Agent B, 11/13 sites).
- `adr-0003-navigation-mega-menu-PROPOSITION.md` (Agent C, sera renommée `axionia/docs/adr/0005`).
- `adr-0004-pseo-villes-PROPOSITION.md` (Agent D + amendement Will V1=2150 villes >5000hab France, sera renommée `0006`).
- `pseo-strategy.md` (Agent D, ~580 lignes).
- `stack-fit-analysis.md` (Agent E, ~1130 lignes, 8 centralisations critiques).
- `STRATEGIE-AEO-GEO-2026.md` (référence stratégique cible #1 ville/région).
- `AUDIT-OBSOLESCENCES-CONFLITS-2026-05-07.md` (audit complet, 382 lignes).
- `PHASE-FRONTEND-FINAL-PSEO-VILLES-REGIONS.md` (plan d'exécution chantier post-frontend).

**Décisions Will** validées en bloc 2026-05-07 (8 STOP & ASK + amendement) :

- Q1 11 outils `/stack-ia` conservés.
- Q2 URL hiérarchique `/implantations/[region]/[ville]`.
- Q3 métropole + 5 DROM, exclure COM.
- Q4 Voie 2 mega-menus avec garde-fous WCAG 2.2 AA.
- Q5 pipeline 80/20 LLM/Will + prompt caching Claude Sonnet 4.6.
- Q6 phase 1 = top 50 villes (chefs-lieux + métropoles).
- Q7 sitemap-index + sous-sitemaps (livré via `generateSitemaps`).
- Q8 ⌘K Sprint post-pSEO.
- **Amendement périmètre** : V1 = TOUTES villes >5 000 hab (~2 150) au lieu de 1 160 >10 000 hab. Coût recalculé 3 200-12 000 €.

**Infrastructure SEO/AEO/GEO 2026 livrée** :

- 12 factories JSON-LD dans `lib/seo.ts` : `buildProductMetadata`, `buildServiceJsonLd`, `buildFaqJsonLd`, `buildFaqSpeakableJsonLd`, `buildBreadcrumbJsonLd`, `buildOrganizationJsonLd`, `buildWebsiteJsonLd`, `buildPersonJsonLd`, `buildArticleJsonLd`, `buildLocalBusinessJsonLd`, `buildPlaceJsonLd`, `buildItemListJsonLd`.
- `Organization` JSON-LD enrichi layout-level (10 champs) : logo + sameAs LinkedIn+Facebook + foundingDate 2024 + foundingLocation Tallinn EE + areaServed FR+EU + knowsLanguage + contactPoint bilingual + slots `vatID`/`registrikood` optionnels.
- `Person` Will câblé `/a-propos` (E-E-A-T 2026).
- `Article` complet `/blog/[slug]` (Person author + `dateModified` + `wordCount` + `keywords` + `articleSection` + `mainEntityOfPage` + image dynamique `/api/og`).
- `FaqSpeakable` câblé homepage + `/faq` + `/presse` (Google Assistant + Alexa + Bixby voice citations).
- Sitemap-index `/sitemap.xml` + 6 sous-sitemaps (`/sitemap/{pages,blog,help,cas-concrets,comparaisons,implementation}.xml`).
- `BlogPost.updatedAt?: string` field ajouté pour signal `dateModified` distinct de `datePublished`.
- Bug sitemap G5 corrigé (`/implementation/par-fonction/[slug]` 16 URLs maintenant indexables).
- Cleanup Webflow complet (0 occurrence "Webflow" restante dans `src/`).
- 5 paires hreflang `fr` / `en` / `x-default=fr` partout via `routing.pathnames` source unique.

**Verify** : `pnpm verify:all` green (typecheck + lint + i18n 156 keys parité + 4 anti-banni gates + contrast 30 pairs ≥ AA + radius ≤ 8 px + 96/96 vitest tests). Build Next.js 16 production OK.

**Données Estonia restantes** (Will fournira plus tard) : `vatID` (`EE-XXXXXXXXX`) + `registrikood`. Slots optionnels prêts dans `buildOrganizationJsonLd({ locale, vatID, registrikood })` à câbler depuis `layout.tsx`.

**Prochain chantier** : Phase Frontend Final pSEO Villes/Régions (cf. `_AUDIT/PHASE-FRONTEND-FINAL-PSEO-VILLES-REGIONS.md`). V1 = ~2 150 villes >5 000 hab France métropole + 5 DROM. Pipeline LLM Claude Sonnet 4.6 + prompt caching. Rollout 3 phases sur 12 semaines. **NON LANCÉ** — Will finit le frontend en cours avant. Sprint 15 backend (Prisma) reste un chantier distinct.

---

## 2026-05-07 — Purge site-wide « 90 jours » + « Tallinn / Estonie »

**Auteur** : Will + Claude Opus 4.7
**Référence** : suite directe du Sprint 14.6 (page presse) — Will a demandé la purge complète après revue de la page presse.

### Décision

- **« 90 jours »** : retiré de **toutes** les copies user-visible du site (« nulle part »).
- **« Tallinn » / « Estonie » / « Estonian » / « OÜ estonienne »** : retiré de toutes les copies marketing + nav + JSON-LD home/layout.
- **`src/content/legal.ts` conservé en l'état** (option A) — les mentions « droit estonien », « AKI », « TVA EE » sont **légalement obligatoires** (RGPD art. 13(1)(d), droit commercial estonien, transparence fiscale UE).

### Replacements appliqués

| Avant                                        | Après                                                     |
| -------------------------------------------- | --------------------------------------------------------- |
| ROI 90 jours / 90-day ROI                    | ROI mesurable / Measurable ROI                            |
| plan 90 jours / 90-day plan                  | plan d'action chiffré / costed action plan                |
| plan chiffré 90 j                            | plan chiffré priorisé / prioritised costed plan           |
| 30 / 60 / 90 jours (prévisions auto)         | 30 / 60 / 120 jours                                       |
| metric1 home « 90j → premiers gains »        | metric1 « 5j → cartographier toutes vos opportunités IA » |
| Tallinn, Estonie / Tallinn, Estonia          | retiré (footer bottom strip + contact)                    |
| OÜ estonienne / Estonian OÜ                  | Cabinet européen / European consultancy                   |
| société estonienne                           | Axion-IA OÜ / régime TVA UE                               |
| addressLocality: "Tallinn" (JSON-LD home)    | retiré                                                    |
| foundingLocation: "Estonia" (JSON-LD layout) | retiré                                                    |
| FAQ audit « Vous êtes une OÜ estonienne ? »  | « Axion-IA peut-elle facturer en France ? »               |

### Fichiers touchés (15)

- `src/messages/fr.json` + `en.json` (4 clés : module1Description, ctaBlockDescription, metric1\*, method3Title)
- `src/content/transversal.ts` (ABOUT_TIMELINE, FAQ_GLOBAL definition + billing, HELP_ARTICLES audit + facturation)
- `src/content/implementation.ts` (Module 3 processus FR + EN)
- `src/content/automatisations.ts` (prévisions de vente FR + EN)
- `src/content/press.ts` (déjà nettoyé Sprint 14.6 — facts, pitch, releases, spokesperson, FAQ)
- `src/app/[locale]/page.tsx` (home metadata + JSON-LD Organization address)
- `src/app/[locale]/layout.tsx` (Organization JSON-LD foundingLocation)
- `src/app/[locale]/a-propos/page.tsx` (valeur ROI mesurable)
- `src/app/[locale]/contact/page.tsx` (ligne juridiction)
- `src/app/[locale]/methodologie/page.tsx` (4 mentions 90j → priorisé/post-déploiement)
- `src/app/[locale]/cas-concrets/[slug]/page.tsx` (CTA description)
- `src/app/[locale]/audit/page.tsx` (2 FAQ FR + EN)
- `src/app/[locale]/sections/page.tsx` (dev showcase timeline)
- `src/app/[locale]/mes-donnees/page.tsx` (AKI mention rephrasée)
- `src/components/nav/Footer.tsx` (bottom strip)
- `src/components/sections/AuditConversionBlocks.tsx` (TrustBadges FR + EN)
- `src/components/calendar/BookingCalendar.tsx` (trust badge calendrier)
- `src/app/api/og/route.tsx` (badge image OG sociale)
- `src/app/llms.txt/route.ts` + `llms-full.txt/route.ts` (manifeste LLM 7 patches)

### Pages légales conservées (option A — recommandée)

`src/content/legal.ts` garde les 24 mentions Estonie/Tallinn/estonien dans :

- Mentions légales (siège social — obligation droit commercial)
- CGV (droit applicable + tribunaux compétents — obligation contractuelle)
- Politique de confidentialité (AKI · obligation RGPD art. 13(1)(d))
- Politique RGPD (autorité de contrôle compétente nommée)
- Politique de déplacement (juridiction)

Toucher à ces pages mettrait le site **en non-conformité légale**. Will peut décider plus tard de modifier la juridiction effective de la société (changement statutaire OÜ → autre forme), auquel cas legal.ts sera mis à jour en cohérence.

### CI gates

- `pnpm typecheck` : ✅ 0 erreur
- `pnpm lint` : ✅ 0 erreur (5 warnings préexistants forms)
- `pnpm i18n:check` : ✅ 223 keys in sync
- `pnpm test` : ✅ 96/96 tests verts
- `pnpm build` : ✅ SSG OK, toutes les routes prerenderées
- 0 mention de « 90 jours » / « Tallinn » / « Estonie » hors `src/content/legal.ts`

---

## 2026-05-07 — Audit transverse parité design (footer + toutes pages) + i18n hotfix produit

**Auteur** : Will + Claude Opus 4.7
**Référence** : déclenché par audit Will sur parité hero/design des pages footer, étendu à l'ensemble des 65 entry files de l'app.

### Contexte

Audit demandé : « vérifier que les pages de chaque onglet du footer utilisent bien le même design que la home/interventions/audit ». Étendu après identification de bugs partagés à toutes les pages de l'app.

### Bugs critiques identifiés et corrigés

**🔴 P0 WCAG 2.4.6 — pages sans `<h1>`** (8 pages)

- 5 pages Legal via `LegalPageTemplate.tsx` : pas de `titleAs="h1"` → typo `clamp(2.25rem,4.5vw,4rem)` h2 au lieu de `display-editorial` Fraunces géant + padding réduit + zéro `PageHeroDecoration` SVG.
- 1 page Legal additionnelle (`politique-deplacement`) consomme le même template.
- `/blog/[slug]` (tous articles) et `/cas-concrets/[slug]` (tous cas) idem `<Section title>` sans `titleAs="h1"`.

**🔴 P0 i18n — strings FR hardcodées qui leakaient sur EN** (impact 18 pages produits)

- `ProductPageTemplate.tsx` : eyebrow fallbacks `"Réservation"`/`"Chiffres"` + bloc `ReserveBigCta` complet (« Réservation directe », « Je réserve cette intervention », « Sélectionnez votre date dans le calendrier maison », « À partir de … € HT pour une journée sur site », « Sur devis · réponse sous 48 h ouvrées », « Confirmation immédiate, paiement 50 % à la réservation », « Voir le calendrier complet », « ★ Frais de déplacement et hébergement au forfait journalier · pas de justificatifs »).
- `LegalPageTemplate.tsx` : eyebrow `"Légal"` + label `"Dernière mise à jour : "` hardcodés FR.
- `/cas-concrets/[slug]` : eyebrow `"Cas concret · accent green"` (leak dev → texte visible utilisateur).
- `BookingCalendar.tsx` ligne 1174 : `DialogTitle` sr-only `"Réservation"` (impact lecteurs d'écran sur version EN).

### Livré

- `LegalPageTemplate` patché : prop `isFr` requise, `titleAs="h1"`, eyebrow + label localisés FR/EN.
- `ProductPageTemplate` patché : prop `isFr` requise, fallbacks `"Booking"` / `"By the numbers"`, `ReserveBigCta` 100 % bilingue.
- `ProductHero` inchangé (déjà conforme).
- 6 pages Legal mises à jour (`mentions-legales`, `conditions-generales`, `politique-confidentialite`, `cookies`, `rgpd`, `politique-deplacement`) : passent désormais `isFr` au template.
- 18 pages produits mises à jour avec `isFr={loc === "fr"}` : `audit/{flash,process,strategique-eti,strategique-pme}`, `interventions/{conference,dirigeants,equipes,essentielle,managers}`, `implementation/{agents,chatbot,crm-erp,documents,ia-custom,integrations,no-code,processus,structuration}`.
- `/blog/[slug]` et `/cas-concrets/[slug]` : ajout `titleAs="h1"` + `description={copy.excerpt}` ; nettoyage du leak « accent green » dans l'eyebrow.
- `BookingCalendar.tsx` : `DialogTitle` sr-only localisé.
- README + SESSION_LOG mis à jour pour refléter les obsolescences purgées (mentions « Webflow-inspired » → « Editorial Premium Light v3.1 », ajout Fraunces dans la stack, arborescence `[locale]/` détaillée).

### Pages auditées sans dette

100 % des 65 entry files (`page.tsx`, `error.tsx`, `not-found.tsx`, `loading.tsx`) passent désormais le check parité design : tous utilisent soit `<Section titleAs="h1" tone="halo-warm">`, soit un hero manuel canonique équivalent (`bg-halo-warm` + `display-editorial` Fraunces + dot terracotta + `italic-editorial` titleEm). Templates `ProductPageTemplate`, `LegalPageTemplate`, `ProductHero` 100 % bilingues.

### CI gates

- `pnpm typecheck` : ✅ 0 erreur (28 fichiers patchés)
- `pnpm lint` : ✅ 0 erreur (5 warnings préexistants `react-hook-form` `watch()`)
- `pnpm test` : ✅ 96/96 verts (16 test files)
- `pnpm build` : ✅ SSG OK, toutes les routes prerenderées

### Limitations / suites

- Pages dev `/design`, `/sections`, `/components` contiennent encore des références obsolètes (palette Webflow `#146ef5`, mentions « Sprint 3/4 », `bg-gray-*` qui n'existent plus dans v3.1). Pages `noindex` mais à rafraîchir pour cohérence interne — séparée de la passe parité.
- `processEyebrow` / `metricsEyebrow` overrides toujours typés `string` (pas `{ fr; en }`) — mais déjà localisés via `content/audit.ts`. OK comme tel.

---

## 2026-05-07 — Sprint correctif 14.6 · Page presse (FR + EN)

**Auteur** : Will + Claude Opus 4.7
**Référence** : `_AUDIT/PROMPT-PAGE-PRESSE.md`

### Contexte

Avant l'audit `PROMPT-SEO-AEO-GEO-2026.md`, ouverture d'un mini-sprint pour
créer un espace presse complet — signal GEO E-E-A-T fort (page autorité
médias + porte-parole + communiqués + press kit) et point d'entrée pour
journalistes. Inspiration mise en page : page `/fr-fr/presse` SOS-Expat,
mais transposée 100 % à la doctrine HEAD Axion-IA (titleEm serif italique,
accents terracotta, halo warm, mocha-rich pour la bande contact).

### Livré

- Routes `/fr/presse` + `/en/press` (SSG, build OK)
- Hero halo-warm + page hero decoration (anneaux + halos terracotta)
- 8 sections : Pitch + Facts (carte aside) · Press Kit · Communiqués ·
  Porte-parole · Couverture médias · Contact mocha-rich · FAQ
- 6 nouveaux composants : `PressFacts`, `PressKit`, `PressReleases`,
  `MediaCoverage`, `PressSpokesperson`, `PressContact`
- Source de vérité unique : `src/content/press.ts` (fixtures FR + EN
  prêtes à migrer en M8 vers Prisma — slugs explicites, ReadonlyArray
  immutables, helpers `getPressRelease` / `getAllPressReleaseSlugs`
  miroir du pattern blog)
- 15 nouveaux tests Vitest (parité FR/EN, intégrité fixtures, anti-siren,
  unicité slugs, format ISO, FAQ ?-terminée, https URLs)
- Footer : lien « Presse / Press » ajouté en colonne Company
- i18n : namespace `press` (66 clés × 2 langues, parité OK 223 keys total)
- JSON-LD : WebPage + NewsroomPage + Organization (ContactPoint media
  inquiry) + Person (porte-parole `knowsAbout`/`sameAs`) + FAQPage +
  ItemList(NewsArticle) + BreadcrumbList + speakable
- Mapping pages mis à jour (`_AUDIT/02b-mapping-pages.md`)
- Dossier `public/press-kit/` + README pour Phase 2 (binaires Will)

### CI gates

- `pnpm typecheck` : ✅ 0 erreur
- `pnpm lint` : ✅ 0 erreur (5 warnings préexistants forms `react-hook-form`)
- `pnpm i18n:check` : ✅ 223 keys in sync FR/EN
- `pnpm test` : ✅ 96/96 tests verts (15 nouveaux pour press)
- `pnpm build` : ✅ SSG OK, `/fr/presse` + `/en/presse` prerenderés
- 0 hex hardcoded, 0 SIREN/SIRET/RCS, 0 mention "formation/formateur"

### Limitations Phase 1 assumées

- Press kit assets en placeholders (`fileUrl: null` → bouton « Bientôt
  disponible » désactivé). Will fournit binaires Phase 2.
- Couverture médias vide intentionnellement (anti-pattern E-E-A-T :
  jamais fabriquer de mentions inexistantes — message transparent).
- Pas de page détail `/presse/[slug]` (cards mentionnent "Q3 2026").
  À ajouter quand pages dédiées par communiqué utiles.
- Email `presse@axion-ia.com` à créer côté DNS/MX (alias `contact@`
  Phase 1 acceptable).

### Préparation backend (raccordement console admin M8 + M9)

`src/content/press.ts` est conçu pour migration directe vers Prisma :

| Fixture                | Table cible (M8 — à ajouter aux 18 prévues)               |
| ---------------------- | --------------------------------------------------------- |
| `PRESS_RELEASES`       | `press_releases` + `press_release_translations`           |
| `PRESS_KIT_ASSETS`     | `press_kit_assets` (kind enum + fileUrl + format)         |
| `PRESS_MEDIA_COVERAGE` | `press_media_coverage` (outlet, url, publishedAt)         |
| `PRESS_SPOKESPERSONS`  | `press_spokespersons` + translations + `knowsAbout` array |
| `PRESS_FAQ`            | `press_faqs` + translations                               |
| `PRESS_PITCH`          | `settings.press_boilerplate_fr` + `_en` (singleton)       |
| `PRESS_FACTS`          | `settings.press_facts` (jsonb) ou `press_facts` table     |

Console admin M9 : ajouter une 15ᵉ section « Presse » au plan (les 14
listées dans `_AUDIT/02-PLAN.md` n'incluent pas la presse). Sous-onglets
suggérés : Communiqués · Kit · Médias · Porte-parole · FAQ · Pitch.

---

## 2026-05-06 — Sprint 5b (correctif) · Home + Design v3 Editorial Premium

**Auteur** : Will + Claude Opus 4.7
**Référence** : ADR `docs/adr/0002-design-pivot-editorial-v3.md`

### Contexte

Inspection live home post-Sprint 14 par Will → 2 verdicts :

1. **Home placeholder Sprint 2 jamais remplacée** (Sprint 5 a livré pages produits, oublié home — trou non détecté par FRONTEND-DEEP-CHECK).
2. **Doctrine "Webflow-light"** rejetée : _« vieillot, sans contraste, tout est blanc, trop carré »_. Pivot dark agressif aussi rejeté (_« haut de gamme sans noir »_). Direction validée → **Editorial Premium Light** (Anthropic / Mistral / Ramp).

### Décisions structurantes

- **ADR 0002** : Editorial Premium Light supersedes la doctrine implicite Webflow-light.
- **Aucun fond noir** : ivoire / sand / mocha (brun-aubergine) au lieu de blanc / noir.
- **Fraunces serif** chargée via `next/font` — titres + numbers + pull-quotes.
- **Italiques terracotta** sur 1-2 mots-clés par titre (signature Anthropic).
- **6 tones de Section** : canvas / paper / sand / halo-warm / halo-cool / mocha.
- **Webflow Blue préservé** comme couleur identitaire `#1a4dd9`.
- **i18n keys split** en `Part1` / `Em` / `Part2` pour rendre les italiques sans markup dans les traductions.

### Livré ce sprint correctif

**Home conversion-grade refondée** (`[locale]/page.tsx`) — 11 sections alternées :

- Hero ivoire `bg-halo-warm` avec titre Fraunces géant 112px + italique terracotta
- Trust strip sable (4 trust-points icônes circulaires)
- Modules paper avec 3 cards radius-xl (numéros 01/02/03 mono)
- Metrics mocha-rich (numbers Fraunces 96-112px)
- Méthode halo-cool (4 colonnes border-top + numéros serif terracotta)
- Cas concrets paper (3 cards titles serif + badges sand/terracotta-soft)
- ROI sand (carte centrale paper)
- Témoignages paper (4 pull-quotes serif italic + guillemets terracotta géants)
- FAQ canvas (accordion natif + FAQPage JSON-LD)
- CTA final mocha-rich avec italique terracotta
- JSON-LD Organization + WebSite + FAQPage

**Refonte tokens (`globals.css` v3)** :

- 4 surfaces sans noir : `bg`, `paper`, `sand`, `mocha`, `mocha-soft`
- 3 fonds composés : `bg-halo-warm`, `bg-halo-cool`, `bg-mocha-rich`
- Foreground : `fg`, `fg-soft`, `fg-muted` anthracites-bruns
- Accents : `terracotta`, `terracotta-soft`, `terracotta-deep`, `sage`, `sage-soft`
- Radius : `xl` 20px, `2xl` 28px
- Shadows : tons chauds rgba(42,37,32,…)
- Utilities : `text-display-editorial`, `italic-editorial`, `cta-lift`

**Layout root** : Fraunces chargée via `next/font/google` (variable + italique).

**Composants partagés refondus (15 fichiers)** :

- `<Header>` + `<NavLink>` + `<LocaleSwitcher>` + `<MobileNav>` (logo serif Axion**IA** italique, nav active italique terracotta, locale pill)
- `<Footer>` (bg-mocha-rich, tagline serif géant, columns sobres)
- `<Button>` + `<Cta>` (7 variants + terracotta, shape pill par défaut sur Cta marketing, cta-lift)
- `<Card>` (radius-xl 20, padding 28, border sand, hover terracotta)
- `<Section>` (6 tones + titleEm italic-editorial)
- `<Hero>` (bg-halo-warm + indicator dot + titleEm)
- `<ProductHero>` (21 pages produits — bg-halo-warm + halo accent latéral + h1 Fraunces)
- `<MetricsRow>` + `<Stat>` (numbers Fraunces 96-112px + suffix terracotta, auto-adapt mocha)
- `<ProcessSteps>` (numéros serif terracotta + top border, auto-adapt mocha)
- `<CtaBlock>` (tones mocha/paper/sand + alias dark/light rétrocompat)
- `<FaqBlock>` (tones canvas/paper/sand)
- `<FeatureGrid>` (icônes terracotta-soft circulaires)
- `<TimelineBlock>` (dates serif terracotta + ring-bg connector)
- `<TeamGrid>` (sand avatar fallback, names serif, role italic terracotta)
- `<LegalPageTemplate>` (hero halo-warm + body paper)
- `<TestimonialCard>` (pull-quote pur figure + blockquote serif italic)
- `<TestimonialsCarousel>` (boutons rounded-full, bordures sable)
- `<ArticleCard>` + `<CaseStudyCard>` (titles serif Fraunces, badges sand + terracotta-soft)
- `<ProductPageTemplate>` (alternance auto paper → sand → mocha → canvas → mocha)

**i18n** : 64 nouvelles clés home FR+EN en parité (102 keys total).
**Tests** : `Hero.test.tsx` réécrit pour assertion `text-display-editorial` + indicator dot accent. `Button.test.tsx` assertion `cta-lift`. **71/71 verts**.
**Gates** : verify:all GREEN (typecheck · lint · i18n · anti-formation/siren/hex · use-client · contrast 10 paires AA · radius · 71 tests).

### À faire ensuite

- **Audit contraste étendu** : ajouter au `scripts/check-contrast.ts` les paires v3 (text-fg-muted sur bg-sand, text-mocha-fg/70 sur mocha-rich, etc.).
- **Renforcer la modernité** (animations subtiles scroll-triggered, visuels SVG abstraits).
- **Renforcer le message client** : intervention/audit/implémentation + bénéfice chiffré ultra-clair dès le hero.
- **Reprendre la séquence d'audits** : 1/4 SPRINT-AUDIT, 2/4 Checkpoint, 4/4 VERIFICATION-FINALE Pass A.

---

## 2026-05-06 — Sprint 0 (M1) · Setup repo & toolchain

**Auteur** : Will + Claude Opus 4.7
**Référence** : `_AUDIT/02-PLAN.md` jalon M1 · ADR `docs/adr/0001-stack-initial.md`

### Décisions structurantes

- **Passe v10.2 close** sans patch des .docx (cf. `_AUDIT/CHANGELOG-v10.2.md`). CLAUDE.md v6 + skills `axionia-*` + 22 LOCKs + wireframes propres résolvent les 16 contradictions à la source. .docx = archives.
- **Aucun skill archivé** (Q2=c) — les 9 skills hors-scope restent actifs.
- **Sous-repo Git axionia/** — repo parent `Axion-IA/` est l'umbrella docs/audits, `axionia/` est l'app Next.js avec son propre `.git`.
- **Next.js 16.2.4** au lieu de 15 — scaffold latest stable. ADR 0001 documente l'écart.
- **Auth.js v5 beta** (`5.0.0-beta.31`) — la v5 stable n'est pas encore sortie.
- **Pas de Stripe** confirmé.

### Livré ce Sprint

- Repo Next.js 16 + TS strict (noUncheckedIndexedAccess, exactOptionalPropertyTypes, noImplicitOverride).
- 30+ deps prod, 32 deps dev, versions épinglées.
- ESLint flat + jsx-a11y + @typescript-eslint strict + Prettier + tailwind plugin.
- Husky 9 + lint-staged + commitlint Conventional Commits.
- 7 scripts custom : `check-i18n`, `check-anti-formation`, `check-anti-siren`, `check-anti-hex`, `check-use-client`, `check-zod`, `check-schema`, `seo-audit`, `vitals-report`, `adr-new`.
- Sentry server + edge + client + `instrumentation.ts` + `instrumentation-client.ts`.
- Endpoint `src/app/api/vitals/route.ts` (Edge runtime) pour beacon web-vitals.
- `src/env.ts` via `@t3-oss/env-nextjs` couvrant DB / Redis / Auth / SMTP / Hetzner Storage / Telegram / Turnstile / Sentry / Plausible / IndexNow / Company.
- 4 GitHub Actions workflows (Gates A/B/C/D/E) + Dependabot.
- `next.config.ts` avec headers de sécurité de base + `reactCompiler` activé + bundle analyzer.
- ADR 0001-stack-initial.md.
- `.gitleaks.toml` config.
- `lighthouserc.json` Lighthouse CI desktop assertions.
- `vitest.config.ts` + `vitest.integration.config.ts` + `playwright.config.ts` (5 projects : chromium/webkit/firefox + 2 mobile).

### À faire au prochain Sprint (Sprint 1 — tokens Webflow)

- Lire `node_modules/next/dist/docs/` pour valider les options expérimentales Next 16 avant Sprint 2.
- Implémenter `Design.md` Webflow-inspired dans `src/app/globals.css` (palette + typo Manrope/Inconsolata + radius + shadows + animation `translate-x-[6px]`).
- Page `/_design` (dev-only).
- Linter contrast + radius custom.
