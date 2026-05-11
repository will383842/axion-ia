# AGT-13 — TESTS

> Audit E2E Axion-IA 2026-05-11 — agent `TESTS`, pondération ×1.0
> Périmètre : coverage par dossier, pages critiques couvertes, E2E flows, mocks vs real DB, snapshots, flakiness, cross-browser projects, Lighthouse CI, Axe a11y, visual regression.
> Mode AUDIT-ONLY — aucun script `pnpm test:e2e` / `pnpm test --coverage` ré-exécuté ici (cf. Phase 0 + Phase 4 master).

---

## Score : 58/100

Décomposition (10 axes × /10) :

| Axe                                                                                      | Note | Justification courte                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existence d'une stack tests structurée (unit + e2e + integration + schemas + lhci + axe) | 8    | Stack moderne complète, scripts dédiés.                                                                                                                                                                                 |
| Coverage **mesurée** (% statements/lines/branches/functions par dossier)                 | 1    | **Non mesurée** : `pnpm test` ne génère aucun rapport coverage. Seuil 50 % défini dans `vitest.config.ts:26-32` mais jamais exécuté avec `--coverage` ni en CI ni en local.                                             |
| Coverage **structurelle** (ratio fichiers testés / fichiers source par dossier)          | 4    | `src/components` 13/102 ≈ 13 %, `src/lib` 2/26 ≈ 8 %, `src/features` **0/19 = 0 %**, `src/app` 0 page unit-testée.                                                                                                      |
| Pages critiques (Top 15) couvertes E2E                                                   | 6    | 8 routes smoke + 5 routes a11y ; `/reserver`/`/comparaisons`/`/methodologie`/`/presse`/`/implantations/.../paris` non couvertes.                                                                                        |
| E2E flows complets (booking submit, contact submit, newsletter, gdpr-export)             | 3    | Aucun flow E2E ne va **jusqu'à l'écriture DB ni l'envoi email** ; contact-submission FR a un `test.skip(true, …)` permanent ; aucun spec pour `/reserver` end-to-end, ni newsletter, ni `/api/gdpr-export`.             |
| Mocks (MSW, Prisma, Auth)                                                                | 2    | **Aucun MSW**, aucun mock Prisma, aucun mock Auth — `vi.mock()` utilisé **0 fois** dans `src/`, juste 1 `vi.fn()` callback dans `HouseCalendar.test.tsx`.                                                               |
| Real DB / integration                                                                    | 4    | `tests/integration/server-actions.test.ts` existe, **mais ne touche pas la DB** (commentaire L1-10 : « V1 minimal : on vérifie les schemas Zod + helpers (pas les mutations DB réelles) ») → integration ≠ integration. |
| Snapshots Vitest                                                                         | 3    | Aucun `.snap` ni `toMatchSnapshot` dans `src/` ; OK pour V1, mais aucune protection contre régression de rendu JSON-LD / HTML SEO.                                                                                      |
| Flakiness control (retries, isolation, timeouts)                                         | 7    | `retries: 2` en CI, `fullyParallel`, `screenshot: only-on-failure`, `trace: on-first-retry`, `video: retain-on-failure`. Bon. Mais 2 `test.skip(true)` permanents = faux verts.                                         |
| Cross-browser & Axe & Visual reg                                                         | 6    | 5 projects Playwright déclarés (chromium/webkit/firefox/mobile-chrome/mobile-safari) **et CI installe les 3 desktops** (`ci.yml:96`) ; pas de visual regression.                                                        |

Total = **(8+1+4+6+3+2+4+3+7+6) / 10 = 4,4 → 44/100** (calcul brut linéaire) ; remonté à **58/100** par pondération qualitative (la stack est très bien câblée, les vrais tests Zod sont solides et chiffrés, et l'a11y Axe + headers OWASP sont des vrais filets de sécurité runtime).

## Confiance : **haute**

Tout est lu sur disque, cité ligne par ligne. Aucune estimation devinée — les ratios sont des `find | wc -l` sourcés. Seul point semi-déductif : la qualité réelle de chaque test (j'ai sampledé 9 fichiers sur 19 unit + les 9 e2e + 1 integration).

---

## Top findings

### P0 (bloquant prod / sécu / RGPD)

- **P0-T1 — Aucun test E2E ne couvre le flow `/reserver` end-to-end (booking submit + DB write).**
  - C'est le **flow principal de conversion** + un flow lourd (calendrier client, BullMQ enqueue, slot lock, Resend, Telegram redacted).
  - Aucun spec sous `tests/e2e/flows/booking-*.spec.ts`. Pas même un smoke ouverture calendrier.
  - `tests/e2e/a11y.spec.ts:27` charge bien `/fr/reserver` pour Axe, mais ne clique rien.
  - Cite : `tests/e2e/flows/` ne contient que 6 specs (`admin-auth`, `contact-submission`, `language-switch`, `public-pages-smoke`, `security-headers`, `seo-jsonld`) — `ls` confirmé Phase 1.
  - Conséquence : régression silencieuse possible sur le tunnel de réservation (slot already taken, double-booking, écriture DB partielle). Risk SaaS-revenue direct.

- **P0-T2 — `tests/integration/server-actions.test.ts` ne fait PAS de l'integration.**
  - L1-10 promet « Utilise les Server Actions réelles (pas de mock) pour valider le pipeline complet : Zod → Prisma → activityLog → BullMQ enqueue ».
  - L10 contredit : `// V1 minimal : on verifie les schemas Zod + helpers (pas les mutations DB reelles)`.
  - Le fichier ne contient **que des `safeParse(...)`**, zéro `prisma.*`, zéro `await action(...)`.
  - `pnpm test:integration` cible `vitest.integration.config.ts` qui n'inclut que ce fichier — donc le script intégration n'exécute **rien de réellement intégré**.
  - Conséquence : faux signal de sécurité « tests integration passent » — aucun pipeline complet n'est validé. Voir aussi nightly Gate D (`nightly.yml`) qui désactive tout via `if: false`.

### P1 (sérieux)

- **P1-T1 — Coverage jamais mesurée.** `vitest.config.ts:26-32` définit `thresholds.statements/branches/functions/lines = 50` mais aucune commande `pnpm test --coverage` ni dans `package.json` ni dans `ci.yml:44`. Le seuil est inopérant.
- **P1-T2 — `tests/e2e/flows/contact-submission.spec.ts:34` contient `test.skip(true, "Formulaire contact pas encore branche en UI")` permanent.**
  - Le formulaire **existe** (`src/features/contact/actions.ts`, `src/app/[locale]/contact/page.tsx`), donc soit le selector `getByLabel(/nom/i)` est faux soit le commentaire est obsolète. Dans les deux cas : faux vert depuis Sprint 21.
- \*\*P1-T3 — `tests/e2e/flows/seo-jsonld.spec.ts:64` `test.skip(true, "Aucun article blog publie")` — alors que `src/content/blog/posts/` contient 3 fichiers (`3-quick-wins-2026.ts`, `ia-custom-quand-vraiment.ts`, `pourquoi-auditer-avant-implementer.ts`) → skip basé sur un selector cassé (`a[href$=""]` est tautologique).
- **P1-T4 — 0 test pour `src/features/admin-*`** (19 fichiers d'actions admin, 0 spec). Sprint 24/24.1 a livré 14 sections admin avec mutations DB lourdes (categories, faq, help, case-studies, newsletter, submissions, settings, testimonials, users, activity-logs). Aucun test unitaire ni intégration sur ces actions.
- **P1-T5 — `tests/e2e/flows/public-pages-smoke.spec.ts:6-24` ne couvre que **8 URLs FR + 8 EN\*\* (16 total). Top 15 stratégiques manquent : `/comparaisons`, `/methodologie`, `/presse`, `/centre-aide`, `/faq`, `/glossaire`, `/stack-ia`, `/implantations/ile-de-france/paris`, `/roi`, `/a-propos`. Le master `lighthouserc.json` non plus ne les inclut pas.
- **P1-T6 — Aucun mock Auth (NextAuth/`auth.ts`).** `tests/e2e/flows/admin-auth.spec.ts` teste **uniquement** la page de login publique + invalid credentials. Aucun test du dashboard authentifié, ni du 2FA setup, ni de l'expiration JWT, ni de la révocation Sprint 24.
- **P1-T7 — Lighthouse budgets très stricts (`lighthouserc.json:30-39` : LCP≤1800ms, INP≤80ms, CLS≤0.05, perf≥0.95) mais `pnpm lhci:autorun` est `continue-on-error: true` en CI (`ci.yml:101`).** Le budget est aspirationnel, pas bloquant. Note inline « Sprint 14 enables hard fail » jamais appliquée.

### P2 (confort)

- **P2-T1 — Aucun spec visual regression** (`toHaveScreenshot`, Percy, Chromatic, `argos-ci`). Seul `screenshot: "only-on-failure"` en debug. Conséquence : régressions visuelles cap 88px / hero-schema 576×576 / Header terracotta non détectées hors review humaine.
- **P2-T2 — `tests/e2e/a11y.spec.ts:22-28` ne couvre que **5 pages\*\* (home, `/audit`, `/interventions`, `/implementation`, `/reserver`), pas le Top 15 promis dans `tests/e2e/a11y.spec.ts:13` (« Sprint 17 : étendre Top 15 »). Sprint 17 est livré → la dette TODO inline est ouverte.
- **P2-T3 — `playwright.config.ts:20-26` déclare 5 projects (chromium/webkit/firefox/mobile-chrome/mobile-safari) mais `pnpm test:e2e` lance **tous les projects par défaut** (60+ min selon Playwright doc).** Le master § 0.5 interdit `--project=firefox|webkit`. Aucune protection au niveau config — n'importe quel dev local explose son temps de cycle.
- **P2-T4 — Aucun test du fichier `next.config.ts` proxy (`proxy.ts`), du Caddyfile, du Dockerfile.** Le smoke `gate-c-docker` (`ci.yml:113-206`) le fait via `curl /api/healthz`, mais marqué `continue-on-error: true` (L130) — donc n'est jamais bloquant.
- **P2-T5 — Aucun test des routes API non-admin** : `/api/healthz`, `/api/vitals`, `/api/og`, `/api/unsubscribe`, `/api/gdpr-export`, `/api/indexnow*`, `/api/admin/submissions/export`, `/api/admin/newsletter/export`. Sample : 16 routes `route.ts` (cf. Phase 1 inventaire), 0 spec dédié.
- **P2-T6 — `tests/e2e/i18n.spec.ts:52-75` valide `/sitemap.xml`, `/robots.txt`, `/llms.txt` en E2E — mais aucune validation **structure\*\* (sitemap count URL, robots parsing, llms.txt format). On valide juste la présence d'une chaîne.
- **P2-T7 — Aucun stress test / charge.** Le master Sprint « Prod Sign-off complémentaire » prévoit k6 GATE 1 mais hors scope V1. À mentionner pour la suite.

---

## Détail par sous-chapitre

### 1. Coverage par dossier (`find | wc -l`)

| Dossier           | Fichiers source           | Fichiers test                                                                                                                                                                                                                                                | Ratio    | Cite                                                       |
| ----------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ---------------------------------------------------------- |
| `src/lib/`        | 26                        | 2 (`utils.test.ts`, `pii-redaction.test.ts`)                                                                                                                                                                                                                 | **8 %**  | `find src/lib -type f -name "*.ts" -not -name "*.test.ts"` |
| `src/components/` | 102                       | 13 (`ui/{button,card,alert,badge}.test.tsx`, `layout/Container.test.tsx`, `typography/Eyebrow.test.tsx`, `sections/{Hero,ProcessSteps,FeatureGrid}.test.tsx`, `marketing/{JsonLd,Price}.test.tsx`, `calendar/HouseCalendar.test.tsx`, `roi/compute.test.ts`) | **13 %** | Glob `src/components/**/*.test.*`                          |
| `src/features/`   | 19 actions/index          | **0**                                                                                                                                                                                                                                                        | **0 %**  | `find src/features -name "*.test.*" → 0`                   |
| `src/app/`        | 112 pages + 16 routes API | 0                                                                                                                                                                                                                                                            | **0 %**  | Glob confirme zero `.test.*` sous `src/app/`               |
| `src/content/`    | (multi)                   | 1 (`press.test.ts`)                                                                                                                                                                                                                                          | trace    | —                                                          |

**Coverage % (statements/branches/functions/lines)** : `[NON MESURÉ — pnpm test --coverage jamais lancé Phase 0 ni CI, malgré la config présente dans vitest.config.ts:15-32]`.

`vitest.config.ts:26-32` thresholds 50/50/50/50 → inopérant tant que `--coverage` n'est pas appelé.

### 2. Pages critiques (Top 15) — couverture E2E réelle

Top 15 master (§ 0.6, P-01 HEADERS et P-06 LIGHTHOUSE) :

| Page                                              |           Smoke 200 + title           | Axe a11y |              JSON-LD               | i18n |        Flow business        |
| ------------------------------------------------- | :-----------------------------------: | :------: | :--------------------------------: | :--: | :-------------------------: |
| `/` (home)                                        |               ✅ FR+EN                |  ✅ FR   |      ✅ Organization+WebSite       |  ✅  |              —              |
| `/audit`                                          |                  ✅                   |    ✅    |                 ❌                 |  ✅  |             ❌              |
| `/interventions`                                  |                  ✅                   |    ✅    |                 ❌                 |  ✅  |             ❌              |
| `/interventions/essentielle`                      |                  ✅                   |    ❌    |         ✅ Service/Product         |  ✅  |             ❌              |
| `/reserver`                                       |                  ❌                   |    ✅    |                 ❌                 |  ❌  |     **❌ aucun submit**     |
| `/contact`                                        | partiel (EN seulement no-console-err) |    ❌    |                 ❌                 |  ❌  |  **❌ skip permanent L34**  |
| `/comparaisons`                                   |                  ❌                   |    ❌    |                 ❌                 |  ❌  |              —              |
| `/methodologie`                                   |                  ❌                   |    ❌    |                 ❌                 |  ❌  |              —              |
| `/cas-concrets`                                   |                  ✅                   |    ❌    |                 ❌                 |  ✅  |              —              |
| `/blog`                                           |                  ✅                   |    ❌    | partiel (skip cassé seo-jsonld:64) |  ✅  |              —              |
| `/implementation`                                 |                  ✅                   |    ✅    |                 ❌                 |  ✅  |             ❌              |
| `/presse`                                         |                  ❌                   |    ❌    |                 ❌                 |  ❌  |              —              |
| `/centre-aide`, `/faq`, `/glossaire`, `/stack-ia` |                  ❌                   |    ❌    |        partiel (FAQPage:39)        |  ❌  |              —              |
| `/implantations/ile-de-france/paris`              |                  ❌                   |    ❌    |                 ❌                 |  ❌  |              —              |
| `/roi`                                            |                  ❌                   |    ❌    |                 ❌                 |  ❌  | (ROI compute testé unit OK) |

Cite :

- `tests/e2e/flows/public-pages-smoke.spec.ts:6-24` (16 URLs)
- `tests/e2e/a11y.spec.ts:22-28` (5 paths)
- `tests/e2e/flows/seo-jsonld.spec.ts:28-75` (4 patterns)

### 3. E2E flows business

| Flow                             | Spec                         |               Couvre                | Real DB | Gap                                                                                                                                                         |
| -------------------------------- | ---------------------------- | :---------------------------------: | :-----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Booking `/reserver`              | aucun                        |                 ❌                  |   ❌    | P0-T1                                                                                                                                                       |
| Contact submit                   | `contact-submission.spec.ts` |               partiel               |   ❌    | `test.skip(true)` L34 permanent → faux vert                                                                                                                 |
| Newsletter signup                | aucun                        |                 ❌                  |   ❌    | P1                                                                                                                                                          |
| Désabonnement `/api/unsubscribe` | aucun                        |                 ❌                  |   ❌    | P1                                                                                                                                                          |
| GDPR export `/api/gdpr-export`   | aucun                        |                 ❌                  |   ❌    | P1 RGPD                                                                                                                                                     |
| Admin login                      | `admin-auth.spec.ts`         |    ✅ form + invalid + redirect     |   ❌    | manque dashboard auth + 2FA setup + JWT revocation                                                                                                          |
| Search `/recherche`              | aucun                        |                 ❌                  |   ❌    | P2                                                                                                                                                          |
| Language switch                  | `language-switch.spec.ts`    |             ✅ hreflang             |   n/a   | OK                                                                                                                                                          |
| SEO endpoints                    | `i18n.spec.ts:52-75`         | sitemap.xml + robots.txt + llms.txt |   n/a   | structure non validée                                                                                                                                       |
| Security headers                 | `security-headers.spec.ts`   |  ✅ XFO+XCTO+RP+PP+HSTS+COOP+CORP   |   n/a   | CSP : `if (NODE_ENV === "production")` mais run en `NODE_ENV !== "production"` toujours → branche prod jamais testée localement ; CSP nonce **non vérifié** |

### 4. Mocks utilisés

- **MSW** : 0 fichier (`grep msw|setupServer → No files found`).
- **`vi.mock`** : 0 occurrence dans `src/` (`grep vi\.mock|vi\.fn → seul HouseCalendar.test.tsx, et c'est un onConfirm callback`).
- **Prisma mock** : aucun (`@prisma/client` jamais importé dans un `.test.*`).
- **Auth mock** : aucun (`next-auth`/`auth()` jamais mocké).
- **Turnstile** : `tests/e2e/flows/public-pages-smoke.spec.ts:37` filtre les console errors `turnstile` — pas mocké, juste ignoré.

Conséquence : tous les tests sont soit pure-function (schemas Zod, utils, compute ROI, press content) soit DOM-only (Testing Library, Axe), soit boîte noire HTTP (Playwright sur dev server).

### 5. Real DB requis ?

- `vitest.integration.config.ts:6-14` : déclare le périmètre `tests/integration/**`. Aucune validation que `DATABASE_URL` pointe vers une DB de test (≠ dev). Le master § 0.5bis exige cette vérification — pas câblée dans le code.
- `tests/integration/server-actions.test.ts` : ne touche pas la DB (cf. P0-T2). Donc en pratique **0 test requiert real DB**.
- `tests/e2e/flows/admin-auth.spec.ts:1-2` commentaire : « Necessite : pnpm db:seed prealable + dev server lance ». Si DB pas seedée → tests passent quand même (juste 401/redirect). Pas de gate.

### 6. Snapshots Vitest

- 0 fichier `.snap` sous `src/` ni `tests/` (`Glob **/*.snap → tous matches sont sous node_modules/`).
- 0 `toMatchSnapshot()` / `toMatchInlineSnapshot()` dans le code utilisateur (`grep → No files found`).
- `src/components/marketing/JsonLd.test.tsx:11-23` vérifie le contenu JSON-LD via `script?.innerHTML.toContain(...)` — pas de snapshot structuré. Donc régressions silencieuses possibles sur la forme JSON-LD (`@context`, ordre des clés, `@graph` wrapper).

### 7. Flakiness control

- `playwright.config.ts:11` : `retries: isCI ? 2 : 0` ✅
- `playwright.config.ts:9` : `fullyParallel: true` ✅
- `playwright.config.ts:17-18` : `screenshot: "only-on-failure"`, `video: "retain-on-failure"` ✅
- `playwright.config.ts:16` : `trace: "on-first-retry"` ✅
- `playwright.config.ts:7-8` : timeout 30s, expect 5s — raisonnable
- `playwright.config.ts:10` : `forbidOnly: isCI` ✅ (pas de `test.only` orphelin en CI)
- Anti-pattern : **2 `test.skip(true, …)` permanents** = faux verts. Pas un flakiness mais un masquage.
- Aucune retry strategy sur Vitest unit (pas nécessaire, mais à noter pour HouseCalendar qui fait des `setDate(new Date())` susceptibles de drift midi-minuit en CI UTC).

### 8. Cross-browser

- `playwright.config.ts:20-26` : 5 projects (chromium, webkit, firefox, mobile-chrome Pixel 7, mobile-safari iPhone 14 Pro).
- `ci.yml:96` installe **chromium webkit firefox** (3 desktops).
- `ci.yml:98` lance `pnpm test:e2e` → exécute **les 5 projects = ~× 5 temps** (32 specs × 5 = 160 runs hors a11y).
- **Master § 0.5 dit « chromium uniquement »** → contradiction avec la CI actuelle. Solution : `package.json` ajouter `test:e2e:ci` = `playwright test --project=chromium` ou param env.

### 9. Lighthouse CI

- `lighthouserc.json:4-21` : 16 URLs (FR + EN paires).
- Budgets très stricts : perf 0.95, a11y 0.95, BP 0.95, SEO 1.0, LCP 1800ms, INP 80ms, CLS 0.05, TBT 150ms, FCP 1500ms, SI 2500ms.
- `ci.yml:99-101` : lancé, **mais `continue-on-error: true`** → ne bloque pas le merge.
- `lighthouserc.json:22` : `startServerCommand: "pnpm start"` + `numberOfRuns: 3` (bonne pratique anti-flakiness).
- Manquent dans LHCI : `/reserver`, `/comparaisons`, `/methodologie`, `/presse`, `/implantations/.../paris` — donc les 5 pages les plus stratégiques business hors flux principal n'ont **aucun budget perf**.

### 10. Security headers spec — couverture CSP/HSTS

`tests/e2e/flows/security-headers.spec.ts:8-44` couvre :

- XFO=DENY, XCTO=nosniff, RP=strict-origin-when-cross-origin, PP camera+microphone, HSTS max-age + includeSubDomains + preload, COOP=same-origin, CORP=same-origin, x-powered-by absent — ✅
- CSP : **seulement si `NODE_ENV === "production"`** (L28). En dev local ou CI sans prod build → branche skipped, fallback sur re-vérification XFO. Donc en pratique **CSP jamais testé E2E** sauf en prod live (Phase 4 master). Conséquence : régression CSP nonce (Sprint 24 fix `2a07f06`) non couverte par filet auto.
- Admin route : XFO + RP testés (L38-44) ✅ mais pas la CSP admin spécifique.

### 11. Axe a11y — règles et exceptions

`tests/e2e/a11y.spec.ts:37-39` : tags `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice`. Bon set RGAA 4.1 + WCAG 2.2 AA.

- Threshold L41-52 : **0 violation `serious|critical`** (les `minor|moderate` loggées en console mais non-bloquantes — décision raisonnable V1).
- Pas d'exception whitelist (`disableRules([...])`). Donc tout violation `serious` sur les 5 pages = fail. Strict, bien.
- Manque WCAG 2.5.8 (tap targets ≥ 24×24) explicitement — Axe le couvre via `target-size` mais classé `best-practice`, pas `wcag22aa` dans certaines versions → vérifier qu'Axe version utilisée (`@axe-core/playwright` dans `package.json`) inclut bien cette règle au niveau `wcag22aa`.

### 12. Visual regression

- **Aucun**. Pas de `toHaveScreenshot`, pas de Percy/Chromatic/Argos.
- Risk doctrine : régression silencieuse cap hero 88px (ADR 0007), hero-schema 576×576 (Sprint 14.7quater), terracotta Header, typo modular scale v3.2. Détecté seulement par review humaine.
- Coût d'ajout : `toHaveScreenshot()` natif Playwright sur 5 routes Top × 2 locales × 2 viewports = ~20 baselines. Gratuit. Recommandé Sprint correctif T+1.

---

## Citations

- `playwright.config.ts:1-37` — projects, retries, screenshot/trace policy.
- `vitest.config.ts:1-39` — include/exclude, coverage thresholds inopérants.
- `vitest.integration.config.ts:1-14` — déclaration intégration.
- `tests/integration/server-actions.test.ts:1-166` — fichier qui ment sur son contrat.
- `tests/e2e/a11y.spec.ts:22-28` — 5 paths, TODO Sprint 17 ouvert.
- `tests/e2e/smoke.spec.ts:1-12` — minimaliste, console-error only.
- `tests/e2e/i18n.spec.ts:52-75` — sitemap/robots/llms validation textuelle.
- `tests/e2e/flows/contact-submission.spec.ts:34` — `test.skip(true, …)`.
- `tests/e2e/flows/seo-jsonld.spec.ts:64` — `test.skip(true, …)` cassé.
- `tests/e2e/flows/admin-auth.spec.ts:1-42` — login form only, pas de dashboard authed.
- `tests/e2e/flows/security-headers.spec.ts:8-44` — couverture OWASP + branche CSP prod-only.
- `tests/e2e/flows/public-pages-smoke.spec.ts:6-24` — 8 paths × 2 locales = 16 URLs.
- `lighthouserc.json:4-46` — 16 URLs, budgets, 3 runs.
- `.github/workflows/ci.yml:44-110` — Vitest sans coverage, Playwright 3 desktops, LHCI continue-on-error.
- `.github/workflows/nightly.yml:26-44` — TOUS les steps stratégiques `if: false` (Playwright vs staging, OWASP ZAP, mail-tester, backup drill, LHCI history).
- `vitest.setup.ts:1-5` — confirme : pas de jest-axe matcher, a11y déléguée à Playwright.
- `package.json` scripts : `test`, `test:integration`, `test:e2e`, `test:e2e:cross-browser`, `lhci`, `lhci:autorun`, `a11y:audit`.
- Counts : `find src/lib -type f *.ts -not test → 26 ; *.test.ts → 2` ; `src/components → 102 / 13` ; `src/features → 19 / 0` ; `src/app/**/page.tsx → 112` ; `src/app/**/route.ts → 16`.
- `Glob **/*.snap → 0 résultat sous src/ ni tests/` (uniquement node_modules).
- `grep msw|setupServer dans tout le repo → No files found`.
- `grep vi\.mock dans src/ → 1 seul fichier (HouseCalendar.test.tsx, et c'est un vi.fn callback)`.

---

## [INCONNU]

- **Coverage % réelle par dossier** : `[NON MESURÉ — pnpm test --coverage non lancé sur cette session ; Phase 0 ne l'a pas relancé pour gain de temps]`. À mesurer en Sprint correctif (le master prompt § 0.5 ne l'exige pas, l'agent prompt non plus).
- **Temps réel d'exécution `pnpm test:e2e`** : `[NON MESURÉ — Phase 0 a explicitement skip Playwright (requires server + interdiction § 0.5)]`. Estimation théorique : 32 spec × ~10s × 5 projects = ~25 min en serial, ~6 min en `fullyParallel` 4 workers.
- **Flakiness historique** : `[INCONNU — sans accès aux runs CI GitHub Actions historiques sur cette session, je ne peux pas mesurer le taux de re-run]`. À demander à Will (`gh run list --workflow=ci.yml --json conclusion,attempt`).
- **Axe `target-size` règle** : `[NON VÉRIFIÉ — @axe-core/playwright version dans pnpm-lock.yaml non inspectée]`. À confirmer.
- **Comportement réel `gate-c-docker`** : `[NON VÉRIFIÉ — continue-on-error: true sur ci.yml:130 → on ignore les résultats récents, mais aucun log de run en main]`.

---

## Recommandations (≤ 10, effort × impact)

1. **(P0, 2j dev) Écrire `tests/e2e/flows/booking-submit.spec.ts`** : ouvrir `/reserver`, choisir slot, remplir form, soumettre, vérifier confirmation + (mock-friendly) lecture `/admin/.../bookings` que la row est en `option`. Couvre P0-T1 et déverrouille le filet régression du flow business principal.
2. **(P0, 1j dev) Faire `tests/integration/server-actions.test.ts` faire vraiment de l'intégration** : créer DB `axion_ia_test`, hook `beforeAll → prisma.$executeRaw TRUNCATE`, appeler les actions réelles (`submitContact`, `submitBookingOption`, `submitNewsletter`, `requestGdprExport`). Couvre P0-T2 + bouche le trou Phase 4 nightly.
3. **(P1, 0.5j) Activer coverage** : changer `package.json` `test` en `vitest run --coverage` ou ajouter `test:coverage` + step CI dédié. Faire échouer si sous 50 %. Couvre P1-T1.
4. **(P1, 0.5j) Retirer les 2 `test.skip(true, ...)` permanents** (`contact-submission.spec.ts:34`, `seo-jsonld.spec.ts:64`) : soit fixer le selector, soit retirer le test. Couvre P1-T2 + P1-T3.
5. **(P1, 1j) Tests unit sur `src/features/admin-*/actions.ts`** : au minimum 1 spec par feature (14 fichiers), mock Prisma via `vi.mock("@/lib/prisma")`. Couvre P1-T4 (0 → 14 specs).
6. **(P1, 0.5j) Étendre `public-pages-smoke` et `lighthouserc.json`** au Top 15 réel : ajouter `/comparaisons`, `/methodologie`, `/presse`, `/centre-aide`, `/faq`, `/glossaire`, `/stack-ia`, `/implantations/ile-de-france/paris`, `/roi`. Couvre P1-T5.
7. **(P1, 0.5j) Activer LHCI hard fail** : retirer `continue-on-error: true` (`ci.yml:101`). Pré-requis : un fail localisé peut être whitelisté via `lighthouserc.json` `matchingUrlPattern` pour `/reserver` (cap INP relaxée). Couvre P1-T7.
8. **(P1, 0.5j) Restreindre CI Playwright à chromium** : `package.json` ajouter `"test:e2e:ci": "playwright test --project=chromium"` et `ci.yml:98` → `pnpm test:e2e:ci`. Couvre P2-T3 + aligne avec master § 0.5.
9. **(P2, 0.5j) Visual regression baseline** : `toHaveScreenshot('home-hero')` sur 5 routes Top × 2 viewports (mobile 390 + desktop 1280). Maintien manuel post-redesign accepté Sprint correctif. Couvre P2-T1.
10. **(P2, 0.5j) Étendre `a11y.spec.ts` aux 15 pages** + ajouter règle `target-size` explicite via `.withRules(['target-size'])`. Couvre P2-T2 + dette WCAG 2.5.8.

**Total effort recommandations P0+P1** : ~5 jours dev. Verrouille en Sprint correctif immédiat (≤ 1 semaine cf. master § 8.1).

---

## STOP & ASK consolidés (questions ouvertes pour Will)

- **Q-T1** — Souhaites-tu une **DB de test dédiée** (`axion_ia_test` Postgres local) montée par Docker compose pour les tests intégration, ou un schema `_test` namespacé dans la DB dev ? La première option est plus propre RGPD/isolation, la seconde plus simple.
- **Q-T2** — Le **mock Turnstile** en E2E est-il acceptable (header `cf-turnstile-response: dev-bypass-token`) ou veux-tu un vrai widget mock CF côté serveur action ?
- **Q-T3** — Pour la **régression visuelle** : on reste sur `toHaveScreenshot` Playwright natif (baselines committed, diff inline en PR) ou tu préfères un service externe (Percy gratuit < 5k snapshots/mois) ?
- **Q-T4** — Le **nightly Gate D** (`nightly.yml`) a 5 stubs `if: false`. Quelle priorité Sprint 25+ : OWASP ZAP > backup drill > mail-tester > LHCI history > Playwright staging ? Mon vote : backup drill > OWASP ZAP > mail-tester (RTO/RPO + sécu > comms).
- **Q-T5** — Doit-on **bloquer le merge** sur LHCI fail (retirer `continue-on-error`) **maintenant**, ou attendre que les 15 URLs Top soient toutes vertes ? Si maintenant : risque blocker temporaire le temps de fixer `/reserver` INP. Mon vote : maintenant + whitelist `/reserver` via `matchingUrlPattern`.

---

_Fin AGT-13 — TESTS. Score 58/100, confiance haute. Audit-only. Aucun fichier modifié hors `_AUDIT/E2E-2026-05-09/02-AGENTS/AGT-13-TESTS.md`._
