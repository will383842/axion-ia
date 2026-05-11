# AGT-01 — ARCHITECTURE-DRY

> Audit E2E Axion-IA, Phase 2, HEAD `b6d17ad` du `2026-05-11`.
> Périmètre : SSOT, duplications, abstractions prématurées, couches, RSC vs `'use client'`, `cache()`, server actions, naming.
> Mode AUDIT-ONLY strict (lecture seule).

## Score : 84/100

Décomposition (pondération interne) :

| Sous-domaine                          |  Score | Pondération | Contribution |
| ------------------------------------- | -----: | ----------: | -----------: |
| SSOT pricing.ts                       | 95/100 |        0.15 |        14.25 |
| SSOT brand.ts                         | 70/100 |        0.05 |         3.50 |
| SSOT routes.ts / i18n routing         | 80/100 |        0.10 |         8.00 |
| SSOT intl.ts                          | 95/100 |        0.05 |         4.75 |
| SSOT seo.ts                           | 95/100 |        0.10 |         9.50 |
| RSC vs `'use client'`                 | 95/100 |        0.10 |         9.50 |
| Server actions (DRY public + admin)   | 70/100 |        0.15 |        10.50 |
| Cache / revalidate strategy           | 80/100 |        0.05 |         4.00 |
| Couches features → lib → prisma       | 95/100 |        0.05 |         4.75 |
| Composants : duplications / code mort | 75/100 |        0.10 |         7.50 |
| RHF watch() — re-renders              | 60/100 |        0.05 |         3.00 |
| Naming canon / doctrine               | 95/100 |        0.05 |         4.75 |
| **Total pondéré**                     |        |    **1.00** |      **~84** |

## Confiance : haute

Justification : lecture directe des 392 fichiers `src/**` via Grep/Read ciblés, vérification croisée des SSOT (pricing, brand, routes, intl, seo) avec leurs importeurs, `pnpm typecheck` vert (0 erreur), `pnpm test` 127/127 vert (cmd `pnpm test --run` lancée 2026-05-11). Aucune zone non vérifiable hors duplication structurelle inhérente Auth.js Edge (`auth.config.ts`).

---

## Top findings

### P0 (bloquant)

Aucun P0 architecture. Tous les SSOT critiques (`pricing.ts`, `seo.ts`, `i18n/routing.ts`, `schemas/forms.ts`) sont en place et largement adoptés ; couches respectées ; aucun import inverse (`@/app/*` depuis `lib/components/features`) ; typecheck vert ; tests verts.

### P1 (sérieux)

- **P1-01 — `requireAdminRead()` dupliqué dans 13 features admin.** Pattern auth identique (`auth()` → check `session?.user?.id` → throw `"unauthorized"`) défini localement dans chacune des 13 `src/features/admin-*/actions.ts` ; `requireSuperAdmin()` dupliqué de manière équivalente dans `admin-users/actions.ts:23`. Effet : changement du contrat auth = 13 patches synchrones ; risque de drift (un seul oublié et un bypass apparaît). Refacto cible : un module `src/lib/admin-auth.ts` exportant `requireAdminRead/requireAdminWrite/requireSuperAdmin` typé sur les rôles Prisma. Citations : `src/features/admin-activity-logs/actions.ts:13`, `src/features/admin-blog/actions.ts:30`, `src/features/admin-calendar/actions.ts:33`, `src/features/admin-case-studies/actions.ts:29`, `src/features/admin-categories/actions.ts:27`, `src/features/admin-faq/actions.ts:...`, `src/features/admin-help/actions.ts`, `src/features/admin-newsletter/actions.ts`, `src/features/admin-options/actions.ts`, `src/features/admin-settings/actions.ts`, `src/features/admin-submissions/actions.ts`, `src/features/admin-testimonials/actions.ts`, `src/features/admin-users/actions.ts:23` (`requireSuperAdmin`).

- **P1-02 — `watch()` global dans 2 forms RHF → re-render à chaque keystroke.** `AuditForm.tsx:83` `const watchAll = watch();` (forme legacy 5-step) et `ImplementationForm.tsx:90` même pattern, consommés via `(watchAll as { size?: string }).size ?? ""` pour 3 champs à chacun. Avec React 19 + Compiler désactivé (`next.config.ts:106-110`), chaque saisie déclenche un render complet du wizard. Refacto cible : `watch(["size","modality","consent"])` ou `Controller` pour ne s'abonner qu'aux clés réellement consommées. Citations : `src/components/forms/AuditForm.tsx:83,162,186,274` ; `src/components/forms/ImplementationForm.tsx:90,165,190,249`. À noter : `BookingForm.tsx:65`, `ContactForm.tsx:43`, `NewsletterForm.tsx:40` utilisent déjà `watch("consent")` ciblé — pattern propre.

- **P1-03 — Code mort calendrier : `HouseCalendar.tsx` (268 LOC) + `BookingFlow.tsx` (32 LOC) + tests.** Aucune page de `src/app/**` n'importe `HouseCalendar` ou `BookingFlow` (grep négatif, hors composants entre eux + `HouseCalendar.test.tsx`). `/reserver` utilise `BookingCalendar` direct via `BookingCalendarLazy`. Soit ces fichiers sont legacy d'un proto précédent, soit ils sont un futur entry-point. Effet : ~300 LOC + 1 fichier test maintenus pour rien + risque de re-divergence si quelqu'un patche le mauvais composant. Citations : `src/components/calendar/HouseCalendar.tsx`, `src/components/calendar/BookingFlow.tsx`, `src/components/calendar/HouseCalendar.test.tsx`. À supprimer ou à câbler explicitement.

- **P1-04 — Server actions publiques : pattern boilerplate dupliqué 5 fois.** Chaque action `(audit, audit-request, booking, contact, implementation)` réimplémente la même séquence : `getClientIp()` → `checkRateLimit()` → honeypot `formData.get("website")` → `verifyTurnstile()` → `safeParse` → `parseLocale()` → `prisma.submission.create()` → `sendTelegram({ tag, body: redactContactLine(...) })` → `enqueueEmail()`. ~30 LOC identiques × 5 = ~150 LOC reproduites. Effet : un hardening sécurité (nouveau header, double Turnstile, validation IPv6, …) demande 5 patches. Refacto cible : helper `withPublicSubmission({ kind, schema, rateLimit, telegramTag, emailTemplate })(handler)` (ou `next-safe-action` middleware). Citations : `src/features/audit/actions.ts:22-85` ; `src/features/contact/actions.ts:21-74` ; `src/features/implementation/actions.ts:21-78` ; `src/features/booking/actions.ts:41-...` ; `src/features/newsletter/actions.ts`. `next-safe-action` non installé (`package.json` grep négatif) — la pile actuelle est manuelle.

### P2 (confort)

- **P2-01 — `BRAND.taglineFr/taglineEn` sous-adopté.** `src/lib/brand.ts` exporte la SSOT `BRAND.taglineFr = "cabinet IA opérationnel"`, mais la chaîne `"cabinet IA opérationnel"` est hardcodée dans ≥10 fichiers (`src/app/llms-full.txt/route.ts`, `src/app/[locale]/a-propos/page.tsx`, `src/app/[locale]/comparaisons/page.tsx`, `src/app/[locale]/contact/page.tsx`, `src/app/[locale]/implantations/page.tsx`, `src/app/[locale]/implantations/[region]/page.tsx`, `src/app/[locale]/implantations/[region]/[ville]/page.tsx`, `src/app/[locale]/page.tsx`, `src/app/[locale]/sections/page.tsx`, `src/content/comparaisons.ts`). Total 42 occurrences vs 11 `BRAND.` usages. Refacto cible : `import { BRAND } from "@/lib/brand"` puis `BRAND.taglineFr`.

- **P2-02 — `process.env.ADMIN_URL_PREFIX ?? "admin-dev-x7k2n9"` dupliqué 5 fois.** Pourtant `src/lib/admin-path.ts:27` expose `adminSegment()` exactement pour ce besoin. Cibles à migrer : `src/app/[locale]/(admin)/[adminPrefix]/layout.tsx:73`, `src/app/[locale]/(admin)/[adminPrefix]/page.tsx:21`, `src/auth.config.ts:17,47`. NB : `auth.config.ts` est Edge runtime — `adminSegment()` est en `lib/` standard JS sans dépendance Node, donc importable.

- **P2-03 — Primitives Zod (`email`, consent) re-déclarées hors `schemas/forms.ts`.** `const email = z.string().email(...)` redéfini dans `src/lib/schemas/auth.ts:10`, `src/features/admin-users/actions.ts:128`, `src/app/api/gdpr-export/request/route.ts:20`, `src/app/api/gdpr-export/route.ts:23` (avec `.toLowerCase().trim()` qui diverge — variation non documentée). Refacto cible : extraire `src/lib/schemas/primitives.ts` (email, phone, consent, locale, name) avec variantes documentées (`emailNormalized`, `emailRaw`).

- **P2-04 — SSOT `ROUTES` (`src/lib/routes.ts`) anti-adoptée.** Seulement **3 importeurs** (`Header.tsx`, `Footer.tsx`, `manifest.ts`) et **7 usages `ROUTES.*`** vs 89 occurrences de string-literal `/audit|/interventions|...` dans 41 fichiers. La typed-safety vient du `<Link href>` de next-intl qui typecheck déjà contre `routing.pathnames`. Conséquence : `routes.ts` apporte peu de valeur en l'état (redondance avec next-intl). Décision : soit étendre l'adoption (mais bénéfice marginal car next-intl typed-Link existe), soit déclasser `routes.ts` à un alias documenté pour les 3 importeurs actuels et marquer dans la docstring. Citations : `src/lib/routes.ts:21-89`, `src/components/nav/Header.tsx:31-52` (utilise strings directes typées).

- **P2-05 — `BookingCalendar.tsx` 2131 LOC dans un seul fichier client.** Mêlange : grid mois + modal multi-step + form 4 étapes + autosave localStorage. Charge cognitive élevée + risque cascading re-render. Splittable en `MonthGrid`, `BookingModal`, `BookingMultiStepForm` partageant un store local minimal. Non bloquant (perfo gérée via `BookingCalendarLazy` + `ssr:false`), mais maintenance coûteuse. Citation : `src/components/calendar/BookingCalendar.tsx:1-2131`.

- **P2-06 — `TrustBar.tsx` n'est référencé que dans `/sections` sandbox.** `grep` négatif pour utilisation en page publique hors `src/app/[locale]/sections/page.tsx:10`. Soit composant futur (cf. liste villes V2), soit code mort. Citation : `src/components/sections/TrustBar.tsx`. À garder si roadmap M11 prévoit son adoption.

- **P2-07 — TODO(pricing) résiduels non bloquants.** 3 `TODO(pricing)` à valider avec Will (`src/app/[locale]/cas-concrets/page.tsx:251`, `src/app/[locale]/implementation/page.tsx:44,98`). 0 FIXME, 0 HACK. Densité dette technique exceptionnellement basse (4 marqueurs / 392 fichiers).

---

## Détail par sous-chapitre

### 1. SSOT pricing.ts — 95/100

- Fichier `src/content/pricing.ts` (694 LOC) — SSOT stricte des tarifs, helpers `formatPrice`, `formatAmount`, `getTierById`, `getEntryTier`, `getEntryLabel`, `formatOnsiteSplit`.
- **Phrases interdites doctrine** (`« basé en UE »`, `« ½ journée »`, `« pas de plan sur-mesure »`) : grep négatif en code, 2 résidus en **commentaires explicatifs** (`src/content/villes/copy/paris.ts:4,87`, `src/content/pricing.ts:242`) qui notent la suppression — **conforme**.
- **Montants hardcodés en JSX** : 3 occurrences `price: "0"`, `"0 € → 99 €/mois"`, `"25 k€ → 200 k€"` dans `src/app/[locale]/implementation/page.tsx:222,243` et `src/app/[locale]/guide-ia/page.tsx:85` — il s'agit des **tarifs concurrents** (Make/Zapier, agence classique) dans la table comparative, **légitimement hardcodés** (pas Axion-IA). Le tier Axion-IA dérive bien de `formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "fr")` (`page.tsx:261`).
- Mentions chiffrées dans copy blog (`5 000 €`, `8 000-50 000 €`) : **narratives** dans `src/content/blog/posts/*.ts` — pas des prix Axion-IA. OK.
- **Adoption** : `formatAmount`/`formatPrice` cités dans Header, AuditRequestForm, interventions.ts, ProductPageTemplate, comparatif implémentation, etc. Drift = 0 en code applicatif.
- Note : `INTERVENTION_FEES_NOTE` exporté (`pricing.ts:96-99`) bien adopté.

### 2. SSOT brand.ts — 70/100

- `src/lib/brand.ts` (32 LOC) — bien designé (`BRAND.name`, `BRAND.legalName`, `BRAND.taglineFr/taglineEn`, `BRAND.url` dérivée de `env.NEXT_PUBLIC_SITE_URL`, `BRAND.packageSlug`).
- **Sous-adoption** : 11 usages `BRAND.*` vs 42 occurrences `"cabinet IA opérationnel"` hardcodées. Cf. P2-01.
- Naming `Axion-IA` (avec tiret, IA majuscule) cohérent partout en customer-facing — vérifié `grep -rn "axionia[^a-zA-Z_-]" → 10 hits seulement, tous identifiers techniques (camelcase JS, paths slug, track event name "impl-compare-axionia", localStorage key "axionia.booking.draft.v1"). Doctrine `axionia_naming_brand_vs_project` respectée.

### 3. SSOT routes.ts vs i18n/routing.ts — 80/100

- VRAIE SSOT routes = `src/i18n/routing.ts` (174 LOC, `routing.pathnames` typed) — 53 routes mappées FR↔EN, doctrine URL canonique `/fr/implantations/<region>/<ville>` confirmée (`routing.ts:154-160`).
- `src/lib/routes.ts:21-89` est un alias secondaire (`ROUTES.home`, `ROUTES.audit`, …) — 3 importeurs seulement (cf. P2-04). Existence justifiée pour Header/Footer/manifest mais bénéfice marginal car le `<Link href>` de next-intl typecheck déjà contre `routing.pathnames`. Le `satisfies Record<string, RouteKey>` (`routes.ts:89`) garantit la non-divergence — c'est ce qui justifie de garder le fichier.

### 4. SSOT intl.ts — 95/100

- `src/lib/intl.ts` (146 LOC) — helpers `fmtNumber/fmtPopulation/fmtCurrency/fmtDate/fmtList/pluralRule/localeCompare` typés sur `Locale = "fr"|"en"` avec mapping BCP47 centralisé.
- **Adoption** : 10 importeurs, **0 occurrence directe `Intl.NumberFormat/Intl.DateTimeFormat` hors `lib/intl.ts`** (grep négatif). Excellent. 2 résidus `toLocaleString` (`src/app/[locale]/(admin)/[adminPrefix]/alerts/page.tsx`, `src/lib/email/templates/option-posted.tsx`) — admin + email, non bloquant.

### 5. SSOT seo.ts — 95/100

- `src/lib/seo.ts` (1056 LOC) — 20 builders JSON-LD exposés (`buildProductMetadata`, `buildServiceJsonLd`, `buildFaqJsonLd`, `buildBreadcrumbJsonLd`, `buildOrganizationJsonLd`, `buildWebsiteJsonLd`, `buildPersonJsonLd`, `buildArticleJsonLd`, `buildFaqSpeakableJsonLd`, `buildLocalBusinessJsonLd`, `buildPlaceJsonLd`, `buildItemListJsonLd`, `buildProductJsonLd`, `buildHowToJsonLd`, `buildReviewJsonLd`, `buildAggregateRatingJsonLd`, `buildDatasetJsonLd`, `buildImageObjectJsonLd`, `buildQAPageJsonLd`). 84 fichiers importent depuis `@/lib/seo`. Couverture quasi-complète.
- `SITE_URL` dérivée de `env.NEXT_PUBLIC_SITE_URL` (`seo.ts:5`) — pas de hardcode `https://axion-ia.com` hors `env`.

### 6. RSC vs `'use client'` — 95/100

- 53 fichiers `"use client"` sur 392 (~13.5 %). Très bon ratio RSC-first.
- Distribution : 36 components + 18 app routes (admin forms + error boundary requis Next).
- Tous les `"use client"` dans `src/app/**` (18 fichiers) sont soit admin forms (interactivité requise), soit `global-error.tsx`, soit `error.tsx` — **100 % justifiés** (Next 16 exige `"use client"` sur error boundaries).
- Justifications inline présentes (`AuditForm.tsx:1-3` : « 5-step wizard with local state + RHF validation », `FadeInOnView.tsx:2` : « IntersectionObserver runs in the browser only », `BookingCalendar.tsx:1-15` : « calendrier statefull »). Doctrine respectée.

### 7. Server actions (DRY) — 70/100

- 19 fichiers `src/features/*/actions.ts` + 1 page server action inline (`src/app/[locale]/(admin)/[adminPrefix]/page.tsx:18-23` `logoutAction`).
- **Pattern public (5 fichiers)** : ~30 LOC boilerplate identique → P1-04 ci-dessus.
- **Pattern admin (14 fichiers)** : `requireAdminRead/requireSuperAdmin` dupliqués → P1-01 ci-dessus.
- **Bons points** :
  - Tous typés `_prev: State` + `formData: FormData` → `Promise<State>` (compatible `useActionState`).
  - Validation Zod systématique (`schema.safeParse` puis `if (!parsed.success) return { ok:false, error }`).
  - PII Telegram redacted via `redactContactLine(parsed.data.contact, parsed.data.email)` — Sprint 24.1 OK, 14 sites confirmés.
  - Transaction Prisma atomique pour booking (`booking/actions.ts:79-...` doctrine doc 09b verrou pessimiste).
- **Manques** :
  - Pas de `next-safe-action` (`grep package.json` négatif) → tout est manuel. Acceptable mais l'helper `withPublicSubmission(...)` proposé en P1-04 simplifierait sans dépendance externe.
  - Pas de standardisation sur le type de retour (`{ok:true; submissionId}` vs `{ok:true; bookingId}` vs `{ok:true}` vs `{ok:false; error; reason?}` divergent). À harmoniser.

### 8. Cache / revalidate — 80/100

- **0 usage** de `cache()` React (`grep "import.*cache.*from.*react"` négatif) et **0 usage** de `unstable_cache` Next 16. Toute la donnée pricing/i18n/routes est en `const` TS au build-time → effectivement cachée par le compilateur, donc justifié.
- **12 usages** de `revalidatePath` (admin actions) pour invalider les listings après mutation.
- `revalidate` exports : `src/app/sitemap-index.xml/route.ts:26` (3600 s) seulement.
- `export const dynamic` : `force-static` (`maintenance/page.tsx:43`, `sitemap-index.xml/route.ts:25`) et `force-dynamic` (admin, API, llms.txt, healthz, gdpr-export, …) cohérents.
- `Cache-Control` headers per-route définis dans `next.config.ts:117-131` pour sitemap.xml/sitemap/\* et opengraph-image/twitter-image. RSS feeds (`blog/feed.xml`, `cas-concrets/feed.xml`, `faq/feed.xml`) ont leurs propres `Cache-Control` (300-3600 s + SWR 86400 s).
- **Manque** : aucune route ne tag explicitement via `revalidateTag` (cohérent avec absence de `unstable_cache`). Acceptable pour le V1 où le contenu marketing est ~100 % SSG.

### 9. Couches features → lib → prisma — 95/100

- **Aucun import inverse** : `grep "from \"@/app/" src/lib/ src/components/ src/features/"` → 0 résultat.
- `src/components/` n'importe **jamais** `@/lib/prisma` directement (grep négatif). Les Forms importent les server actions co-localisées dans `@/features/<domain>/actions.ts`, qui elles importent Prisma. Couches strictes.
- 90 imports `@/lib/*` depuis `src/features/*` + 7 imports `@/server/*` (queue BullMQ). Direction correcte.
- `serverExternalPackages` (`next.config.ts:56-67`) verrouille `@prisma/client`, `argon2`, `bullmq`, `ioredis`, `otplib`, `sharp`, `pino`, `@react-email/render`, `nodemailer` contre tout leak client. Garde-fou solide.

### 10. Composants : duplications / code mort — 75/100

- **HeroSchema** : 14 variants (~2856 LOC). Tous portent `.hero-schema` (carré 576×576 lg+ doctrine) et chacun illustre une métaphore visuelle distincte (Help = constellation, Methodology = timeline, Audit = pyramide). `DetailHeroSchema` est paramétrable (`DetailHeroBlock[]` + `accent`). **Coexistence légitime** — doctrine de rythme visuel page-par-page assumée (`axionia_visual_rhythm_sprint_AB_2026-05-07`).
- **ProductPageTemplate** (480 LOC) adopté par 19 pages — bon DRY.
- **LegalPageTemplate** adopté par 6 pages.
- **VilleServicePageTemplate** (554 LOC) adopté par 3 pages (audit, interventions, implementation par ville).
- **Forms** : 6 fichiers, ~2522 LOC. `AuditForm` (legacy 5-step) coexiste avec `AuditRequestForm` (riche 6-step, doctrine Sprint 17). **Question STOP & ASK** : `AuditForm` (`/audit` page) est-il encore branché ou peut-on retirer ? → grep `submitAuditAction` : `src/components/forms/AuditForm.tsx:17` + `src/features/audit/actions.ts:22`. `AuditForm` est utilisé sur `/audit` (action embarquée `submitAuditAction`), différent de `/audit/demande` (qui utilise `AuditRequestForm` + `submitAuditRequestAction`). Coexistence assumée. À harmoniser idéalement.
- **Code mort calendrier** : cf. P1-03 (`HouseCalendar` + `BookingFlow`).
- **TrustBar** : cf. P2-06 (sandbox-only).

### 11. RHF watch() — 60/100

- 5 forms RHF :
  - `BookingForm.tsx:65` → `watch("consent")` ✅ ciblé
  - `ContactForm.tsx:43` → `watch("consent")` ✅ ciblé
  - `NewsletterForm.tsx:40` → `watch("consent")` ✅ ciblé
  - `AuditForm.tsx:83` → `watch()` ❌ tout-l'objet (P1-02)
  - `ImplementationForm.tsx:90` → `watch()` ❌ tout-l'objet (P1-02)
- React Compiler désactivé (`next.config.ts:106-110` commenté). Le sur-render est donc réel — à mesurer en INP sur `/audit` (cf. budget `_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md` exception /reserver INP ≤ 150 ms).

### 12. Naming canon / doctrine — 95/100

- 0 hit pour `agence IA`, `studio IA`, `atelier IA`, `AI agency` dans code (hors références concurrents en comparatif).
- 125 occurrences `Axion-IA`/`axionia` / variants. Customer-facing : `Axion-IA` (avec tiret) systématique via `BRAND.name` ou inline. Identifiants techniques (`WhyAxionIA`, `axionia.booking.draft.v1`, track event name, slug Facebook URL) en camelcase/slug — conforme doctrine `axionia_naming_brand_vs_project`.
- `cabinet IA opérationnel` (FR) + `operational AI consultancy` (EN) : présent dans copy. Adoption SSOT `BRAND.taglineFr` à étendre (P2-01).

---

## Citations (récap)

| Finding                         | Citation                                                                                                                                                                                                                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1-01 admin auth dup            | `src/features/admin-activity-logs/actions.ts:13`, `src/features/admin-blog/actions.ts:30`, `src/features/admin-calendar/actions.ts:33`, `src/features/admin-case-studies/actions.ts:29`, `src/features/admin-categories/actions.ts:27`, `src/features/admin-users/actions.ts:23,30` |
| P1-02 watch() global            | `src/components/forms/AuditForm.tsx:83,162,186,274` ; `src/components/forms/ImplementationForm.tsx:90,165,190,249`                                                                                                                                                                  |
| P1-03 code mort calendrier      | `src/components/calendar/HouseCalendar.tsx`, `src/components/calendar/BookingFlow.tsx`, `src/components/calendar/HouseCalendar.test.tsx` ; `grep "HouseCalendar\|BookingFlow" src/app/` → 0 hit                                                                                     |
| P1-04 server action boilerplate | `src/features/audit/actions.ts:22-85` ; `src/features/contact/actions.ts:21-74` ; `src/features/implementation/actions.ts:21-78` ; `src/features/booking/actions.ts:41+` ; `src/features/newsletter/actions.ts`                                                                     |
| P2-01 tagline hardcodée         | `grep "cabinet IA opérationnel" src/` → 42 hits dans 10+ fichiers ; `grep "BRAND\." src/` → 11 hits seulement                                                                                                                                                                       |
| P2-02 ADMIN_URL_PREFIX dup      | `src/app/[locale]/(admin)/[adminPrefix]/layout.tsx:73`, `src/app/[locale]/(admin)/[adminPrefix]/page.tsx:21`, `src/auth.config.ts:17,47` vs `src/lib/admin-path.ts:27` `adminSegment()`                                                                                             |
| P2-03 Zod primitives dup        | `src/lib/schemas/auth.ts:10`, `src/lib/schemas/forms.ts:6`, `src/features/admin-users/actions.ts:128`, `src/app/api/gdpr-export/request/route.ts:20`, `src/app/api/gdpr-export/route.ts:23`                                                                                         |
| P2-04 ROUTES anti-adoptée       | `src/lib/routes.ts:21-89` (3 importeurs) ; 89 string-literals dans 41 fichiers                                                                                                                                                                                                      |
| P2-05 BookingCalendar fat       | `src/components/calendar/BookingCalendar.tsx:1-2131`                                                                                                                                                                                                                                |
| P2-06 TrustBar code mort prod   | `src/components/sections/TrustBar.tsx` ; usage unique `src/app/[locale]/sections/page.tsx:10`                                                                                                                                                                                       |
| Typecheck vert                  | `pnpm typecheck` (cmd lancée 2026-05-11) → 0 erreur                                                                                                                                                                                                                                 |
| Tests verts                     | `pnpm test --run` → 19 files / 127 tests passed                                                                                                                                                                                                                                     |
| 0 cache() / 0 unstable_cache    | `grep "from \"next/cache\"" src/` → 14 fichiers, tous `revalidatePath` ; `grep "import.*cache.*from.*react"` → 0 ; `grep "unstable_cache"` → 0                                                                                                                                      |
| Couches propres                 | `grep "from \"@/app/" src/lib/ src/components/ src/features/` → 0                                                                                                                                                                                                                   |
| Prisma jamais dans components   | `grep "from \"@/lib/prisma\"" src/components/` → 0                                                                                                                                                                                                                                  |
| Doctrine phrases interdites     | `grep -rln "« basé en UE »\|basé en UE\|½ journée\|pas de plan sur-mesure" src/` → 2 hits, tous dans commentaires explicatifs (`paris.ts:4,87` `pricing.ts:242`)                                                                                                                    |

---

## [INCONNU] — éléments non vérifiables

- **Render-cost réel `watch()` global P1-02** : nécessiterait React DevTools Profiler en runtime navigateur (hors AUDIT-ONLY, cf. master § 0.5). Estimation faite par lecture statique uniquement.
- **Décision Will sur `AuditForm` vs `AuditRequestForm`** : faut-il déprécier `AuditForm` legacy ? Le contexte mémoire ne tranche pas. → STOP & ASK.
- **Adoption planifiée `TrustBar` V2** : impossible à inférer du code seul. → STOP & ASK.
- **Sentry wrapping** : `withSentryConfig` absent de `next.config.ts` mais 3 `sentry.*.config.ts` présents. Hors périmètre AGT-01 — flaggé pour AGT-12 INFRA-CICD / AGT-14 MONITORING-DR.
- **Justification 2131 LOC BookingCalendar** : abstractions multi-step + autosave + grid mois — décision Will historique non documentée dans ADR. → STOP & ASK soft.

---

## Recommandations (≤ 10, classées effort × impact)

| #   | Action                                                                                                                                                                                              |      Effort |               Impact | Priorité |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------: | -------------------: | -------- |
| 1   | Créer `src/lib/admin-auth.ts` (`requireAdminRead/requireAdminWrite/requireSuperAdmin`) + migrer 13 features admin. Bonus : test unitaire dédié + log Sentry sur throw `unauthorized`/`forbidden`.   |   M (2-3 h) |      Haut sécu + DRY | **P1**   |
| 2   | Patcher `AuditForm.tsx:83` + `ImplementationForm.tsx:90` : remplacer `watch()` par `watch(["size","modality","consent"])` (ou variantes). Tester INP via Lighthouse local /audit + /implementation. | XS (15 min) |            Haut perf | **P1**   |
| 3   | Supprimer `HouseCalendar.tsx` + `BookingFlow.tsx` + `HouseCalendar.test.tsx` (ou les câbler explicitement et documenter dans CLAUDE.md / ADR).                                                      | XS (10 min) |              Bas LOC | **P1**   |
| 4   | Extraire helper `withPublicSubmission({ kind, schema, rateLimit, telegramTag, emailTemplate })(handler)` et migrer les 5 server actions publiques. ~150 LOC supprimées.                             |   M (3-4 h) |      Haut DRY + sécu | **P1**   |
| 5   | Migrer 10+ hardcodes `"cabinet IA opérationnel"` vers `BRAND.taglineFr`/`taglineEn`. Idem `Axion-IA` → `BRAND.name` dans titres de page (audit séparé).                                             | XS (30 min) |           Moyen SSOT | **P2**   |
| 6   | Migrer 5 occurrences `process.env.ADMIN_URL_PREFIX ?? "admin-dev-x7k2n9"` vers `adminSegment()` (lib/admin-path.ts). Edge-safe car aucune dép Node.                                                 | XS (15 min) |            Moyen DRY | **P2**   |
| 7   | Extraire `src/lib/schemas/primitives.ts` (email/phone/consent/name/locale) + variantes documentées (`emailNormalized`). Migrer 5 importeurs Zod.                                                    |     S (1 h) |            Moyen DRY | **P2**   |
| 8   | Splitter `BookingCalendar.tsx` en `MonthGrid` + `BookingModal` + `BookingMultiStepForm` partageant un store léger.                                                                                  |   L (4-6 h) |    Moyen maintenance | P3       |
| 9   | Standardiser le type de retour des server actions publiques : `type ActionResult<T> = { ok:true; data:T } \| { ok:false; error:string; reason?:string }`.                                           |     S (1 h) | Moyen API uniformité | P3       |
| 10  | Statuer sur `routes.ts` : soit étendre l'adoption (90 string-literals à migrer = L), soit déclasser à 3 alias documentés. Décision Will.                                                            |        XS-L |     Bas-Moyen clarté | P3       |

---

## STOP & ASK consolidés (questions ouvertes pour Will)

- **Q-01 (P1-03)** : `HouseCalendar.tsx` + `BookingFlow.tsx` sont-ils code mort à supprimer, ou un futur entry-point V2 à câbler ? → Décision binaire avant patch.
- **Q-02 (P2-06)** : `TrustBar` reste-t-il en sandbox `/sections` uniquement, ou doit-il atterrir sur la home / pages produit (Sprint M11 ?) ? → Si non utilisé V1, candidate à `/* TODO-V2 */` ou suppression.
- **Q-03 (composants section 10)** : `AuditForm` (5-step legacy) doit-il être déprécié au profit de `AuditRequestForm` (6-step riche) avec redirect `/audit` → `/audit/demande` ? Ou les deux ont-ils un rôle distinct figé ?
- **Q-04 (P2-05)** : `BookingCalendar.tsx` 2131 LOC justifie-t-il un split (effort L) avant Sprint M11, ou ce composant est-il stabilisé (gel) ?
- **Q-05 (P2-04)** : `src/lib/routes.ts` : extension (90 string-literals à migrer) ou déclassement (3 alias) ?
- **Q-06 (P1-04)** : OK pour helper interne `withPublicSubmission` (~3 h), ou préférence pour adoption `next-safe-action` (dépendance externe, ~5 h migration + tests) ?
- **Q-07 (next.config.ts:106-110)** : React Compiler reste désactivé jusqu'à mesure RUM Sprint 17 ? → Confirmer pour calibrer l'urgence de P1-02 (si Compiler activé, sur-render `watch()` devient inoffensif). Trigger phrase mémoire `axionia_perf_audit_2026-05-07` rappelle que perf nav est suspect.

---

_Fin AGT-01 ARCHITECTURE-DRY — score 84/100, confiance haute, 0 P0, 4 P1, 7 P2._
