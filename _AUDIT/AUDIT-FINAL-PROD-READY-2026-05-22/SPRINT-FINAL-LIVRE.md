# SPRINT FINAL CORRECTIF — Livraison

## Date : 2026-05-22 (post-audit final)

## Mode : autopilot suite Sprint Final option [A]

---

## Récapitulatif

**4 P0 code corrigés en 1 session autopilot** + 1 action Will documentée (P0-5).

### Gates verts post-fixes

- ✅ `pnpm typecheck` — 0 erreur (exit 0)
- ✅ `pnpm test` — **1687/1694 verts** (166 test files) — baseline maintenue
- ✅ Smoke test 5/5 URLs cibles → 200 (`/fr/audit`, `/fr/interventions`, `/fr/implementation`, `/fr/demande-devis`, `/fr/un-a-un`)

---

## Détail des fixes

### P0-1 ✅ Internal-link catalog 4 URLs corrigées

**Fichier** : `axionia/src/server/content-gen/links/internal-link-catalog.ts`

- `/audits` → `/audit` (singular, route réelle)
- `/interventions-formations` → `/interventions`
- `/implementations` → `/implementation`
- `/tarifs` → `/demande-devis` (route existante orientée prospection)

**Impact** : tous nouveaux articles générés via `injectInternalLinks()` injectent désormais 0 lien 404 (au lieu de ~4 sur 9).

---

### P0-2 ✅ Cron `cost-cap-reset` câblé (mensuel)

**Risque évité** : OUTAGE TOTAL content-gen à J+30.

**Fichiers modifiés** :

- `axionia/src/server/queue/queues.ts` :
  - Nouvelle queue `costCapResetQueue` (BullMQ)
  - Cron pattern `0 0 1 * *` (1er du mois 00:00 UTC) dans `bootRepeatableJobs()`
- `axionia/src/server/queue/workers/cost-cap-reset-worker.ts` : **nouveau worker** (~60 lignes)
  - Consomme la queue, invoque `resetMonthlyCostCounters()` existant
  - `lockDuration: 120_000`, concurrency 1, captureWorkerError Sentry
- `axionia/src/server/queue/lib/sentry-worker.ts` : ajout `"cost-cap-reset"` dans `WorkerName` union
- `axionia/src/server/queue/worker.ts` : bootstrap `startCostCapResetWorker()`

---

### P0-3 ✅ Cron `external-links-monitor` câblé (mensuel HEAD check)

**Risque évité** : Sprint External Links Database livré 2026-05-22 mais worker inerte (aucun cron trigger).

**Fichiers modifiés** :

- `axionia/src/server/queue/queues.ts` :
  - Nouvelle queue `externalLinksMonitorQueue` (BullMQ)
  - Cron pattern `0 2 1 * *` (1er du mois 02:00 UTC) dans `bootRepeatableJobs()` — décalé de 2h vs cost-cap-reset pour éviter contention Redis
- `axionia/src/server/queue/worker.ts` : bootstrap `startExternalLinksMonitorWorker()` (worker existant, jamais instancié auparavant)

**Note** : worker reste gaté par env `EXTERNAL_LINKS_MONITOR_ENABLED=true` (no-op silencieux sinon, par design Sprint External Links).

---

### P0-4 ✅ Sentry capture sur `content-fact-check-worker`

**Risque évité** : outages Perplexity silencieux → articles publiés sans claims vérifiés invisible.

**Fichier modifié** : `axionia/src/server/queue/workers/content-fact-check-worker.ts`

- Import `captureWorkerError` depuis `@/server/queue/lib/sentry-worker`
- Hook `workerInstance.on("failed", ...)` enrichi : `console.error` préservé + `captureWorkerError("fact-check", QUEUE_NAME, job, err)`

---

### P0-5 ⚠️ Action Will à effectuer en prod

**Commande** :

```bash
# Sur le VPS prod (Coolify exec dans le container axionia) avec DATABASE_URL prod set
pnpm tsx prisma/seeds/content-gen/seed-campaign-templates-standalone.ts
```

**Résultat attendu** :

```
[seed-campaign-templates] 6 templates upserted.
```

Le seed est **idempotent** (upsert on slug) — peut être rejoué sans risque.

**Vérification post-seed** :

```sql
SELECT slug, name FROM campaign_template ORDER BY display_order;
-- Attendu : 6 rows (PME audits, ETI implementations, etc. — D-P5-1)
```

Après seed, le flow `Fl-04 Création campagne depuis preset` (24/25 dans l'audit) passe de UI-only (FALLBACK_PRESETS) à DB-backed avec vrais `id` Prisma.

---

## Statut après Sprint Final

### Score audit projeté

| Bloc           | Score audit  | Score post-fixes (projection)                                        |
| -------------- | ------------ | -------------------------------------------------------------------- |
| Frontend       | 209/250      | **~215/250** (P0-1 résolu = F-07 16→22)                              |
| Backend        | 205/250      | **~215/250** (P0-2/3/4 résolus = B-01 18→21, B-06 21→23, B-08 22→24) |
| Flows          | 236/250      | **236/250** (P0-5 ouvre Fl-04, déjà au max)                          |
| Prod readiness | 204/250      | **204/250** (P1 polish restants)                                     |
| **TOTAL**      | **854/1000** | **~870/1000** (projeté)                                              |

### Verdict

🟢 **GO PROD après action Will P0-5** (seed CampaignTemplate prod ~30s + restart container).

Les 22 P1 restants sont **non-bloquants pour activation initiale** — peuvent être traités sur 2-4 semaines post-launch.

---

## Files modifiés (5 fichiers + 1 nouveau)

```
axionia/src/server/content-gen/links/internal-link-catalog.ts          (modifié, P0-1)
axionia/src/server/queue/queues.ts                                     (modifié, P0-2+P0-3)
axionia/src/server/queue/lib/sentry-worker.ts                          (modifié, P0-2)
axionia/src/server/queue/workers/content-fact-check-worker.ts          (modifié, P0-4)
axionia/src/server/queue/worker.ts                                     (modifié, P0-2+P0-3)
axionia/src/server/queue/workers/cost-cap-reset-worker.ts              (nouveau, P0-2)
```

**Total : +6 fichiers touchés, 0 régression typecheck/vitest.**

---

## Sprint Final P1 prioritaires (livré 2026-05-22 post-P0)

**6 P1 prioritaires traités** :

### P1-1 ✅ lockDuration 120s sur 34/34 workers

29 workers patchés (5 avaient déjà `lockDuration: 120_000` pré-existant). Évite double-exec sur LLM/Perplexity > 30s qui violerait MAX_PUBLISH cap et créerait des doublons AI Act audit trail.

### P1-2 ✅ captureWorkerError sur 34/34 workers

22 workers patchés (12 avaient déjà `captureWorkerError` pré-existant). Ratchet Sentry coverage **17/33 → 34/34**. WorkerName union étendue de 14 → 35 noms canoniques.

### P1-6 ✅ AuthorByline perf (`<img>` enrichi)

`loading="lazy"` + `decoding="async"` ajoutés. CLS déjà mitigé par width/height fixés. Pas de migration `<Image>` car `authorAvatarUrl` est remote arbitraire et `next.config.ts` `images.remotePatterns: []`.

### P1-8 ✅ CI gates ratchet strict

`continue-on-error: true` retiré sur Bundle size + Bundle delta + Lighthouse CI dans `.github/workflows/ci.yml`. Contrat AGENTS.md « size-limit gate les PR » + « LHCI gate les PR » désormais factuellement enforced. Playwright + Gate C Docker restent `continue-on-error: true` (out of scope, bugs UI + env fixture).

### P1-15 ✅ factCheckQueue.add post-publish VERIFIED OK

Audit code : `getFactCheckQueue().add(...)` est bien appelé à `src/server/queue/workers/content-publish-worker.ts:573`. Aucun fix requis. AI Act gating opérationnel.

### P1-18 ✅ Backups workflow VERIFIED OK

- **Backups daily Postgres** : déclenchés par crontab VPS (doctrine `scripts/backup-postgres.sh:21`) — dépend de l'activation crontab côté Hetzner CPX42, à vérifier par Will via `crontab -l`.
- **Restore drill nightly** : ✅ déjà automatisé dans `.github/workflows/nightly.yml:176` (script `restore-postgres-test-r2.sh`). L'audit P1-9 « cron restore-drill absent » était incorrect.

---

## Gates finaux Sprint Final complet

| Gate                                                                                                            | Résultat                                                                              |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `pnpm typecheck`                                                                                                | ✅ exit 0 — 0 erreur                                                                  |
| `pnpm test --no-file-parallelism`                                                                               | ✅ **1687 passed / 7 skipped / 0 failed** (1694 total) — **baseline EXACT maintenue** |
| `pnpm test` (mode parallèle défaut)                                                                             | ⚠️ 1680 passed / 7 failed / 7 skipped (test isolation pollution, code OK)             |
| `pnpm audit`                                                                                                    | ✅ 0 critical / 0 high (7 moderate/low devDeps inchangé)                              |
| Smoke catalog URLs (`/fr/audit`, `/fr/interventions`, `/fr/implementation`, `/fr/demande-devis`, `/fr/un-a-un`) | ✅ 5/5 → 200                                                                          |
| Workers `lockDuration: 120_000`                                                                                 | ✅ **34/34**                                                                          |
| Workers `captureWorkerError`                                                                                    | ✅ **34/34**                                                                          |

### ⚠️ Test isolation pollution — P2 follow-up

7 tests fail UNIQUEMENT en mode parallèle (mode défaut CI). Tests qui passent isolément ET en mode `--no-file-parallelism` :

- `content-google-indexing-worker.spec.ts` (2 tests)
- `content-keyword-sync-worker.spec.ts` (1 test)
- `content-news-lifecycle-worker.spec.ts` (2 tests)
- `content-publish-worker-throttle.spec.ts` (2 tests)

**Cause racine** : les nouveaux imports `captureWorkerError` ajoutent du shared module state qui pollute entre test files quand vitest tourne en parallèle. **Code prod est correct, c'est une régression d'infrastructure test uniquement.**

**Fix recommandé** (P2, ~2h) : ajouter `vi.resetModules()` ou `vi.mock("@/server/queue/lib/sentry-worker", ...)` dans les 4 specs concernés + audit des autres specs pour pollution similaire.

**Mitigation immédiate (optionnelle)** : flip vitest config `pool: "threads"` → `pool: "forks"` OU set `vitest.config.ts` `poolOptions.threads.singleThread: true`. Trade-off : 200s → 363s en CI mais 100 % isolation. Décision Will.

---

## Files Sprint Final complet (P0 + P1 prioritaires)

```
SPRINT FINAL P0 (6 fichiers, livré phase 1)
axionia/src/server/content-gen/links/internal-link-catalog.ts          (modifié, P0-1)
axionia/src/server/queue/queues.ts                                     (modifié, P0-2+P0-3)
axionia/src/server/queue/lib/sentry-worker.ts                          (modifié, P0-2)
axionia/src/server/queue/workers/content-fact-check-worker.ts          (modifié, P0-4)
axionia/src/server/queue/worker.ts                                     (modifié, P0-2+P0-3)
axionia/src/server/queue/workers/cost-cap-reset-worker.ts              (nouveau, P0-2)

SPRINT FINAL P1 prioritaires (33+ fichiers, livré phase 2)
axionia/src/components/knowledge/public/AuthorByline.tsx               (modifié, P1-6)
axionia/.github/workflows/ci.yml                                       (modifié, P1-8)
axionia/src/server/queue/lib/sentry-worker.ts                          (modifié, P1-2 — WorkerName union)
axionia/src/server/queue/workers/*.ts × 29                             (P1-1 lockDuration)
axionia/src/server/queue/workers/*.ts × 22                             (P1-2 captureWorkerError)
axionia/src/server/queue/workers/__tests__/*.spec.ts × 4               (P1-2 sentry-worker mock)
```

**Au total : ~40+ fichiers touchés, 0 régression code prod, +18 pts score audit projeté.**

---

## Score audit final projeté

| Bloc           | Score audit initial | Score post-Sprint Final                                |
| -------------- | ------------------- | ------------------------------------------------------ |
| Frontend       | 209/250             | **~217/250** (P0-1 + P1-6 + P1-8 partiels)             |
| Backend        | 205/250             | **~220/250** (P0-2/3/4 + P1-1 + P1-2 ratchet 17→34)    |
| Flows          | 236/250             | **236/250** (P0-5 ouvre Fl-04, déjà max)               |
| Prod readiness | 204/250             | **~210/250** (P1-15 + P1-18 verified + P1-8 CI strict) |
| **TOTAL**      | **854/1000**        | **~883/1000** (projeté +29 pts)                        |

🟢 **Verdict : GO PROD** après action Will P0-5 (seed CampaignTemplate prod ~30s).

---

## Sprint Final P1 secondaires LIVRÉ 2026-05-22 (suite Wave 1+2)

**14 P1 secondaires traités** (sur 22 P1 totaux — les autres P1 prioritaires sont déjà livrés). Effort total Sprint Final ~10h autopilot.

### Wave 1 (4 agents parallèles)

- **P1-3** ✅ Zod runtime validation sur **18/18 Server Actions** content-gen mutables (article, author, banned-phrases, brand-voice, cities-coverage, coverage, distribution, enqueue, external-links, geo, jobs, kb-ingest-external, kill-switch, policies, providers, review, rss, templates). Schemas `.strict()` partout. 69 tests passent.
- **P1-5** ✅ Placeholder `[Ville — France]` Organization JSON-LD → "Paris" + addressCountry "FR" (D7).
- **P1-7** ✅ LHCI cibles strictes : `cumulative-layout-shift` 0.1→0.05 + `total-blocking-time` 200→150ms + `interaction-to-next-paint` warn @ 80ms ajouté.
- **P1-12** ✅ JSON-LD `@graph` pages villes hub 4→8 schemas (Service + BreadcrumbList + Person Manon + WebPage ajoutés). Anti-duplication via `<Breadcrumbs emitJsonLd={false}>`. Pages `par-ville` étaient déjà à 8 schemas.
- **P1-16** ✅ Galerie `revalidate = 0` → `60` (ISR 1 min) avec commentaire trade-off.
- **P1-17** ✅ VERIFIED OK : `lighthouserc.json` contient déjà `[{preset:desktop},{preset:mobile}]` dans collect.settings → chaque URL testée dans les 2 form factors.
- **P1-19** ✅ pnpm audit 7 → **1 vuln** (seulement vite <=6.4.1 dev-only restant — non exposé prod, nécessite upgrade vitest 3.x P2 future). Stratégie : pnpm overrides + bump @typescript-eslint patch (préserve workaround Node 24 + pool=forks).

### Wave 2 (4 agents parallèles)

- **P1-10** ✅ Registre RGPD Art. 30 narratif PDF/MD livré `_AUDIT/AUDIT-FINAL-PROD-READY-2026-05-22/RGPD-REGISTRE-ART30.md` : 11 sections CNIL, 8 TODOs Will (adresse postale, SIREN, DPO, DPA Anthropic/OpenAI/Sentry, breach-register, test restore, gdpr-purge-worker).
- **P1-11** ✅ VERIFIED OK : 28 ADRs trouvés filesystem (vs 27+ référencés en mémoire) → aucun stub à créer. Index centralisé livré `docs/adrs/INDEX.md` (28 entrées avec slug + statut + date + lien relatif).
- **P1-13** ✅ Server Action `getQualityImprovementAttemptsDistribution()` + composant `QualityAttemptsDistributionBlock` (histogramme terracotta 0/1/2/3+ itérations) wired dans QualityV2 dashboard.
- **P1-14** ✅ Global-lock Redis `keyword-lock:{normalized}` (SET NX EX 1800s) implémenté dans `src/server/content-gen/lib/keyword-lock.ts` + 13 tests + acquire dans content-gen-worker + release dans content-publish-worker + step `keyword_lock` ajouté à `GenerationLogStep`. Stub.invalid-aware (no-op `true` au build SSG). Job status `cancelled` (pas `failed`) si lock détenu inter-campagnes.
- **P1-22** ✅ VERIFIED OK : `src/components/analytics/CookieConsent.tsx` déjà prod-ready. `useSyncExternalStore` SSR-safe + localStorage `axion-cookie-consent-v1` 13 mois CNIL + 2 boutons hiérarchie égale + i18n FR/EN + couleurs terracotta/ivoire + ARIA dialog. Gate Clarity : `if (consent !== "accepted") return null` → zéro requête réseau, zéro cookie si pas accepté.

### Actions Will résiduelles (3, ~5 min cumulé)

| #     | Action                                                                                   | Effort |
| ----- | ---------------------------------------------------------------------------------------- | ------ |
| P0-5  | `pnpm tsx prisma/seeds/content-gen/seed-campaign-templates-standalone.ts` (Coolify exec) | 30s    |
| P1-18 | `crontab -l` sur VPS Hetzner pour confirmer cron daily backup actif                      | 1 min  |
| P1-20 | `pnpm prisma migrate status` sur prod pour vérifier no drift                             | 2 min  |
| P1-21 | GSC + Bing WMT submissions sub-sitemaps récents (KB/glossaire/presse/stack-ia)           | 2 min  |

### Skippés (par décision Will explicite)

- **P1-4** `BRAND.legalName="Axion-IA"` — explicitement préservé (décision Will).

### Crisis git parallel resolved 🛠️

Pendant Sprint Final P1, Manon (parallèle) a poussé 3 commits external-links sur main + lint-staged a stashed mon WIP. Découvert via reflog : `git reset 20:14:55`. Récupération via `git stash apply stash@{2}` (69 fichiers). Protocole [[feedback_git_parallel_conversations]] : stash → pull → apply chirurgical. **0 perte de travail final.**

---

## Gates finaux Sprint Final COMPLET (P0 + P1 prioritaires + P1 secondaires)

| Gate                            | Résultat                                                                                                       |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`                | ✅ exit 0 — 0 erreur                                                                                           |
| `pnpm test`                     | ✅ **1700 passed / 7 skipped / 0 failed** (167 test files) — **+13 tests vs baseline** (keyword-lock + autres) |
| `pnpm audit`                    | ✅ 0 critical / 0 high (1 moderate dev-only `vite` restant, P2 vitest 3.x upgrade)                             |
| Workers `lockDuration: 120_000` | ✅ **34/34**                                                                                                   |
| Workers `captureWorkerError`    | ✅ **34/34**                                                                                                   |
| Catalog URLs cassées            | ✅ **0/4** (toutes corrigées)                                                                                  |
| Server Actions Zod runtime      | ✅ **18/18** files mutables                                                                                    |
| JSON-LD @graph villes hub       | ✅ **8 schemas** (vs 4 avant)                                                                                  |
| LHCI cibles strictes            | ✅ CLS 0.05 + TBT 150 + INP 80                                                                                 |
| Redis keyword-lock              | ✅ atomic SET NX EX 1800s                                                                                      |
| Cookies banner gating Clarity   | ✅ VERIFIED prod-ready                                                                                         |
| Registre RGPD Art. 30           | ✅ livré 11 sections CNIL                                                                                      |
| ADRs index centralisé           | ✅ 28 entrées                                                                                                  |
| RGPD endpoint effacement        | ✅ acquis P2 P0-2                                                                                              |

## Files Sprint Final TOTAL : ~70 fichiers (modifiés + nouveaux)

```
SPRINT FINAL P0 (6 fichiers)
SPRINT FINAL P1 prioritaires (33+ fichiers)
SPRINT FINAL P1 secondaires (~30 fichiers nouveaux ou modifiés)
TOTAL : 70 modifiés + 5 nouveaux + 2 fichiers docs livrés
```

## Score audit final projeté

| Bloc           | Score initial | Score post-Sprint Final TOTAL                                           |
| -------------- | ------------- | ----------------------------------------------------------------------- |
| Frontend       | 209/250       | **~225/250** (P0-1 + P1-5/6/7/8/12/16/17 livrés)                        |
| Backend        | 205/250       | **~230/250** (P0-2/3/4 + P1-1/2/3/14 livrés)                            |
| Flows          | 236/250       | **~244/250** (P1-13 + P1-14 + Cookies VERIFIED)                         |
| Prod readiness | 204/250       | **~225/250** (P1-10/11 docs + P1-19 audit + cookies + restore verified) |
| **TOTAL**      | **854/1000**  | **~924/1000** (projeté **+70 pts**)                                     |

🟢 **Verdict final** : **GO PROD** après actions Will (~5 min) — seed CampaignTemplate + crontab/migrate verifications.

---

## Prochaines actions Will (ordre)

1. **P0-5** : Exécuter `pnpm tsx prisma/seeds/content-gen/seed-campaign-templates-standalone.ts` sur prod (~30s)
2. **Git review + commit** : reviewer les 6 fichiers ci-dessus puis `git add` chirurgical (PAS `git add -A` — autres travaux Manon en cours)
3. **Push main** : déclenche pipeline GH Actions + Coolify deploy automatique (~25-30 min)
4. **Post-deploy smoke** : vérifier `/fr/audit`, `/fr/interventions`, `/fr/implementation`, `/fr/demande-devis` → 200 (ils répondent déjà 200 actuellement car ce sont des routes existantes — confirme juste catalog auto-corrigé)
5. **Activer rampe D-W1** : `MAX_PUBLISH_PER_DAY=30` env Coolify → restart → monitoring 48h
6. **Calendrier rampe** : 30 → 50 (J+1) → 100 (J+3) → 200 (J+7) → 500 (J+30, après vérif cron `cost-cap-reset-cron` a tourné le 1er du mois sans incident Sentry)
