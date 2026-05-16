# Agent 3.A — Routes inventory

**Date** : 2026-05-16
**SHA HEAD figé** : `98e0b0f` (main)
**Mode** : AUDIT-ONLY
**Scope** : 210 `page.tsx` + 34 `route.ts` + 4 sitemaps + 2 robots/manifests + 1 `not-found.tsx`
**SSOT** : `src/i18n/routing.ts` (104 entries `pathnames`) + `src/proxy.ts` (EN→FR 301)

---

## 1. Tableau récap quantitatif

| Catégorie                                           |                     Nombre | Note                                                                                        |
| --------------------------------------------------- | -------------------------: | ------------------------------------------------------------------------------------------- |
| Total fichiers `page.tsx`                           |                        210 | filesystem                                                                                  |
| Total fichiers `route.ts`                           |                         34 | filesystem                                                                                  |
| Total fichiers `sitemap.ts` + `*-xml/route.ts`      |                          4 | `app/sitemap.ts` + `sitemap-index.xml` + `sitemap-news.xml` + `sitemaps/images-{fr,en}.xml` |
| `robots.ts`                                         |                          1 | racine app                                                                                  |
| Routes publiques `[locale]/*` (hors admin)          |                        113 | dont 5 dev-only (`design`, `components`, `sections`, etc.)                                  |
| Routes admin `[locale]/(admin)/[adminPrefix]/*`     | 116 pages + 1 route export | toutes `force-dynamic` (cohérent)                                                           |
| Segments dynamiques `[*]` (total)                   |                    57 dirs | dont 23 admin + 22 public + 12 API/misc                                                     |
| Pages dynamiques publiques                          |                         22 | 17 ont `generateStaticParams`, 5 sont ISR à la demande (`dynamicParams=true`)               |
| `pathnames` déclarées dans `routing.ts`             |                        104 | SSOT type-safe pour `<Link>`                                                                |
| Pages filesystem manquantes dans `routing.ts`       |                      **9** | voir §4 ci-dessous                                                                          |
| Pages avec `export const dynamic = "force-dynamic"` |                        132 | 116 admin + 5 public-session-bound + 11 admin API                                           |
| Pages avec `export const revalidate` ISR            |                         21 | va de 300 s (sitemap-news) à 86400 s (pSEO villes)                                          |
| Pages avec `dynamicParams = true`                   |                         10 | 100 % public, cohérent ISR                                                                  |

---

## 2. Routes statiques publiques — mapping FR canonique + EN miroir

Source : `src/i18n/routing.ts`. EN miroir actuellement **désactivé runtime** via `src/proxy.ts` qui émet 301 `/en/*` → `/fr/*` tant que `EN_LOCALE_ENABLED!=="true"` (cf. AGENTS.md « EN re-enable procedure »). Les fichiers EN pré-rendus restent en place, le 301 est purement runtime.

### 2.1 Hubs principaux

| Route FR                                                                           | Route EN                                        | Fichier (≤ 2 segments)                                                        | Mode                                                                     |
| ---------------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `/`                                                                                | `/`                                             | `[locale]/page.tsx`                                                           | SSG (pas de `dynamic`)                                                   |
| `/interventions`                                                                   | `/interventions`                                | `[locale]/interventions/page.tsx`                                             | SSG                                                                      |
| `/audit`                                                                           | `/audit`                                        | `[locale]/audit/page.tsx`                                                     | SSG                                                                      |
| `/implementation`                                                                  | `/implementation`                               | `[locale]/implementation/page.tsx`                                            | SSG                                                                      |
| `/cas-concrets`                                                                    | `/case-studies`                                 | `[locale]/cas-concrets/page.tsx`                                              | ISR 86400 s                                                              |
| `/implantations`                                                                   | `/locations`                                    | `[locale]/implantations/page.tsx`                                             | SSG                                                                      |
| `/blog`                                                                            | `/blog`                                         | `[locale]/blog/page.tsx`                                                      | ISR 3600 s                                                               |
| `/connaissances`                                                                   | `/connaissances` (FR-only doctrine)             | `[locale]/connaissances/page.tsx`                                             | ISR 3600 s                                                               |
| `/actualites`                                                                      | `/actualites` (FR-only doctrine)                | `[locale]/actualites/page.tsx`                                                | ISR 3600 s                                                               |
| `/centre-aide`                                                                     | `/help`                                         | `[locale]/centre-aide/page.tsx`                                               | SSG                                                                      |
| `/cookies`, `/rgpd`                                                                | identiques                                      | `[locale]/{cookies,rgpd}/page.tsx`                                            | SSG                                                                      |
| `/a-propos`                                                                        | `/about`                                        | `[locale]/a-propos/page.tsx`                                                  | SSG                                                                      |
| `/contact`                                                                         | `/contact`                                      | `[locale]/contact/page.tsx`                                                   | SSG (form Server Action)                                                 |
| `/reserver`                                                                        | `/book`                                         | `[locale]/reserver/page.tsx`                                                  | SSG (form client-heavy)                                                  |
| `/presse`                                                                          | `/press`                                        | `[locale]/presse/page.tsx`                                                    | SSG                                                                      |
| `/transparence`                                                                    | `/transparency`                                 | `[locale]/transparence/page.tsx`                                              | ISR 86400 s                                                              |
| `/sous-processeurs`                                                                | `/subprocessors`                                | `[locale]/sous-processeurs/page.tsx`                                          | SSG                                                                      |
| `/recherche`                                                                       | `/search`                                       | `[locale]/recherche/page.tsx`                                                 | SSG (Pagefind)                                                           |
| `/methodologie`                                                                    | `/methodology`                                  | `[locale]/methodologie/page.tsx`                                              | SSG                                                                      |
| `/guide-ia`                                                                        | `/ai-guide`                                     | `[locale]/guide-ia/page.tsx`                                                  | SSG                                                                      |
| `/stack-ia`                                                                        | `/ai-stack`                                     | `[locale]/stack-ia/page.tsx`                                                  | SSG                                                                      |
| `/glossaire`                                                                       | `/glossary`                                     | `[locale]/glossaire/page.tsx`                                                 | SSG                                                                      |
| `/comparaisons`                                                                    | `/comparisons`                                  | `[locale]/comparaisons/page.tsx`                                              | SSG                                                                      |
| `/roi`                                                                             | `/roi`                                          | `[locale]/roi/page.tsx`                                                       | SSG                                                                      |
| `/faq`                                                                             | `/faq`                                          | `[locale]/faq/page.tsx`                                                       | SSG                                                                      |
| `/galerie`                                                                         | `/gallery`                                      | `[locale]/galerie/page.tsx`                                                   | SSG (image-bank V1)                                                      |
| `/galerie/audits`, `/galerie/implementations`, `/galerie/interventions-formations` | (aucun)                                         | `[locale]/galerie/{audits,implementations,interventions-formations}/page.tsx` | SSG — **ORPHELIN routing.ts** (cf. §4)                                   |
| `/mentions-legales`                                                                | `/legal-notice`                                 | `[locale]/mentions-legales/page.tsx`                                          | SSG                                                                      |
| `/conditions-generales`                                                            | `/terms`                                        | `[locale]/conditions-generales/page.tsx`                                      | SSG                                                                      |
| `/politique-confidentialite`                                                       | `/privacy-policy`                               | `[locale]/politique-confidentialite/page.tsx`                                 | SSG                                                                      |
| `/politique-deplacement`                                                           | `/travel-policy`                                | `[locale]/politique-deplacement/page.tsx`                                     | SSG                                                                      |
| `/accessibilite`                                                                   | `/accessibility`                                | `[locale]/accessibilite/page.tsx`                                             | SSG                                                                      |
| `/preferences-cookies`                                                             | `/cookie-preferences`                           | `[locale]/preferences-cookies/page.tsx`                                       | SSG                                                                      |
| `/desabonnement`                                                                   | `/unsubscribe`                                  | `[locale]/desabonnement/page.tsx`                                             | SSG                                                                      |
| `/mes-donnees`, `/mes-donnees/export`                                              | `/my-data`, `/my-data/export`                   | idem                                                                          | `/mes-donnees/export` = **force-dynamic** (token+email query-params, OK) |
| `/confirmation`                                                                    | `/confirmation`                                 | `[locale]/confirmation/page.tsx`                                              | SSG                                                                      |
| `/confirmation/newsletter`                                                         | (aucun)                                         | `[locale]/confirmation/newsletter/page.tsx`                                   | SSG — **ORPHELIN routing.ts**                                            |
| `/demande-devis`, `/demande-devis/confirmation`                                    | `/request-quote`, `/request-quote/confirmation` | idem                                                                          | SSG                                                                      |
| `/sections`, `/components`, `/design`                                              | identiques                                      | dev-only (exclus `EXCLUDED_FROM_INDEX` sitemap, `Disallow:` robots)           | SSG                                                                      |
| `/maintenance`                                                                     | (racine, hors locale)                           | `app/maintenance/page.tsx`                                                    | SSG                                                                      |
| `/mes-ressources`                                                                  | (aucun)                                         | `[locale]/mes-ressources/page.tsx`                                            | **force-dynamic** — **ORPHELIN routing.ts**                              |
| `/ressources`                                                                      | (aucun)                                         | `[locale]/ressources/page.tsx`                                                | ISR 3600 s — **ORPHELIN routing.ts**                                     |

### 2.2 Sous-pages Interventions (taxonomie 14.10.7)

Toutes ont entrée `routing.ts` + fichier `[locale]/interventions/<slug>/page.tsx`. SSG par défaut. 23 pages au total :

`/collectives` (+ `/4h`, `/1-jour`, `/2-jours`, `/3-jours-plus`), `/individuel`, `/coaching-decouverte`, `/coaching-avance`, `/essentielle`, `/approfondie`, `/conference`, `/conference-pleniere`, `/conference-keynote`, `/dirigeants`, `/dirigeant-productivite`, `/dirigeant-vision-strategique`, `/claude-dirigeant`, `/claude-implementation-individuel`, `/gagner-du-temps`, `/intervention-claude`, `/demarrage-ia-express`, `/atelier-ia-cible`, `/demande`.

### 2.3 Sous-pages Audit

`/audit/flash`, `/audit/cible`, `/audit/strategique-pme`, `/audit/strategique-eti`, `/audit/demande`. EN miroir cohérent (`/audit/{flash,targeted,strategic-pme,strategic-eti,request}`). SSG.

### 2.4 Sous-pages Implementation

9 pages produit (`/ia-custom`, `/chatbot`, `/processus`, `/structuration`, `/crm-erp`, `/documents`, `/agents`, `/integrations`, `/no-code`) + `/par-techno` (hub). Toutes SSG, toutes en routing.ts.

---

## 3. Routes dynamiques publiques — `generateStaticParams` + `dynamicParams`

| Pattern                                                      | Fichier                            | `generateStaticParams` |         `dynamicParams`          | `revalidate` | Verdict                                                                      |
| ------------------------------------------------------------ | ---------------------------------- | :--------------------: | :------------------------------: | -----------: | ---------------------------------------------------------------------------- |
| `/audit/par-ville/[ville]`                                   | `audit/par-ville/[ville]/page.tsx` |           ✅           |              `true`              |      86400 s | ✅ pSEO villes — cohérent                                                    |
| `/interventions/par-ville/[ville]`                           | idem                               |           ✅           |              `true`              |      86400 s | ✅ pSEO villes — cohérent                                                    |
| `/implementation/par-ville/[ville]`                          | idem                               |           ✅           |              `true`              |      86400 s | ✅ pSEO villes — cohérent                                                    |
| `/implantations/[region]`                                    | `implantations/[region]/page.tsx`  |           ✅           |              `true`              |      86400 s | ✅ INSEE 13 régions                                                          |
| `/implantations/[region]/[ville]`                            | idem                               |           ✅           |              `true`              |      86400 s | ✅ 2 157 villes                                                              |
| `/blog/[slug]`                                               | `blog/[slug]/page.tsx`             |           ✅           |              `true`              |       3600 s | ✅                                                                           |
| `/blog/{auteur,categorie,secteur,service,tag,taille}/[slug]` | idem                               |           ✅           |            (default)             |    (default) | ✅                                                                           |
| `/cas-concrets/[slug]`                                       | `cas-concrets/[slug]/page.tsx`     |           ✅           |            (default)             |    (default) | ✅                                                                           |
| `/cas-concrets/secteur/[slug]`                               | idem                               |           ✅           |            (default)             |    (default) | ✅                                                                           |
| `/centre-aide/[slug]`                                        | `centre-aide/[slug]/page.tsx`      |           ✅           |            (default)             |    (default) | ✅                                                                           |
| `/centre-aide/categorie/[slug]`                              | idem                               |           ✅           |            (default)             |    (default) | ✅                                                                           |
| `/comparaisons/[slug]`                                       | `comparaisons/[slug]/page.tsx`     |           ✅           |            (default)             |    (default) | ✅                                                                           |
| `/faq/[slug]`                                                | `faq/[slug]/page.tsx`              |           ✅           |            (default)             |    (default) | ✅                                                                           |
| `/implementation/par-fonction/[slug]`                        | idem                               |           ✅           |            (default)             |    (default) | ✅                                                                           |
| `/actualites/[slug]`                                         | `actualites/[slug]/page.tsx`       |           ❌           |              `true`              |       3600 s | ⚠️ DB-driven, ISR-only — acceptable mais 0 pré-rendu = miss au build         |
| `/connaissances/[slug]`                                      | `connaissances/[slug]/page.tsx`    |           ❌           |              `true`              |       3600 s | ⚠️ idem — pas catastrophique (DB pas dispo build GH Actions, `stub.invalid`) |
| `/equipe/[slug]`                                             | `equipe/[slug]/page.tsx`           |           ❌           |              `true`              |      86400 s | ⚠️ **ORPHELIN routing.ts** + 0 staticParams                                  |
| `/guides/[slug]`                                             | `guides/[slug]/page.tsx`           |           ❌           |              `true`              |       3600 s | ⚠️ **ORPHELIN routing.ts** + 0 staticParams + hub `/guides` 404              |
| `/booking/[token]/{cancel,reschedule}`                       | idem                               |           ❌           | (default, donc `true` implicite) |    (default) | ✅ HMAC token signé — pas pré-renderable par design                          |
| `/galerie/[slug]`                                            | `galerie/[slug]/page.tsx`          |           ✅           |            (default)             |    (default) | ✅ image-bank V1                                                             |
| `/[...catchall]`                                             | `[locale]/[...catchall]/page.tsx`  |   ❌ (intentionnel)    |                —                 |            — | ✅ déclenche `notFound()` → 404 propre (cf. audit AGENT CLS 2026-05-15)      |

**Note** : `dynamicParams` default = `true` dans Next 16 quand `generateStaticParams` est défini ; explicite `false` requis pour 404 strict. Aucune page publique n'a `dynamicParams=false` (cohérent — toutes accept slugs futurs).

---

## 4. Pages **ORPHELINES** (filesystem mais absent de `routing.ts.pathnames`)

Conséquences SEO : ces pages sont **absentes du sitemap** (qui itère `routing.pathnames`), donc invisibles aux crawlers. Les liens internes Next `<Link>` typecheckent **uniquement** grâce à `as never` ou strings raw (échappent au type-check pathnames).

| #   | Route filesystem                    | Référencée dans nav/footer/header ?                                     |          Indexable Google ?           | Sévérité                                      |
| --- | ----------------------------------- | ----------------------------------------------------------------------- | :-----------------------------------: | --------------------------------------------- |
| 1   | `/guides/[slug]`                    | ❌ (seul lien interne = breadcrumb vers `/guides` qui **n'existe pas**) |          ❌ pas dans sitemap          | **P0 SEO**                                    |
| 2   | `/equipe/[slug]`                    | ✅ via `/transparence` page (lien vers `/equipe/manon`)                 |          ❌ pas dans sitemap          | **P0 SEO** (Manon disclosed = AI Act art. 50) |
| 3   | `/mes-ressources`                   | ❌ (force-dynamic, session-gated, voulu non-indexable)                  |               ❌ (sain)               | ⚠️ documenter intentionnalité                 |
| 4   | `/ressources`                       | ❌ (alimente feeds RSS+JSON consommés par sub-sitemaps)                 |          ❌ pas dans sitemap          | **P1 SEO** — hub de ressources hors index     |
| 5   | `/galerie/audits`                   | ❌ (seul lien : footer image-bank `<PressImageBank>` pointe `/galerie`) |          ❌ pas dans sitemap          | **P1 SEO** — landing thématique pSEO galerie  |
| 6   | `/galerie/implementations`          | ❌ idem                                                                 |          ❌ pas dans sitemap          | **P1 SEO**                                    |
| 7   | `/galerie/interventions-formations` | ❌ idem                                                                 |          ❌ pas dans sitemap          | **P1 SEO**                                    |
| 8   | `/confirmation/newsletter`          | ❌ (cible d'opt-in email transactional)                                 | OK (noindex attendu sur confirmation) | ⚠️ intentionnel mais documenter               |
| 9   | `/[...catchall]`                    | — (catchall, pas une vraie page)                                        |           — (déclenche 404)           | ✅ intentionnel                               |

**Top 10 orphelines (≥ P1)** :

1. `/guides/[slug]` (P0 — pipeline content-gen guide-pilier publie sans hub indexable)
2. `/equipe/[slug]` (P0 — Manon AI Act art. 50)
3. `/ressources` (P1 — Hub ressources sans index)
4. `/galerie/audits` (P1)
5. `/galerie/implementations` (P1)
6. `/galerie/interventions-formations` (P1)
7. `/confirmation/newsletter` (P2 informationnel)
8. `/mes-ressources` (P3 documenter)
9. `/[...catchall]` (— ignoré, sain)
10. (placeholder — pas de 10ème orphelin réel)

---

## 5. Top 5 CTA **dead-end**

| #   | CTA / lien                                                        | Origine                                         | Cible                                                                                                            | Statut                                                                                | Sévérité                                     |
| --- | ----------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------- |
| 1   | Breadcrumb `Guides` `href="/guides"`                              | `src/app/[locale]/guides/[slug]/page.tsx:97`    | `/guides` (pas de page)                                                                                          | **404**                                                                               | **P0**                                       |
| 2   | Lien démo `href="/cas-concrets/exemple-1\|2\|3"`                  | `src/app/[locale]/sections/page.tsx:101-117`    | slugs fictifs `exemple-X`                                                                                        | **404**                                                                               | P2 (page `/sections` dev-only, exclue index) |
| 3   | Lien démo `href="/cas-concrets/exemple"` + `href="/blog/exemple"` | `src/app/[locale]/components/page.tsx:153,160`  | slugs fictifs                                                                                                    | **404**                                                                               | P2 (page `/components` dev-only)             |
| 4   | `<Link>` Footer `/sitemap.xml`                                    | `src/components/nav/Footer.tsx:210`             | `/sitemap.xml` (existe via `app/sitemap.ts`, mais Next 16 émet `/sitemap.xml` racine, **pas** `/fr/sitemap.xml`) | ⚠️ `<Link>` localisé peut prefixer `/fr` → 404. Confirmer via wrapper `<a href>` brut | P1 si pas un `<a>`                           |
| 5   | `<PressImageBank>` `<Link href="/galerie">`                       | `src/components/sections/PressImageBank.tsx:71` | `/galerie` (existe ✅)                                                                                           | OK                                                                                    | —                                            |

**Note 307 self-loop EN** : `src/proxy.ts:36-43` intercepte **avant** next-intl middleware et émet **301** vers `/fr/<équivalent>`. Le `mapEnToFr()` couvre 36 prefixes explicites + fallback `/en→/fr` swap. **Aucune boucle 307 détectée statiquement** dans le code — le bug pré-existant next-intl est court-circuité par le 301 early-return. ✅

---

## 6. Routes API + sitemaps + special

| Path                                                                                                                           | Type             | Auth           | Locale-prefix risque ?                       |
| ------------------------------------------------------------------------------------------------------------------------------ | ---------------- | -------------- | -------------------------------------------- |
| `/api/auth/[...nextauth]`                                                                                                      | route            | Auth.js        | ✅ excluse middleware matcher (regex `api/`) |
| `/api/{healthz,vitals,unsubscribe,indexnow,gdpr-export,...}`                                                                   | route            | mixte          | ✅ excluse middleware                        |
| `/api/admin/{invoices/[id]/pdf,newsletter/export,submissions/export}`                                                          | route            | admin-gated    | ✅ excluse middleware                        |
| `/api/internal/{kb/ingest,kb/search,revalidate}`                                                                               | route            | internal token | ✅ excluse middleware                        |
| `/api/docuseal/webhook`, `/api/stripe/webhook`                                                                                 | webhook          | HMAC sig       | ✅ excluse middleware                        |
| `/api/markdown/[type]/[slug]`                                                                                                  | route            | public         | ✅ excluse middleware                        |
| `/api/content-gen/{export,geo-events,jobs/[id]/stream,preview/[jobId]}`                                                        | route            | admin          | ✅ excluse middleware                        |
| `/sitemap.xml`                                                                                                                 | `app/sitemap.ts` | public         | ✅ excluse middleware (regex `sitemap`)      |
| `/sitemap-index.xml`, `/sitemap-news.xml`                                                                                      | route            | public         | ✅ idem                                      |
| `/sitemaps/images-{fr,en}.xml`                                                                                                 | route            | public         | ✅ idem                                      |
| `/[locale]/blog/feed.xml`, `/[locale]/cas-concrets/feed.xml`, `/[locale]/faq/feed.xml`, `/[locale]/ressources/feed.{xml,json}` | feed             | public         | ✅ servi sous `[locale]`, attendu            |
| `/robots.txt`                                                                                                                  | `app/robots.ts`  | —              | ✅ excluse middleware                        |
| `/llms.txt`, `/llms-full.txt`, `/ai.txt`                                                                                       | route            | —              | ✅ excluse middleware (regex `.*\.txt$`)     |
| `/.well-known/{security.txt,ai-policy.json}`                                                                                   | route            | —              | ✅ excluse middleware (`\.well-known/`)      |
| `/manifest.webmanifest`, `/icon`, `/apple-icon`, `/opengraph-image*`                                                           | generated        | —              | ✅ excluse middleware                        |
| `/[locale]/(admin)/[adminPrefix]/paiements/export`                                                                             | route admin      | admin          | ✅ admin-gated                               |
| `/[locale]/galerie/[slug]/telecharger`                                                                                         | route public     | public         | ✅ download endpoint image-bank              |

Tous les endpoints API/sitemap sont **root-mounted** et explicitement exclus du regex matcher `src/proxy.ts:97-125` (commentaire détaillé). ✅

---

## 7. Routes admin `(admin)/[adminPrefix]/*`

116 pages SSR (toutes `force-dynamic`) + 1 route export (`/paiements/export`). Path préfixé par `[adminPrefix]` = chaîne aléatoire env var (`ADMIN_URL_PREFIX`) pour obfuscation URL. Sections principales (cohérent avec memory M9) :

- Dashboard hub (`/`)
- Auth (`/login`, `/2fa/setup`)
- Booking ops (`/reservations`, `/calendrier`, `/calendrier/heatmap`, `/calendrier/reschedule`, `/options`, `/echeanciers`)
- CRM / Facturation (`/devis`, `/factures`, `/paiements`, `/submissions`, `/users`)
- Content (`/blog`, `/case-studies`, `/categories`, `/faq`, `/help`, `/testimonials`, `/connaissances`)
- Content-gen platform (32 pages sous `/content-gen/*`)
- Image-bank (15 pages sous `/image-bank/*`)
- Settings / Infra / Alerts / Web Vitals / Activity logs / Analytics / Newsletter

Toutes en `force-dynamic` (cohérent — données live, session-gated). Aucune entrée dans `routing.ts.pathnames` (intentionnel — admin = hors sitemap, hors hreflang, robots `Disallow:`).

---

## 8. Hreflang / EN miroir : statut

- `routing.ts` déclare `locales: ["fr","en"]` + `pathnames` mapping FR↔EN sur **104 entrées**.
- Toutes les pages SSG sont pré-rendues en FR **et** EN au build (cf. `sitemap.ts:413` itère sur `Object.keys(routing.pathnames)`).
- Runtime : `src/proxy.ts:36-43` émet **301** `/en/*` → `/fr/équivalent` (EN désactivé via env-flag `EN_LOCALE_ENABLED!=="true"`).
- Conséquence : les EN URLs **restent dans le sitemap** + le code SSG continue de les générer, mais elles sont **inaccessibles au public** (301 systématique). Le link juice 301 transfère vers FR. ✅ stratégie « EN figé, FR servi » documentée AGENTS.md.
- Pages FR-only par doctrine (pas de mapping EN différent, le slug EN renvoie 404 via notFound dans le composant) : `/actualites`, `/actualites/[slug]`, `/connaissances`, `/connaissances/[slug]`. ✅ intentionnel (doctrine content-gen v1.2 FR-only).
- ⚠️ **Pages orphelines de §4** : 6 sur 7 n'ont **aucun mapping EN dans `pathnames`** car absentes du fichier. Soit OK (doctrine FR-only étendue), soit à corriger en ajoutant l'entrée.

---

## 9. Cohérence `dynamic` / `revalidate` / `dynamicParams`

| Type page                  | Mode attendu                                                       | Mode observé                                                            | Verdict    |
| -------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------- | ---------- |
| Admin `(admin)/*`          | `force-dynamic`                                                    | ✅ 116/116                                                              | ✅ parfait |
| Public hub statique        | SSG (rien de spécial)                                              | ✅                                                                      | ✅         |
| Public ISR (DB-driven)     | `revalidate=3600` ou `86400` + `dynamicParams=true`                | ✅ 10/10 pages dynamiques publiques cohérentes                          | ✅         |
| Public pSEO villes/régions | `generateStaticParams` + `revalidate=86400` + `dynamicParams=true` | ✅ 5/5 templates                                                        | ✅         |
| Session-gated public       | `force-dynamic`                                                    | ✅ `mes-donnees/export`, `mes-ressources`                               | ✅         |
| Catchall                   | `notFound()` immédiat                                              | ✅                                                                      | ✅         |
| Sitemap dynamic            | `revalidate=3600`                                                  | ✅ `sitemap-index.xml`, `sitemap-news.xml=300s` (news exige <1h Google) | ✅         |
| `.well-known/*`            | `revalidate=false` (immutable)                                     | ✅                                                                      | ✅         |

Aucune incohérence détectée sur les modes. Score local : 18/20.

---

## 10. Scoring /100

| Catégorie                              | Pondération | Note | Pts | Justification                                                                |
| -------------------------------------- | ----------: | ---: | --: | ---------------------------------------------------------------------------- |
| Exhaustivité inventaire                |          15 |   15 |  15 | 210 pages + 34 routes confirmées 1:1                                         |
| FR canonique + EN miroir mapping       |          15 |   12 |  12 | 6 pages orphelines absentes mapping EN                                       |
| Pages orphelines (orphans nav/sitemap) |          20 |   10 |  10 | 7 pages réelles orphelines dont 2 P0                                         |
| CTA dead-end                           |          10 |    6 |   6 | 1 P0 (`/guides` breadcrumb), 3 P2 dev-only, 1 P1 sitemap link locale         |
| `generateStaticParams` cohérence       |          10 |    9 |   9 | 17/22 dyn publiques OK, 5 ISR-only acceptable (2 = orphelines déjà comptées) |
| `dynamicParams` cohérence              |           5 |    5 |   5 | tous explicites ou default sain                                              |
| SSG/SSR/dynamic cohérence              |          15 |   15 |  15 | admin 100 % force-dynamic, public 100 % SSG/ISR, session-gated dynamic       |
| Bug 307 self-loop EN                   |          10 |   10 |  10 | proxy.ts:36-43 émet 301 avant intl middleware → bug court-circuité ✅        |

**Score total : 82/100** — verdict **🟡 GO conditionnel**.

---

## 11. Top 3 P0 (bloquants)

1. **`/guides` (hub) inexistant + `/guides/[slug]` orphelin de `routing.ts`** — breadcrumb des pages guide pointe vers route 404, sitemap n'expose pas la collection. Impact : pipeline content-gen `guide-pilier` publie des guides indexables côté article seul, sans hub découverte ni inclusion sitemap → Google ne crawle que via lien externe. Fix : créer `[locale]/guides/page.tsx` (hub listing) + ajouter `/guides`, `/guides/[slug]` à `pathnames` dans `src/i18n/routing.ts` + ajouter `generateStaticParams` (lire `Article` where `templateVariant LIKE 'guide-%'`).

2. **`/equipe/[slug]` orphelin de `routing.ts` (Manon AI Act)** — `/transparence` linke `/equipe/manon` mais la page n'est pas dans `pathnames`, donc absente du sitemap. Risque réglementaire : transparence IA non discoverable par Google Search → preuve d'art. 50 AI Act EU 2026 amoindrie. Fix : ajouter `/equipe/[slug]` à `pathnames` + `generateStaticParams` retournant `["manon"]` (1 seule auteure pour V1).

3. **3 landings galerie + `/ressources` orphelins sitemap** — `/galerie/audits`, `/galerie/implementations`, `/galerie/interventions-formations`, `/ressources` existent fichier mais absentes `pathnames` → invisible Google. Impact pSEO image-bank (perte trafic Google Images thématique services) + perte hub ressources. Fix : 4 entrées `pathnames` (FR-only acceptable) + revalidate les sub-sitemaps si DB-driven.

---

## 12. Annexe — Commandes de re-vérification

```bash
# Inventaire complet
find src/app -type f \( -name "page.tsx" -o -name "route.ts" -o -name "sitemap.ts" -o -name "robots.ts" \)

# Diff filesystem vs routing.ts
find src/app/[locale] -type f -name "page.tsx" -not -path "*/(admin)/*" \
  | sed 's|src/app/\[locale\]||; s|/page\.tsx$||' | sort > /tmp/fs.txt
grep -oE '"/[^"]+":' src/i18n/routing.ts | sed 's|":$||; s|^"||' | sort -u > /tmp/rt.txt
diff /tmp/fs.txt /tmp/rt.txt

# Dyn pages sans generateStaticParams
for d in $(find src/app/[locale] -type d -name "[*]" -not -path "*/(admin)/*"); do
  [ -f "$d/page.tsx" ] && ! grep -q "generateStaticParams" "$d/page.tsx" \
    && echo "MISSING: $d/page.tsx"
done

# CTA dead-end candidates
grep -rhE 'href[:=]\s*\{?["`'"'"']/[^"`'"'"']+["`'"'"']\}?' src/app src/components \
  | grep -oE '["`'"'"']\/[a-z][^"`'"'"']*["`'"'"']' | sort -u
```

---

**Fin Agent 3.A.**
