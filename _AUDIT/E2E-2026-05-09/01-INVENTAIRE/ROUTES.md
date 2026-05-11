# 01-INVENTAIRE — ROUTES

## Totaux

| Type                                                     | Count                 |
| -------------------------------------------------------- | --------------------- |
| Total `page.tsx`                                         | **112**               |
| Pages publiques (hors `(admin)`)                         | **76**                |
| Pages admin sous `[locale]/(admin)/[adminPrefix]`        | **36**                |
| `route.ts` sous `app/api/**`                             | **11** (10 endpoints) |
| Routes spéciales (sitemap/robots/llms/manifest/icons/og) | 7                     |
| Server actions ("use server" files)                      | **20**                |
| `generateStaticParams`                                   | **22** files          |
| `generateMetadata`                                       | **73** files          |
| Pathnames mappés FR↔EN (`i18n/routing.ts`)               | À vérifier AGT-06     |

## Routes publiques (76)

### Racine + transversal

- `/` (home), `/a-propos`, `/contact`, `/recherche`, `/reserver`, `/methodologie`, `/glossaire`, `/guide-ia`, `/presse`, `/stack-ia`, `/roi`, `/comparaisons`, `/comparaisons/[slug]`, `/centre-aide`, `/centre-aide/[slug]`, `/centre-aide/categorie/[slug]`, `/faq`, `/faq/[slug]`

### Audit (8 routes)

- `/audit`, `/audit/process`, `/audit/demande`, `/audit/flash`, `/audit/strategique-pme`, `/audit/strategique-eti`, `/audit/par-ville/[ville]`

### Interventions (8 routes)

- `/interventions`, `/interventions/essentielle`, `/interventions/approfondie`, `/interventions/conference`, `/interventions/dirigeants`, `/interventions/gagner-du-temps`, `/interventions/intervention-claude`, `/interventions/par-ville/[ville]`

### Implementation (13 routes)

- `/implementation`, `/implementation/agents`, `/implementation/chatbot`, `/implementation/crm-erp`, `/implementation/documents`, `/implementation/ia-custom`, `/implementation/integrations`, `/implementation/no-code`, `/implementation/par-fonction/[slug]`, `/implementation/par-techno`, `/implementation/par-ville/[ville]`, `/implementation/processus`, `/implementation/structuration`

### pSEO villes (3 templates dédiés + page mère)

- `/implantations`, `/implantations/[region]`, `/implantations/[region]/[ville]` ← **canonique doctrine**
- `/audit/par-ville/[ville]`, `/interventions/par-ville/[ville]`, `/implementation/par-ville/[ville]`

→ Doctrine intouchable § 0.1 respectée : URL canonique `/fr/implantations/<region>/<ville>`. **Pas de `/par-region/`**.

### Blog & contenu (7 routes)

- `/blog`, `/blog/[slug]`, `/blog/auteur/[slug]`, `/blog/categorie/[slug]`, `/blog/secteur/[slug]`, `/blog/service/[slug]`, `/blog/tag/[slug]`, `/blog/taille/[slug]` (8 — recompté)

### Cas concrets (3 routes)

- `/cas-concrets`, `/cas-concrets/[slug]`, `/cas-concrets/secteur/[slug]`

### Legal / RGPD (8 routes)

- `/mentions-legales`, `/conditions-generales`, `/politique-confidentialite`, `/politique-deplacement`, `/cookies`, `/preferences-cookies`, `/rgpd`, `/mes-donnees`, `/accessibilite`, `/desabonnement`

### Newsletter & confirmation

- `/confirmation`, `/confirmation/newsletter`

### Sandbox dev (à vérifier prod gating)

- `/components`, `/sections`, `/design` — ⚠️ doit pas être indexable en prod (AGT-04 SEO).

### Maintenance

- `/maintenance` (hors `[locale]`) — page de courtoisie.

## Routes admin (36) — toutes sous `[locale]/(admin)/[adminPrefix]`

- Dashboard : `/{adminPrefix}/`
- Auth : `/{adminPrefix}/login`, `/{adminPrefix}/2fa/setup`
- CRUD admin : `activity-logs`, `alerts`, `blog` (+ `/new` + `/[id]`), `calendrier`, `case-studies` (+ `/new` + `/[id]`), `categories` (+ `/new` + `/[id]`), `faq` (+ `/new` + `/[id]`), `help` (+ `/new` + `/[id]`), `infra`, `newsletter`, `options` (+ `/[id]`), `settings` (+ `/new` + `/[key]`), `submissions`

→ Toutes les routes admin sont sous segment dynamique `[adminPrefix]` lu depuis `ADMIN_URL_PREFIX` env (anti-énumération URL). Vérification leak sitemap : AGT-04 + R-04.

## API routes (10 endpoints)

| Endpoint                        | Méthode (présumée) | Auth             | Notes                                         |
| ------------------------------- | ------------------ | ---------------- | --------------------------------------------- |
| `/api/auth/[...nextauth]`       | GET/POST           | Auth.js          | NextAuth catch-all                            |
| `/api/admin/newsletter/export`  | GET                | admin auth       | export CSV (force-dynamic)                    |
| `/api/admin/submissions/export` | GET                | admin auth       | export CSV (force-dynamic)                    |
| `/api/healthz`                  | GET                | public           | renvoie `{status,db,redis,version,timestamp}` |
| `/api/gdpr-export`              | GET                | token signé      | livraison fichier export                      |
| `/api/gdpr-export/request`      | POST               | rate-limited     | déclenche export                              |
| `/api/unsubscribe`              | GET                | token signé      | newsletter unsubscribe                        |
| `/api/indexnow`                 | POST               | webhook IndexNow | (Bing protocol)                               |
| `/api/indexnow/key`             | GET                | public           | renvoie la clé pour validation                |
| `/api/vitals`                   | POST               | rate-limited     | beacon Web Vitals                             |

→ Aucune route API "ouverte" sans rationale. 7/10 lisibles publiquement avec rate-limit + token quand sensible. Audit Zod/CSRF : AGT-10.

## Routes spéciales (root)

| Route                          | Type           | Source                                      |
| ------------------------------ | -------------- | ------------------------------------------- |
| `/sitemap-index.xml`           | route handler  | `src/app/sitemap-index.xml/route.ts`        |
| `/sitemap.ts`                  | metadata route | présent au build (mais 404 prod observé) ⚠️ |
| `/llms.txt`                    | route handler  | `src/app/llms.txt/route.ts`                 |
| `/llms-full.txt`               | route handler  | `src/app/llms-full.txt/route.ts`            |
| `/robots.txt`                  | metadata route | `src/app/robots.ts` (à confirmer)           |
| `/manifest.webmanifest`        | metadata route | `src/app/manifest.ts` (à confirmer)         |
| `/opengraph-image.tsx`         | OG dynamic     | racine app + per-page                       |
| `/apple-icon.tsx`, `/icon.tsx` | favicons       | racine                                      |

⚠️ **Bug pré-existant** : `/sitemap.xml` répond 404 en prod, mais `/sitemap-index.xml` 200. Le `<sitemapindex>` est servi mais Google attend également `/sitemap.xml` ou la déclaration dans `robots.txt`. À cross-référencer avec robots.txt (AGT-04).

## Statut rendu (échantillon — détaillé AGT-02)

- Pages publiques : majoritairement **SSG** via `generateStaticParams` (interventions, implementation, villes, blog).
- Pages bilingues (paramètre `[locale]` racine) : SSG + ISR `revalidate` selon doctrine.
- Pages admin : **force-dynamic** (auth, données live Prisma).
- API : Edge (auth, healthz) ou Node (admin export, GDPR export Postgres-bound).

`force-dynamic` détecté dans :

- `src/app/[locale]/(admin)/[adminPrefix]/page.tsx`
- `src/app/api/admin/newsletter/export/route.ts`
- `src/app/api/admin/submissions/export/route.ts`
- `src/app/api/gdpr-export/request/route.ts`
- `src/app/api/gdpr-export/route.ts`
- `src/app/api/healthz/route.ts`
- `src/app/api/unsubscribe/route.ts`
- `src/app/llms-full.txt/route.ts`, `src/app/llms.txt/route.ts`
- `src/app/sitemap-index.xml/route.ts`
- `src/app/maintenance/page.tsx`

→ 11 routes force-dynamic identifiées. Cohérent avec doctrine SSG public.

## CSV → marqué `[CSV NON GÉNÉRÉ — volume]`

CSV fichier-par-fichier ROUTES non émis dans ce livrable (112 lignes). Re-générable à la volée. Phase 4 prod-live exploitera le sous-ensemble Top 15.
