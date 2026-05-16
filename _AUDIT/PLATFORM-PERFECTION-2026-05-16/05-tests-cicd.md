# 05 — Tests & CI/CD (Agent 1.E)

> Audit AUDIT-ONLY · Phase 1 Architecture & santé code · Working dir
> `axionia/` · HEAD figé prompt = `98e0b0f` · HEAD réel session = `4cdfbe4`
> (8 commits image-bank Sprints 1→7 livrés entre `98e0b0f` et `4cdfbe4`).
> Mode : aucun edit code, lecture seule + analyse statique des fichiers
> `vitest.config.ts`, `playwright.config.ts`, `lighthouserc.json`,
> `.github/workflows/*.yml`, `.husky/*`. Coverage Vitest non exécutée
> (interdit : tourne dans le sandbox des autres agents, sortie ~5 min,
> conflit possible avec d'autres jobs en cours).

---

## 0. Reality check tests & CI

| Item                                   | Valeur observée                                                                                                                            | Source                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Test files Vitest (src/)               | **83**                                                                                                                                     | `find src **/*.{test,spec}.{ts,tsx}`                                 |
| Test files Vitest (tests/)             | **4** (3 schemas + 1 integration)                                                                                                          | `tests/{unit,schemas,integration}/**`                                |
| Test files Playwright E2E              | **17** specs                                                                                                                               | `tests/e2e/**`                                                       |
| Test files content-gen smoke           | **1**                                                                                                                                      | `tests/content-gen/admin-smoke.spec.ts`                              |
| Test files image-bank                  | **0** réels                                                                                                                                | `tests/image-bank/{unit,integration,e2e}/` **3 dirs vides**          |
| Tests skip `it.skip`/`test.skip` (src) | **2** (1 fichier)                                                                                                                          | `src/server/content-gen/providers/__tests__/circuit-breaker.spec.ts` |
| Tests skip (tests/integration)         | **1** describe.skip                                                                                                                        | conditionnel `DB_TEST_URL`                                           |
| Tests skip (Playwright E2E)            | **15** dans 8 fichiers                                                                                                                     | majoritairement conditionnels env/seed                               |
| Workflows GitHub Actions               | **7** : `ci.yml`, `staging.yml`, `nightly.yml`, `release.yml`, `deploy-coolify.yml`, `disk-cleanup-prod.yml`, `gsc-crawl-stats-weekly.yml` | `.github/workflows/*.yml`                                            |
| Husky hooks                            | **3** : `pre-commit`, `commit-msg`, `pre-push`                                                                                             | `.husky/`                                                            |
| Vitest coverage thresholds             | **60/55/60/60** (statements/branches/functions/lines)                                                                                      | `vitest.config.ts:37-42`                                             |
| LHCI URLs locales (lhci autorun)       | **18 URLs × 2 presets** (desktop+mobile)                                                                                                   | `lighthouserc.json`                                                  |
| LHCI URLs prod post-deploy gate        | **5 URLs** (`/fr`, `/fr/interventions`, `/fr/audit`, `/fr/reserver`, `/fr/implantations/ile-de-france/paris`)                              | `deploy-coolify.yml:380-385`                                         |

### Modif uncommit `.github/workflows/deploy-coolify.yml`

Diff observée vs HEAD : ajout de 5 globs `paths-ignore` (tests fixtures
`tests/**/fixtures/**`, `tests/**/snapshots/**`, `tests/**/__snapshots__/**`,
`.claude/**`, `**/*.stories.{ts,tsx}`).

**Verdict** : changement cohérent + sain. Évite des deploys 25min+28min
inutiles sur commits qui ne touchent que des fixtures dev-time. Aucun
risque sécurité ni perf (le workflow déclenche toujours sur push code
prod). À commiter.

---

## 1. Coverage Vitest — analyse statique (non exécutée)

### Configuration

```ts
// vitest.config.ts:24-43
coverage: {
  provider: "v8",
  reporter: ["text", "html", "lcov"],
  include: ["src/**/*.{ts,tsx}"],
  exclude: [
    "src/**/*.{test,spec}.{ts,tsx}",
    "src/**/*.d.ts",
    "src/instrumentation*.ts",
    "src/sentry.*.config.ts",
    "src/env.ts",
  ],
  thresholds: { statements: 60, branches: 55, functions: 60, lines: 60 },
},
```

### Estimation coverage par dossier critique

Méthodologie : ratio (fichiers test) / (fichiers source) par dossier
sur HEAD. Estimation grossière (1 test ≠ 1 unité bien couverte) mais
donne une bonne approximation comparative.

| Dossier                                       | Fichiers source | Test files | Ratio | Estim. coverage | Verdict                                           |
| --------------------------------------------- | --------------- | ---------- | ----- | --------------- | ------------------------------------------------- |
| `src/lib/` (utils transverses)                | ~80             | 22         | 27 %  | **~70-80 %**    | Bon                                               |
| `src/lib/knowledge/` (KB v4)                  | ~25             | 16         | 64 %  | **~85 %**       | Excellent                                         |
| `src/features/booking/`                       | ~30             | 5          | 17 %  | **~60-70 %**    | Limite mais OK                                    |
| `src/components/` (UI)                        | ~150+           | 13         | 9 %   | **~30-40 %**    | Bas (mais c'est ok pour des composants stateless) |
| `src/server/content-gen/`                     | ~100            | 17         | 17 %  | **~50-65 %**    | Limite — risque sous seuil 60                     |
| `src/server/queue/workers/`                   | ~25             | 1          | 4 %   | **~15-25 %**    | **BAS** — workers sont critiques business         |
| `src/server/image-bank/` (Sprint 1-7 récents) | ~25             | 0          | 0 %   | **~0 %**        | **CRITIQUE — 0 test**                             |
| `src/server/actions/`                         | ~40             | 1          | 2.5 % | **~10-15 %**    | Bas                                               |
| `src/proxy.ts` / middleware                   | 1               | 0          | 0 %   | **0 %**         | Bas (couvert E2E partiellement)                   |

**Verdict global** : avec seuils 60/55/60/60 sur **tout `src/**/\*`**,
la prod actuelle est probablement **JUSTE au seuil ou en-dessous**.
Les Sprints image-bank 1-7 livrés sans tests vont **faire chuter le
ratio**. Sans exécution réelle on ne peut conclure, mais c'est un
**P0 risque** : la prochaine PR qui touche `src/server/image-bank/`fera tomber les seuils gate-a et bloquera tout`main`.

### Risque concret

```yaml
# ci.yml:51-52
- name: Vitest (with coverage)
  run: pnpm test:coverage
```

Si la coverage est aujourd'hui à 60.2 % et qu'un commit ajoute 200
lignes non testées dans `src/server/image-bank/`, le total tombe à
59.x % → **gate-a échoue** → tous les commits suivants bloqués jusqu'à
l'ajout de tests rétroactif (effort 4-8h selon scope).

---

## 2. Top 10 tests skipped

| #     | Fichier                                                              | Ligne               | Type            | Justification                                                             | Sévérité                                                                |
| ----- | -------------------------------------------------------------------- | ------------------- | --------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1     | `src/server/content-gen/providers/__tests__/circuit-breaker.spec.ts` | 27                  | `it.skip`       | "opens circuit after 5 failures in 30s window" — **pas de justif inline** | **P1**                                                                  |
| 2     | `src/server/content-gen/providers/__tests__/circuit-breaker.spec.ts` | 31                  | `it.skip`       | "transitions to half-open after 60s + closes on success" — pas de justif  | **P1**                                                                  |
| 3     | `tests/integration/server-actions.test.ts`                           | 181                 | `describe.skip` | conditionnel `DB_TEST_URL` (env absente CI)                               | P2 (intentionnel)                                                       |
| 4     | `tests/e2e/flows/admin-booking-flow.spec.ts`                         | 23,45,69,89,107,138 | 8× `test.skip`  | "AdminUser pas seedé dans la DB locale — skip"                            | **P1** (jamais green CI)                                                |
| 5     | `tests/e2e/flows/admin-booking-flow.spec.ts`                         | 84                  | `test.skip`     | "Liste réservations vide ET pas de message"                               | P2                                                                      |
| 6     | `tests/e2e/content-gen/blog-article.spec.ts`                         | 19                  | `test.skip`     | "E2E_BLOG_SLUG non défini — squelette Sprint S6.3"                        | **P1** (Sprint passé)                                                   |
| 7     | `tests/e2e/content-gen/coverage-campaign.spec.ts`                    | 29                  | `test.skip`     | "squelette Sprint S6.3"                                                   | **P1**                                                                  |
| 8     | `tests/e2e/content-gen/news-rss.spec.ts`                             | 17                  | `test.skip`     | "E2E_NEWS_SLUG non défini — squelette Sprint S6.3"                        | **P1**                                                                  |
| 9     | `tests/e2e/content-gen/quality-loop.spec.ts`                         | 14                  | `test.skip`     | "E2E_FAQ_SLUG non défini — squelette Sprint S6.3"                         | **P1**                                                                  |
| 10    | `tests/e2e/flows/booking-submit.spec.ts`                             | 41                  | `test.skip`     | "Aucun slot calendrier visible — flow non testable"                       | **P0** (le flow booking est business-critical et n'est pas testé E2E !) |
| Bonus | `tests/e2e/flows/contact-submission.spec.ts`                         | 34                  | `test.skip`     | "Formulaire contact pas encore branché en UI"                             | **P0** (état obsolète, le contact form **EST** branché en prod)         |
| Bonus | `tests/e2e/flows/seo-jsonld.spec.ts`                                 | 64                  | `test.skip`     | "Aucun article blog publié"                                               | P1 (Sprint S6.3 → blog publié)                                          |

**Bilan tests skip** : **17 skips totaux**, dont **10 P0/P1** :

- 4 squelettes content-gen Sprint S6.3 (devraient être implémentés depuis 2026-05-15)
- 8 admin-booking-flow skipped en boucle car seed DB locale manquant
- Skip booking-submit + contact-submission = **trous critiques** sur 2 flows business

---

## 3. E2E Playwright — golden paths

### Inventaire 17 specs

| Spec                                    | Couvre golden path ?           | État réel                                                 |
| --------------------------------------- | ------------------------------ | --------------------------------------------------------- |
| `smoke.spec.ts`                         | Home FR sans erreur console    | ✅ Actif                                                  |
| `i18n.spec.ts`                          | i18n FR↔EN                     | ⚠️ EN désactivé 2026-05-16 → tests potentiellement broken |
| `a11y.spec.ts`                          | A11y axe-core                  | À vérifier                                                |
| `flows/admin-auth.spec.ts`              | Admin login + 404 wrong prefix | ✅ Actif (4 tests)                                        |
| `flows/admin-routes.spec.ts`            | Admin routes accessibles       | À vérifier                                                |
| `flows/admin-booking-flow.spec.ts`      | Admin booking CRUD             | **❌ 8/9 skipped** (seed manquant)                        |
| `flows/booking-submit.spec.ts`          | **Booking submit (CRITICAL)**  | **❌ test core skipped** ("aucun slot")                   |
| `flows/contact-submission.spec.ts`      | Contact form submit            | **❌ skipped** ("pas branché en UI" — obsolète)           |
| `flows/language-switch.spec.ts`         | Locale switcher                | ⚠️ EN désactivé impact                                    |
| `flows/public-pages-smoke.spec.ts`      | Smoke pages publiques          | ✅ Actif                                                  |
| `flows/security-headers.spec.ts`        | CSP/HSTS/headers               | ✅ Actif                                                  |
| `flows/seo-jsonld.spec.ts`              | JSON-LD validation             | ⚠️ 1 skip blog (obsolète)                                 |
| `content-gen/blog-article.spec.ts`      | Blog article rendering         | **❌ skipped** (env var absente)                          |
| `content-gen/coverage-campaign.spec.ts` | Coverage campaign              | **❌ skipped**                                            |
| `content-gen/landing-ville.spec.ts`     | Landing ville                  | À vérifier                                                |
| `content-gen/news-rss.spec.ts`          | News RSS                       | **❌ skipped**                                            |
| `content-gen/quality-loop.spec.ts`      | Quality FAQ loop               | **❌ skipped**                                            |

### Matrice golden paths × couverture

| Golden path business     | Couvert E2E ?                       | Confiance |
| ------------------------ | ----------------------------------- | --------- |
| Homepage rendering       | ✅ smoke.spec.ts                    | Haute     |
| Booking submit (B2B clé) | **❌ skipped**                      | **Nulle** |
| Admin login + 2FA        | ✅ admin-auth (partiel, pas de 2FA) | Moyenne   |
| Admin booking CRUD       | ❌ 8/9 skipped                      | Nulle     |
| Contact form             | ❌ skipped                          | Nulle     |
| Blog/news/coverage       | ❌ 4 specs skipped                  | Nulle     |
| Locale switch FR/EN      | ⚠️ EN désactivé impacte             | Faible    |
| JSON-LD validation       | ✅ partiel                          | Moyenne   |
| Security headers         | ✅                                  | Haute     |
| Image-bank galerie       | **❌ 0 test**                       | Nulle     |

**Verdict E2E** : ratio **golden paths réellement testés = 4/10**.
Insuffisant pour une plateforme à 10 jours d'un audit perfection
/2750.

---

## 4. Matrice workflows × gates

### Workflows actifs

| Workflow                     | Trigger                   | Jobs                                                                                                        | Hard fail ?                          |
| ---------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `ci.yml`                     | PR + push main/staging    | gate-a, gate-b, gate-c-docker, gate-d-migration                                                             | **Mixed** (gate-c continue-on-error) |
| `staging.yml`                | push main                 | deploy-staging                                                                                              | Soft (stubs Sprint 21/22)            |
| `nightly.yml`                | cron 03:00 UTC + dispatch | playwright-staging, pnpm-audit, zap-baseline, mail-tester, backup-drill, lighthouse-history, notify-failure | Hard fail (sauf mail-tester opt-in)  |
| `release.yml`                | push tag v\*              | release                                                                                                     | Hard fail                            |
| `deploy-coolify.yml`         | push main + dispatch      | build, deploy, lhci                                                                                         | Hard fail                            |
| `disk-cleanup-prod.yml`      | cron 02:00 UTC            | cleanup                                                                                                     | Hard fail (telegram alert)           |
| `gsc-crawl-stats-weekly.yml` | cron lun 08:00 UTC        | export                                                                                                      | Soft (fail-warn)                     |

### Gates × workflows × triggers

| Gate                           | PR                          | push main                               | nightly             | release          | manual | Block deploy ?                           |
| ------------------------------ | --------------------------- | --------------------------------------- | ------------------- | ---------------- | ------ | ---------------------------------------- |
| typecheck                      | ✅ gate-a                   | ✅ gate-a                               | —                   | ✅ release.build | —      | **Oui** (PR)                             |
| eslint                         | ✅ gate-a                   | ✅ gate-a                               | —                   | —                | —      | **Oui**                                  |
| prettier                       | ✅ gate-a                   | ✅ gate-a                               | —                   | —                | —      | **Oui**                                  |
| Vitest run                     | ✅ gate-a (+ coverage)      | ✅ gate-a                               | —                   | —                | —      | **Oui**                                  |
| Vitest coverage thresholds     | ✅ gate-a (auto via config) | ✅                                      | —                   | —                | —      | **Oui**                                  |
| i18n parity                    | ✅ gate-a                   | ✅                                      | —                   | —                | —      | Oui                                      |
| anti-siren                     | ✅                          | ✅                                      | —                   | —                | —      | Oui                                      |
| anti-hex                       | ✅                          | ✅                                      | —                   | —                | —      | Oui                                      |
| use-client justified           | ✅                          | ✅                                      | —                   | —                | —      | Oui                                      |
| content-gen isolation          | ✅                          | ✅                                      | —                   | —                | —      | Oui                                      |
| Zod schemas have tests         | ✅                          | ✅                                      | —                   | —                | —      | Oui                                      |
| gitleaks (action v2)           | ✅                          | ✅                                      | —                   | —                | —      | Oui                                      |
| pnpm build                     | ✅ gate-b (PR seulement)    | ⚠️ via deploy-coolify build             | —                   | ✅ smoke         | —      | **PR oui, push main = via build Docker** |
| Bundle size-limit              | ✅ gate-b                   | —                                       | —                   | —                | —      | **Oui PR seulement**                     |
| Bundle delta vs main           | ✅ gate-b                   | —                                       | —                   | —                | —      | **Oui PR seulement**                     |
| Playwright suite               | ✅ gate-b                   | —                                       | ✅ chromium prod    | —                | —      | **Oui PR**, soft push main               |
| LHCI autorun (local 18 URLs)   | ✅ gate-b                   | —                                       | ✅ history (soft)   | —                | —      | **continue-on-error** (`ci.yml:123`) ⚠️  |
| LHCI prod gate (5 URLs)        | —                           | ✅ post-deploy `lhci` job               | —                   | —                | —      | **Hard fail** ✅                         |
| Docker smoke (gate-c)          | ✅                          | ✅                                      | —                   | —                | —      | **continue-on-error: true** ⚠️           |
| Prisma migrate deploy (gate-d) | ✅                          | ✅                                      | —                   | —                | —      | Hard fail                                |
| OWASP ZAP baseline             | —                           | —                                       | ✅ (toggle var)     | —                | —      | Hard fail                                |
| pnpm audit CVE high/crit       | —                           | —                                       | ✅ + pre-push hook  | —                | —      | Hard fail                                |
| Backup restore drill           | —                           | —                                       | ✅ (R2 + GPG)       | —                | —      | Hard fail                                |
| Mail-tester score              | —                           | —                                       | ✅ opt-in           | —                | —      | Soft (opt-in)                            |
| Telegram notif on fail         | —                           | —                                       | ✅                  | ✅               | —      | —                                        |
| Cloudflare cache purge         | —                           | ✅ post-deploy                          | —                   | —                | —      | Soft (warn)                              |
| Disk cleanup prod              | —                           | —                                       | ✅ daily 02:00      | —                | ✅     | Hard fail si > 85%                       |
| GSC crawl stats export         | —                           | —                                       | ✅ weekly mon 08:00 | —                | ✅     | Soft                                     |
| Container HEALTHCHECK          | —                           | ✅ via Dockerfile + Coolify             | —                   | —                | —      | Hard fail                                |
| Smoke prod /api/healthz        | —                           | ✅ post-deploy (LHCI implicit + gate-c) | —                   | —                | —      | Indirect via LHCI                        |
| Smoke 10 routes critiques      | —                           | **❌ ABSENT**                           | —                   | —                | —      | **Aucun**                                |

### Trous identifiés (P0/P1)

1. **P0 — Smoke prod 10 routes critiques absent** : aucun workflow ne
   ping post-deploy 10 routes business (`/fr`, `/fr/audit`,
   `/fr/reserver`, `/fr/interventions`, `/fr/contact`, `/fr/blog`,
   `/sitemap.xml`, `/robots.txt`, `/api/healthz`, `/fr/galerie`).
   LHCI couvre 5 URLs mais en mode Lighthouse (~3 min/URL, mesure
   Web Vitals, **PAS un smoke 200/404**).

2. **P0 — `gate-c-docker` en `continue-on-error: true`** : la smoke
   Docker boot + `/api/healthz` n'est pas un gate bloquant. Si le
   container ne boot pas en CI, la PR passe quand même.

3. **P0 — LHCI gate-b en `continue-on-error: true`** (`ci.yml:123`)
   sur les PR. Seul le LHCI prod post-deploy (`deploy-coolify.yml:339`)
   est hard fail. Donc une PR avec régression Web Vitals passe gate-b
   et n'est attrapée qu'après merge + deploy.

4. **P1 — Aucun job ne lance `pnpm zod:check` en gate-b** (déjà fait
   en gate-a, donc ok). Bien.

5. **P1 — Test integration `vitest.integration.config.ts` non câblé**
   en CI. Script `test:integration` existe (`package.json:46`) mais
   aucun workflow ne l'invoque.

6. **P1 — Workflow staging stub Sprint 22** : OWASP ZAP staging stubbé
   (`echo "ZAP baseline stub"`), smoke staging stubbé. Reste du Sprint
   21/22 jamais finalisé.

7. **P1 — Image-bank Sprints 1-7 livrés sans tests** : 0 fichier dans
   `tests/image-bank/{unit,integration,e2e}/` (3 dirs vides). Risque
   majeur coverage drop + 0 régression detection.

---

## 5. LHCI cohérence performance budget

### lighthouserc.json (autorun local)

```json
"assertions": {
  "categories:performance": [error, minScore 0.95],
  "categories:accessibility": [error, minScore 0.95],
  "categories:best-practices": [error, minScore 0.95],
  "categories:seo": [error, minScore 1.0],
  "largest-contentful-paint": [error, max 1800ms],
  "interaction-to-next-paint": [error, max 80ms],
  "cumulative-layout-shift": [error, max 0.05],
  "total-blocking-time": [error, max 150ms],
  "first-contentful-paint": [error, max 1500ms],
  "speed-index": [error, max 2500ms]
}
```

### Cross-check AGENTS.md performance budget

| Metric                         | AGENTS.md cible           | lighthouserc.json     | Cohérent ?                                                                      |
| ------------------------------ | ------------------------- | --------------------- | ------------------------------------------------------------------------------- |
| LCP p75                        | ≤ 1800 ms                 | error max 1800 ms     | ✅                                                                              |
| INP p75                        | ≤ 100 ms                  | **error max 80 ms**   | **⚠️ Plus strict que AGENTS.md**                                                |
| CLS                            | 0 (cible interne stricte) | error max 0.05        | ⚠️ Tolérance 0.05 vs 0 docté AGENTS.md                                          |
| TBT                            | ≤ 150 ms                  | error max 150 ms      | ✅                                                                              |
| First Load JS                  | ≤ 75 KB gz/route          | (size-limit séparé)   | ✅ (via size-limit shell 100 KB)                                                |
| Exception /reserver INP        | ≤ 150 ms                  | **❌ pas d'override** | **P1** : INP 80ms appliqué à /reserver alors qu'AGENTS.md exige 150ms exception |
| Exception /reserver First Load | ≤ 110 KB gz               | size-limit 110 KB ✅  | ✅                                                                              |

**Findings LHCI** :

- **P1** : INP 80 ms global ne respecte pas l'exception calendrier
  AGENTS.md à 150 ms pour `/reserver`. La gate post-deploy LHCI inclut
  `/fr/reserver` (`deploy-coolify.yml:383`) — un INP 90 ms réaliste
  pour le calendrier ferait fail le deploy alors que c'est dans le
  budget AGENTS.md.

- **P2** : CLS budget 0.05 plus permissif que la doctrine AGENTS.md
  (« CLS = 0 cible interne stricte »). Documenter explicitement quel
  est le binding contractuel.

- **P2** : 18 URLs autorun local **≠ 5 URLs gate prod**. Pas une
  régression, mais asymétrie : un fix appliqué pour passer 5/5 prod
  pourrait casser sur les 13 autres URLs locales si jamais on relance
  l'autorun local.

---

## 6. Husky pre-commit hooks

### .husky/pre-commit

```bash
pnpm exec lint-staged          # eslint --fix + prettier --write sur staged
pnpm anti-siren:check          # grep 0 SIREN figé
pnpm anti-hex:check            # grep 0 #hex couleurs en JSX
pnpm use-client:check          # vérifie justifications "use client"
pnpm typecheck                 # tsc --noEmit
if command -v gitleaks; then   # secret scan local (skip si binary absent)
  gitleaks protect --staged --redact --no-banner
fi
```

### .husky/commit-msg

```bash
pnpm exec commitlint --edit "$1"   # conventional commits
```

### .husky/pre-push

```bash
pnpm typecheck
pnpm i18n:check
pnpm zod:check
pnpm test                          # vitest run (PAS coverage — gain temps)
pnpm audit --prod --audit-level high   # bloque push si CVE high/crit
```

### Analyse

| Hook       | Couverture                                                            | Verdict   |
| ---------- | --------------------------------------------------------------------- | --------- |
| pre-commit | 6 checks rapides (lint-staged, anti-\* policies, typecheck, gitleaks) | ✅ Solide |
| commit-msg | commitlint conventional                                               | ✅        |
| pre-push   | typecheck + i18n + zod + tests + audit deps                           | ✅ Solide |

**Trous mineurs** :

- **P2** : `pnpm zod:check` PAS dans pre-commit (uniquement pre-push).
  Si un dev commit + push immédiat, OK. Si push différé, risque de
  push d'un commit qui pollue main.
- **P2** : `pnpm anti-siren:check` + `anti-hex:check` PAS dans pre-push
  (uniquement pre-commit). Inverse du précédent.
- **P3** : gitleaks fail-soft (skip si binary absent local). Le gate
  CI couvre, donc OK.
- **P3** : `pnpm test` pre-push sans coverage. Acceptable vitesse,
  mais le dev peut push code qui descend la couverture sous 60 → CI
  fail. Pas bloquant.

---

## 7. Anti-patterns & risques détectés

### A. continue-on-error masque les régressions

3 gates en mode soft alors qu'ils devraient être hard :

```yaml
# ci.yml:152
gate-c-docker:
  continue-on-error: true   # TODO documenté ligne 144 → env fixture manquante

# ci.yml:123
- name: Lighthouse CI
  run: pnpm lhci:autorun
  continue-on-error: true   # commenté "Sprint 14 enables hard fail"
```

→ Sprint 14 livré il y a longtemps, le TODO reste.

### B. Tests skip qui devraient être implémentés ou retirés

10 P0/P1 listés section 2. Ces skip sont des **dette technique
silencieuse** : la suite passe au vert mais ne couvre rien.

### C. Image-bank Sprints 1-7 livrés sans une seule ligne de test

Découverte critique :

```
tests/image-bank/e2e/         → vide (0 fichiers)
tests/image-bank/integration/ → vide (0 fichiers)
tests/image-bank/unit/        → vide (0 fichiers)
```

Sprint 7 récap docs mentionne « tests verts » mais aucun test image-bank
n'existe. Soit les tests sont mélangés dans `src/server/image-bank/`
(non observé), soit la promesse est non tenue.

### D. Stub workflow staging Sprint 21/22

`.github/workflows/staging.yml:32-34` :

```yaml
- name: Smoke tests vs staging
  run: echo "Smoke tests stub — Sprint 22 wires real Playwright suite."
- name: OWASP ZAP baseline
  run: echo "ZAP baseline stub — Sprint 21 wires real scan."
```

Le workflow staging est essentiellement un no-op trompeur. Échec
silencieux dans la promesse de gate staging.

### E. Trigger deploy paths-ignore pas exhaustif

`deploy-coolify.yml` ignore `**.md`, `docs/**`, `_AUDIT/**`,
`.gitignore`, + (uncommit) `tests/**/fixtures/**`, `.claude/**`,
stories. Mais **ne ignore pas** :

- `prisma/seed*.ts` (peut être dev seul, mais OK à déclencher build)
- `scripts/` (scripts dev qui ne sont pas runtime prod)
- `*.example` / `.env.example`

→ Pas critique, mais peut déclencher des deploys 25min pour rien.

---

## 8. Scoring /150

| Catégorie                                                | Pts max | Pts obtenus | Justification                                                                |
| -------------------------------------------------------- | ------- | ----------- | ---------------------------------------------------------------------------- |
| Coverage Vitest config + threshold                       | 15      | **11**      | Config propre, threshold 60% OK mais risqué avec image-bank 0 test           |
| Coverage réelle estimée par dossier                      | 20      | **11**      | Bon sur lib/knowledge, faible sur workers/image-bank/server/actions          |
| Tests E2E golden paths                                   | 25      | **9**       | 4/10 paths couverts, 10 skips critiques (booking-submit + contact)           |
| Tests integration                                        | 10      | **3**       | 1 seul fichier `tests/integration/`, conditionnel `DB_TEST_URL`, pas dans CI |
| Tests image-bank Sprints 1-7                             | 10      | **0**       | **3 dirs vides, 0 fichier**                                                  |
| Workflows CI structure                                   | 15      | **13**      | 7 workflows bien typés, concurrence, timeouts, Node 24 aligné prod           |
| Gates A (typecheck/lint/test/coverage/zod/i18n/gitleaks) | 15      | **14**      | Très complet, manque seulement test:integration                              |
| Gates B (build/playwright/size-limit/LHCI)               | 10      | **6**       | LHCI continue-on-error + gate-c continue-on-error                            |
| Gate D nightly (zap/audit/backup-drill/mail-tester)      | 10      | **8**       | Bien câblé, dépend de vars `NIGHTLY_*_ENABLED`                               |
| Pré-commit + pré-push hooks                              | 10      | **9**       | Solide, manque zod en pre-commit + anti-\* en pre-push                       |
| LHCI cohérence AGENTS.md budgets                         | 10      | **6**       | INP /reserver pas respecté (80ms global vs 150ms doctrine), CLS 0.05 vs 0    |

**Total : 90/150 = 60.0 %** 🟡

**Verdict** : **🟡 CONDITIONAL** — fondations CI/CD solides (Node 24,
7 workflows, gate-a très complet, hooks solides, LHCI prod hard fail),
mais **3 trous critiques** : image-bank 0 test, 10 E2E skips P0/P1,
LHCI + gate-c en continue-on-error masquent les régressions PR. Ne
satisfait pas un standard « perfection /2750 ».

---

## 9. P0 (blocking)

### P0-1 — Image-bank Sprints 1-7 : 0 test (10 services + 4 workers + 15 admin pages + 6 routes publiques sans coverage)

**Effort** : 12-16 h
**Action** : créer minimum

- `tests/image-bank/unit/services/*.test.ts` (1 fichier par service, ~10
  fichiers)
- `tests/image-bank/integration/import-pipeline.test.ts` (Sharp +
  EXIF/IPTC embed)
- `tests/image-bank/e2e/galerie-public.spec.ts` (sitemap, JSON-LD,
  variants WebP/AVIF)
- `tests/image-bank/unit/workers/{enrich,translate,import,sitemap}.test.ts`

**Impact si non fait** : la prochaine PR qui touche image-bank pète la
coverage threshold 60% → bloque main. Plus généralement, 0 régression
detection sur 8044 lignes ajoutées récemment.

### P0-2 — 4 squelettes E2E content-gen Sprint S6.3 toujours skipped

**Effort** : 4-6 h
**Action** : seed env vars `E2E_BLOG_SLUG`, `E2E_NEWS_SLUG`, `E2E_FAQ_SLUG`
dans CI (gate-b) OU implémenter les tests réellement (créer fixtures
DB seed pour blog/news/faq publiés).

**Fichiers concernés** :

- `tests/e2e/content-gen/blog-article.spec.ts:19`
- `tests/e2e/content-gen/news-rss.spec.ts:17`
- `tests/e2e/content-gen/quality-loop.spec.ts:14`
- `tests/e2e/content-gen/coverage-campaign.spec.ts:29`

**Impact si non fait** : les 4 flows content-gen majeurs livrés Sprint
2026-05-15 ne sont **jamais** testés E2E en CI. Risque régression
silencieuse haut.

### P0-3 — booking-submit + contact-submission E2E core skipped

**Fichiers** :

- `tests/e2e/flows/booking-submit.spec.ts:41` ("Aucun slot calendrier
  visible — flow non testable en l'état")
- `tests/e2e/flows/contact-submission.spec.ts:34` ("Formulaire contact
  pas encore branché en UI" — **état obsolète**, le form EST branché)

**Effort** : 3-4 h
**Action** : seed minimal slot calendrier + retire skip contact (commenter
le `test.skip` et valider que le test passe sur la prod actuelle).

**Impact** : les 2 flows de conversion core (booking + contact) ne sont
**pas testés E2E**. Régression possible non détectée. Critical business.

---

## 10. P1 (high)

### P1-1 — LHCI gate-b en `continue-on-error: true` (ci.yml:123)

Retirer le `continue-on-error`. Le LHCI prod (deploy-coolify) est déjà
hard fail post-deploy, autant attraper en PR aussi.
**Effort** : 5 min édition + validation 1-2 PR. **+5 pts scoring**.

### P1-2 — gate-c-docker en `continue-on-error: true` (ci.yml:152)

Fixer le TODO `_AUDIT/PROMPT-CI-FIXTURES.md` (créer `.env.smoke` avec
mocks complets) puis retirer continue-on-error.
**Effort** : 2-3 h. **+3 pts scoring**.

### P1-3 — admin-booking-flow E2E 8/9 skipped (seed DB manquant)

Soit (a) seed AdminUser automatique dans gate-b before-script, soit (b)
retirer ces tests skip et créer un seul test plus pertinent qui crée
l'admin in-situ via API. **Effort** : 2-3 h.

### P1-4 — INP /reserver LHCI 80ms vs AGENTS.md 150ms

Ajouter override path-matching dans `lighthouserc.json` pour `/reserver` :

```json
"assertMatrix": [
  { "matchingUrlPattern": ".*/reserver.*",
    "assertions": { "interaction-to-next-paint": ["error", { "maxNumericValue": 150 }] } }
]
```

**Effort** : 15 min. Évite faux negatives deploy.

### P1-5 — circuit-breaker.spec.ts 2 it.skip non justifiés

Implémenter les 2 tests (utilisent timer fake Vitest, ~30 min chacun)
ou documenter pourquoi skip.

### P1-6 — Staging workflow stub Sprint 21/22

Soit finaliser (Playwright + ZAP réels), soit supprimer le workflow
fantôme pour ne pas créer faux signal vert.

### P1-7 — `pnpm test:integration` jamais invoqué en CI

Câbler dans gate-a après vitest standard (ou gate-b si lent), avec
service Postgres comme gate-d.

### P1-8 — seo-jsonld blog skip obsolète

Sprint S6.3 a publié des articles blog. Le `test.skip(true, "Aucun article
blog publie")` à `tests/e2e/flows/seo-jsonld.spec.ts:64` est obsolète.

---

## 11. P2 (medium)

- **P2-1** : CLS budget 0.05 vs AGENTS.md doctrine 0 — clarifier.
- **P2-2** : LHCI 18 URLs local ≠ 5 URLs prod gate → ajouter
  `/fr/contact`, `/fr/blog`, `/fr/cas-concrets` à la gate prod.
- **P2-3** : Pre-commit manque `zod:check` (sym pre-push).
- **P2-4** : Pre-push manque `anti-siren:check` + `anti-hex:check`.
- **P2-5** : `tests/content-gen/admin-smoke.spec.ts` non câblé dans
  workflow (vit dans `tests/content-gen/` alors que playwright config
  `testDir: "./tests/e2e"`).
- **P2-6** : Trigger paths-ignore manque `scripts/`, `prisma/seed*`,
  `*.example`.
- **P2-7** : pas de smoke prod post-deploy 10 routes critiques (curl
  200 OK simple) — LHCI fait Lighthouse complet (3 min/URL) pas un
  smoke 5s.
- **P2-8** : nightly playwright-staging targette `prod` quand
  `STAGING_URL` absent (`vars.STAGING_URL || 'https://axion-ia.com'`)
  → tests E2E destructifs potentiels sur prod.

---

## 12. Recommandations P0 immédiates (séquence d'attaque)

1. **Cabler 10 routes smoke prod** (4 h) — workflow GH Actions séparé
   ou job ajouté à `deploy-coolify.yml` post-deploy avant LHCI.
2. **Image-bank tests minimum viable** (12 h) — 5 tests unit + 1
   integration + 1 e2e galerie.
3. **Lever les 10 E2E skip P0/P1** (4-6 h) — surtout booking-submit
   et contact.
4. **Retirer 2 continue-on-error** (15 min) — gate-c-docker + LHCI gate-b.
5. **Override INP /reserver LHCI** (15 min).

**Total effort P0 prioritaires** : **~22 h autopilote** → fait passer
le scoring de 90/150 → ~130/150 (87%) → 🟢 GO.

---

## 13. Hash livrable

```
File   : axionia/_AUDIT/PLATFORM-PERFECTION-2026-05-16/05-tests-cicd.md
Author : Agent 1.E (Tests & CI/CD)
HEAD   : prompt-frozen 98e0b0f / observed 4cdfbe4
Date   : 2026-05-16
Score  : 90/150 (60.0 %) — 🟡 CONDITIONAL
Top P0 : (1) image-bank 0 test, (2) 4 content-gen E2E skip, (3) booking+contact E2E skip
```
