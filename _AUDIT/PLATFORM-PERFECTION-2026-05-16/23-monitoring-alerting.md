# Agent 5.B — Monitoring + Alerting + Runbooks

> AUDIT-ONLY · SHA `4cdfbe4` · 2026-05-16 · Cible : production readiness obs/alerting Axion-IA · Doctrine AGENTS.md + runbooks `docs/runbooks/R01-R32`.

## Verdict & score

| Sous-chapitre                      | /20        | Note                                                                  |
| ---------------------------------- | ---------- | --------------------------------------------------------------------- |
| Sentry capture + PII redaction     | 18/20      | beforeSend Edge-compatible + scrub 5 PII classes + sample 0,1 prod    |
| Telegram alerts (content-gen + DR) | 14/20      | 16 helpers + bulk Web Vitals + cascading backup fail — manque DEPLOY  |
| Web Vitals collection RUM          | 18/20      | LoAF/LongTask/INP-attrib + ndjson + WebVitalSample + p75 worker daily |
| Lighthouse CI post-deploy          | 17/20      | gate 5 URLs prod hard-fail mais EN désactivé + pas de notif fail      |
| Runbooks DR + backups              | 14/20      | 34 runbooks (R01-R32) + R22 drill trimestriel mais log drill non créé |
| **Total**                          | **81/100** | 🟡 CONDITIONAL — 3 P0 actionables ≤ 1 j avant GO PROD                 |

🟡 **CONDITIONAL GO** — Stack RUM solide (Sentry slim 200→120 KB br, helpers SSOT wirés, BullMQ p75 daily 02:30 UTC, dashboard `/admin/web-vitals` SSR). Lacunes : pas d'alerte Telegram sur deploy fail (workflow `deploy-coolify.yml`), backup restore drill jamais exécuté (log absent), `alertOps()` helper non câblé hors scripts shell.

---

## 1. Sentry / observability backend (§ Brief)

### 1.1 Configuration

- **3 entrypoints** : `src/sentry.server.config.ts` · `src/sentry.edge.config.ts` · `src/instrumentation-client.ts`
- **DSN gating** : tous les fichiers no-op si `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` absent.
- **Sample rate prod** :
  - `tracesSampleRate: 0.1` (server) — 10 % traces, raisonnable pour Hetzner CPX42 + plan Sentry gratuit
  - `tracesSampleRate: 0` (client) — pas de tracing browser (économie bundle Sentry)
  - `replaysSessionSampleRate: 0` + `replaysOnErrorSampleRate: 0` (pas de Session Replay V1)
- **Release tracking** : `SENTRY_RELEASE` → `npm_package_version` → undefined (skip plutôt qu'agréger sous "unknown"). Méta-cert 2026-05-15 AGENT 17 P1.
- **Lazy-load client** : Sentry init via `requestIdleCallback(timeout=3000)` après hydration (audit re-run 2026-05-15 P0-05). Trade-off : erreurs des 3 premières s post-load non capturées (acceptable V1 vs gain LCP -1200/-1800 ms + TBT -1200/-1400 ms documenté).

### 1.2 PII redaction

✅ **EXCELLENT** : `src/lib/observability/sentry-pii-scrub.ts` (Edge-compatible) scrub :

- `user.{email,ip_address,username}` → delete
- `request.{headers,cookies,query_string,data}` → redact via regex
- `exception.values.{value,stacktrace.frames.vars}` → redact strings
- `breadcrumbs.{message,data}` → redact
- `extra`, `tags`, `server_name` → redact / hostname masqué

Regex couverts : `EMAIL`, `IPV4`, `PHONE`, `HEX_TOKEN ≥32`, `JWT`. Sensitive keys (header + query) → `[REDACTED]`.

✅ `sendDefaultPii: false` partout (Audit E2E 2026-05-11 P0-CONF-06 fix).

### 1.3 Lacunes

- **P1** : pas de `tracesSampleRate` dynamique selon route (toutes routes 10 %). Le calendrier `/reserver` mériterait 100 % (Stripe webhook + booking flow critical).
- **P2** : pas de Sentry Crons (alerte si cron daily/weekly ne tourne pas). Compensé par Telegram fail-soft ≥ 2 fails (cf. §2.3).
- **P2** : `replaysOnErrorSampleRate: 0` → pas de Session Replay sur error (utile pour diagnostic CLS/INP runtime).

---

## 2. Telegram alerts (alerting hub)

### 2.1 Inventaire helpers SSOT

Helpers définis dans `src/server/content-gen/shared/content-gen-alerts.ts` (16 fonctions) + `src/lib/telegram.ts` (2 helpers ops).

#### Content-gen alerts (16 callers réels confirmés)

| #     | Helper                    | Tag        | Silent | Runbook     | Status caller                                  |
| ----- | ------------------------- | ---------- | ------ | ----------- | ---------------------------------------------- |
| 1     | `alertCostCap80`          | MONITORING | ✅     | R02         | ✅ wired (cost-tracker.ts)                     |
| 2     | `alertCostCap100`         | MONITORING | ❌     | R02 + R01   | ✅ wired (cost-tracker.ts kill-switch cascade) |
| 3     | `alertProviderDown5min`   | MONITORING | ✅     | R11         | ✅ wired (circuit breaker)                     |
| 4     | `alertProviderDown30min`  | INCIDENT   | ❌     | R11         | ✅ wired                                       |
| 5     | `alertKbNotReady`         | MONITORING | ❌     | R07         | ✅ wired                                       |
| 6     | `alertBatchFail`          | INCIDENT   | ❌     | R05/R11/R12 | ✅ wired                                       |
| 7     | `alertNewReview`          | AUTO       | ✅     | —           | ✅ wired                                       |
| 8     | `alertCampaignDone`       | AUTO       | ✅     | —           | ✅ wired                                       |
| 9     | `alertLcpDegraded`        | MONITORING | ✅     | R30         | ✅ wired (web-vitals-monitor-worker)           |
| 10    | `alertInpDegraded`        | MONITORING | ✅     | R30         | ✅ wired                                       |
| 11    | `alertClsDegraded`        | MONITORING | ❌     | R30         | ✅ wired                                       |
| 11bis | `alertWebVitalsBulk`      | MONITORING | ❌     | R30         | ✅ wired (≥5 breaches)                         |
| 12    | `alertQueueStuck`         | INCIDENT   | ❌     | R05         | ⚠️ helper prêt — pas de cron caller V1         |
| 13    | `alertSoft404Detected`    | MONITORING | ❌     | R09 + R20   | ⚠️ helper prêt — pas de link-checker V1        |
| 14    | `alertIndexationStagnant` | AUTO       | ✅     | —           | ⚠️ helper prêt — pas d'analyse stagnation V1   |
| 15    | `alertTier3Stagnant`      | AUTO       | ✅     | R26         | ✅ wired (tier-lifecycle-worker)               |
| 16    | `alertIndexNowFailStreak` | INCIDENT   | ❌     | R14         | ✅ wired (indexnow-worker streak ≥3)           |

#### Ops alerts (générique)

| Helper          | Tag                                        | Caller src/                                                                         | Caller scripts/ |
| --------------- | ------------------------------------------ | ----------------------------------------------------------------------------------- | --------------- |
| `sendTelegram`  | (variable)                                 | 27 fichiers (booking/contact/audit/quote/stripe/docuseal/newsletter/admin-calendar) | —               |
| `alertOps`      | DEPLOY/INCIDENT/BACKUP/MONITORING/SECURITY | **0 caller** dans src/ ❌                                                           | —               |
| `alertIncident` | INCIDENT                                   | **0 caller** dans src/ ❌                                                           | —               |

**P1 — helper orphan** : `alertOps()` et `alertIncident()` définis dans `src/lib/telegram.ts:83-102` mais **jamais appelés** dans src/. Ils sont en revanche utilisés implicitement dans les scripts shell (`backup-postgres.sh`, `backup-postgres-r2.sh`) qui réimplémentent leur propre `notify_telegram` (duplication). Action : soit câbler `alertOps('DEPLOY', ...)` dans error boundaries Next + cron Sentry, soit acter `_DEPRECATED` + supprimer.

### 2.2 Canal cible

✅ **Un seul canal Telegram** (`TELEGRAM_CHAT_ID`) reçoit tout. C'est cohérent V1 (Will solo) — par contre **pas de routage par tag** : un cascade de Web Vitals breaches noiera les alertes Cost Cap 100 % critical.

**P2 — recommandation V2** : 3 canaux (ops_critical / ops_routine / content_review) + routage par tag dans `sendTelegram()`. Pas blocant V1.

### 2.3 Kill-switch + cost cap cascade

✅ **Audit V1.0.3 fixé** : `cost-tracker.ts` déclenche `alertCostCap100` + flip `ContentGenConfig.kill_switch.active = true` automatique. Tous workers content-gen lisent `kill_switch` au début de `processJob` et skip si actif.

Vérifié sur :

- ✅ `content-web-vitals-monitor-worker.ts:102-108`
- ✅ `content-keyword-sync-worker.ts:62-68`
- ✅ `content-rss-fetch-worker.ts`, `content-publish-worker.ts`, `content-orchestrator-worker.ts`, `content-gen-worker.ts`, etc.

### 2.4 Cascading backup fail

✅ **Audit D5+D6 P1-9 fixé** : `backup-postgres.sh` + `backup-postgres-r2.sh` maintiennent un compteur fails consécutifs (`/var/log/backup-fails-count.log`). Si ≥ 2 fails consécutifs → alerte Telegram `🔴🔴 CASCADING FAIL`. Reset compteur sur succès + notif recovery.

### 2.5 Deploy fail alert — **P0 LACUNE**

❌ `.github/workflows/deploy-coolify.yml` (377 lignes) ne contient **aucun appel `TELEGRAM_*`**.

Contraste avec 3 autres workflows qui notifient Telegram :

- `nightly.yml` → fail notif (lignes 168-231)
- `release.yml` → tag publish (lignes 65-73)
- `disk-cleanup-prod.yml` → cleanup OK/KO (lignes 113-134)

**Impact** : si le job `build` (GHCR push) ou `deploy` (Coolify POST) ou `lhci` (Lighthouse gate post-deploy) échoue, Will ne reçoit aucune alerte Telegram. Il faut consulter GitHub Actions UI manuellement.

**Fix P0** (~10 min) : ajouter step `if: failure()` à chaque job avec curl Telegram (identique à `disk-cleanup-prod.yml:130-140`).

---

## 3. Web Vitals collection (RUM)

### 3.1 Pipeline complet

```
WebVitals.tsx (client)
   └─→ useReportWebVitals(LCP,FCP,CLS,TTFB,INP)
   └─→ onINP() with attribution (Chrome 124+)
   └─→ PerformanceObserver(long-animation-frame | longtask)
   └─→ sendBeacon /api/vitals
        └─→ Zod validate (9 metric types acceptés)
        └─→ appendVitalsRecord() fire-and-forget
              ├─→ data/vitals/YYYY-MM-DD.ndjson (audit trail brut)
              └─→ prisma.webVitalSample.create() (table indépendante)

content-web-vitals-monitor-worker (cron 02:30 UTC)
   └─→ findMany WebVitalSample 24h
   └─→ group by (url, metric), MIN_SAMPLES=5
   └─→ p75 calculation
   └─→ check budget AGENTS.md (LCP≤1800, INP≤100, CLS≤0.01ε, TBT≤150, FCP≤1000, TTFB≤600)
   └─→ if breaches:
        ├─→ ≤5 : helpers SSOT par metric (LCP/INP/CLS) + bulk pour non-core
        └─→ >5 : alertWebVitalsBulk top 5
   └─→ snapshot ContentGenConfig.web_vitals_p75 (consommé par /admin/web-vitals)
   └─→ snapshot ContentGenConfig.web_vitals_last_alert
```

### 3.2 Enrichissement payload P2-30 (2026-05-15)

✅ Tous les samples WebVital portent :

- `deviceType` (mobile/tablet/desktop via matchMedia hover/pointer + breakpoint 768px)
- `userAgent` (slice 200 chars)
- `sessionId` (sessionStorage UUID v4 RGPD-friendly, reset par tab)
- `pageType` (home/blog/news/case-study/faq/help/knowledge/team/pricing/booking/pseo-ville/pseo-{audit,interventions,implementation})

Permet agrégation dashboard p75 par template (pas par page individuelle) — utile pour détecter régression sur 12 942 pages pSEO.

### 3.3 Plausible Web Vitals plugin

✅ Script étendu `.web-vitals.js` (`Plausible.tsx`). `WebVitals.tsx:emitPlausibleVital()` émet event "Web Vital" custom en parallèle du POST /api/vitals. Fail-soft si `window.plausible` absent (adblock / dev).

### 3.4 Dashboard `/admin/web-vitals`

✅ Page SSR pure `force-dynamic` lisant snapshot `ContentGenConfig.web_vitals_p75` (écrit nightly). Fallback live compute sur `WebVitalSample` si snapshot vide (1er jour prod). KPI grid + tableau (route × metric × p75 × budget × statut × n × rating CrUX × PSI ↗) + bouton "Forcer un recompute" qui enqueue tick BullMQ.

### 3.5 Lacunes

- **P2** : cap UI 200 lignes — pour 17 629 routes prerendered, ça suffira en faible trafic V1 mais pourrait être limitant en peak (top 200 routes ≠ couverture).
- **P2** : pas de timeseries p75 par route (v1 minimal SSR pur, reporté V2).
- **P3** : `WebVitalSample.value` cap mémoire 50k samples/tick (~3 MB) — risque silencieux de tronquer si trafic explose.

---

## 4. Lighthouse CI post-deploy

### 4.1 Configuration actuelle

✅ Job `lhci` dans `deploy-coolify.yml:327-376`. Lance `pnpm exec lhci collect --numberOfRuns=2 --settings.preset=desktop --settings.throttlingMethod=devtools` sur 5 URLs prod **live** (post-purge CF) :

1. `https://axion-ia.com/fr` (home)
2. `https://axion-ia.com/fr/interventions` (page produit stratégique)
3. `https://axion-ia.com/fr/audit`
4. `https://axion-ia.com/fr/reserver`
5. `https://axion-ia.com/fr/implantations/ile-de-france/paris` (pSEO pilote)

Assertions via `lighthouserc.json` (budgets LCP/INP/CLS/TBT). Hard fail bloque la pipeline → mais NB : déjà post-deploy, donc bug déjà live (pas un gate pre-merge).

### 4.2 EN désactivé (2026-05-16)

⚠️ `/en` retiré du panier LHCI car EN locale temporairement désactivé (proxy 301 → FR). Quand EN sera réactivé (cf. AGENTS.md "EN re-enable procedure") → restore `--url=https://axion-ia.com/en`.

### 4.3 Lacunes

- **P0 (couplé § 2.5)** : pas de Telegram notif si `lhci assert` fail → Will doit consulter Actions UI.
- **P2** : Lighthouse weekly via runbook R30 mais **pas automatisé** dans `.github/workflows/` séparé (R30 décrit la procédure manuelle). Pour V2 : créer `.github/workflows/lhci-weekly.yml` cron lundi matin.

---

## 5. Disaster recovery + runbooks

### 5.1 Inventaire runbooks (34 fichiers dans `docs/runbooks/`)

| Catégorie                  | Codes                                                             | Count       |
| -------------------------- | ----------------------------------------------------------------- | ----------- |
| 🔴 P0 critiques            | R01-R10                                                           | 10          |
| 🟡 P1 importants           | R11-R20 (sans R19)                                                | 9           |
| 🟢 P2 routine              | R21-R32 (sans R25)                                                | 10          |
| Procédures transverses     | `coolify-procedures.md`, `review-sop.md`, `README.md`             | 3           |
| Doublon (legacy + précisé) | R20 dupliqué (`R20-cf-cache-stale.md` + `R20-disk-saturation.md`) | 1 collision |
| Legacy infra               | `docs/ops/runbook-{deploy,incident,monitoring}.md`                | 3           |

**P2 — collision** : deux fichiers `R20-*.md` (un cache stale, un disk saturation). README.md référence seulement R20-cf-cache-stale → R20-disk-saturation.md est orphelin documentaire. Fix : renommer en R33 ou intégrer.

### 5.2 Runbook R22 PG restore drill

✅ Procédure 12 étapes claire (`docs/runbooks/R22-pg-restore-drill.md`) avec :

- RTO cible ≤ 30 min V1 / ≤ 15 min V2
- RPO cible ≤ 24h V1 / ≤ 1h V2 (WAL streaming)
- Annonce maintenance + snapshot Hetzner pré-drill + DB drill isolée + re-apply FTS migrations + measure RTO + compare counts vs prod + log result

❌ **P0 — drill jamais exécuté** : ligne 125 cite `_AUDIT/PG-RESTORE-DRILL-LOG.md` (template tableau) mais **le fichier n'existe pas** (Glob `_AUDIT/PG-RESTORE-DRILL-LOG.md` → No files found). RTO/RPO réels donc inconnus → en cas de vraie corruption Postgres, downtime imprévisible (doctrine §15 violée).

**Action P0** (~30 min ops) : Will SSH Hetzner CPX42 + lance `bash scripts/backup-postgres.sh --restore axion-ia-pg-daily-LATEST.sql.gz.enc` sur DB drill isolée + log résultat.

### 5.3 Backups Postgres

✅ **Double stratégie redondante** :

1. `scripts/backup-postgres.sh` — pg_dump + gzip + AES-256-CBC → rsync Hetzner Storage Box
   - Rétention : 7 daily / 4 weekly / 12 monthly
   - Vérif transit (size local == size remote)
   - Cascade fail detection ≥ 2 → Telegram 🔴
2. `scripts/backup-postgres-r2.sh` — pg_dump --format=custom + gzip --best + AES-256 → aws s3 cp R2
   - Off-site Cloudflare R2 (redondance hors Hetzner)
   - Même rétention + cascade fail detection
   - Mode `--restore` valide intégrité via `pg_restore --list`

**Variables requises** : `BACKUP_ENCRYPTION_PASSPHRASE`, `HETZNER_STORAGE_USER`, `HETZNER_STORAGE_HOST`, `R2_*` (6 vars), `TELEGRAM_*`.

**Cron documenté** :

```
0 3 * * *  bash /opt/axion-ia/scripts/backup-postgres.sh
0 4 * * 0  bash /opt/axion-ia/scripts/backup-postgres.sh --type weekly
0 5 1 * *  bash /opt/axion-ia/scripts/backup-postgres.sh --type monthly
```

⚠️ **P1 — vérification crontab Hetzner non documentée** : aucune trace dans `_AUDIT/` confirmant que ces 3 crons sont réellement actifs sur CPX42 (vs définis dans la doc). Action : Will → `ssh root@178.105.55.15 crontab -l` + log dans `_AUDIT/CRONTAB-PROD-2026-05-16.md`.

### 5.4 R31 Disaster région down

✅ Runbook créé (mtime 2025-04-30 ≈ aujourd'hui) — bascule Nuremberg → Falkenstein/Helsinki via snapshot Hetzner. Procédure inclut DNS swap + restore PG + reconfigure Coolify.

⚠️ Procédure jamais drillée non plus (cohérent V1 — coût/temps prohibitif).

---

## 6. Synthèse — 3 P0 actionables

### P0-1 — Drill PG restore + log RTO/RPO réel (~30 min ops)

- **Symptôme** : `_AUDIT/PG-RESTORE-DRILL-LOG.md` absent → RTO/RPO inconnus.
- **Impact** : doctrine §15 violée, RTO en incident imprévisible.
- **Fix** : Will lance R22 §3-12 sur DB drill isolée + crée log + commit.

### P0-2 — Telegram alert sur deploy/lhci fail dans `deploy-coolify.yml` (~10 min code)

- **Symptôme** : 0 occurrence `TELEGRAM_*` dans `.github/workflows/deploy-coolify.yml` (377 lignes).
- **Impact** : si build GHCR / Coolify pull / lhci assert échoue, aucune notif → consultation UI manuelle.
- **Fix** : 3 steps `if: failure()` (jobs `build`, `deploy`, `lhci`) avec curl Telegram (template copiable depuis `disk-cleanup-prod.yml:130-140`).

### P0-3 — Vérifier crontab Postgres backup réellement actif (~5 min ops)

- **Symptôme** : crons documentés (`backup-postgres.sh --type daily/weekly/monthly`) mais aucune vérif `crontab -l` archivée dans `_AUDIT/`.
- **Impact** : si crontab non installé, 0 backup → RPO = ∞ en cas de corruption.
- **Fix** : Will SSH `root@178.105.55.15` → `crontab -l` + commit dans `_AUDIT/CRONTAB-PROD-2026-05-16.md`.

---

## 7. Backlog P1 (V1.5, post-GO)

| ID   | Sujet                                                                             | Effort |
| ---- | --------------------------------------------------------------------------------- | ------ |
| P1-1 | Câbler `alertOps()`/`alertIncident()` ou supprimer (helpers orphans)              | 1 h    |
| P1-2 | Sentry sample dynamique route (100 % sur /reserver + Stripe webhook)              | 30 min |
| P1-3 | Cron Sentry monitoring (alerte si cron daily/weekly absent > X h)                 | 1-2 h  |
| P1-4 | Lighthouse weekly workflow séparé (R30 automatisé)                                | 30 min |
| P1-5 | Câbler `alertQueueStuck` via cron health-check BullMQ                             | 2 h    |
| P1-6 | Câbler `alertSoft404Detected` via cron link-checker tier-1                        | 2-3 h  |
| P1-7 | Câbler `alertIndexationStagnant` via stats GSC (worker existe, analyse à ajouter) | 1-2 h  |
| P1-8 | Routage Telegram par tag (3 canaux ops_critical/routine/content)                  | 1 h    |

---

## 8. Conformité doctrine

| Doctrine                                    | Statut | Preuve                                                                            |
| ------------------------------------------- | ------ | --------------------------------------------------------------------------------- |
| AGENTS.md Web Vitals budgets                | ✅     | `content-web-vitals-monitor-worker.ts:63-70` BUDGETS exact match                  |
| AGENTS.md Lighthouse CI gate                | ✅     | `deploy-coolify.yml:327-376` post-deploy hard fail                                |
| AGENTS.md kill-switch + cost cap            | ✅     | `cost-tracker.ts` + `ContentGenConfig.kill_switch` + 8 workers lisent             |
| CLAUDE.md §15 doctrine backups test mensuel | ❌     | Log drill manquant (P0-1)                                                         |
| CLAUDE.md §11 tags Telegram canoniques      | ✅     | 10 tags définis dans `src/lib/telegram.ts:13-34`                                  |
| RGPD Art. 32 Sentry PII                     | ✅     | `sendDefaultPii: false` + `beforeSend` scrub 5 PII classes (Audit E2E P0-CONF-06) |
| Runbooks 9 critères template                | ✅     | README.md §header conforme + R22 vérifié ligne par ligne                          |
| Stub-aware build GH Actions                 | N/A    | (hors scope monitoring)                                                           |

---

_Audit Agent 5.B clos 2026-05-16 · `4cdfbe4` · 81/100 🟡 CONDITIONAL · 3 P0 ≤ 1 j._
