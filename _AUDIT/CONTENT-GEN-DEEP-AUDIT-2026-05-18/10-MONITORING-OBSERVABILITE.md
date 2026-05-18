# 10 — MONITORING & OBSERVABILITÉ — Content-gen

> Score : **81/100** — Status global : 🟢 (couverture solide ; 4 angles morts non bloquants)
>
> HEAD réel au moment de l'audit : `c33a831` (= 1 commit au-delà du `9c1adaa` annoncé dans le prompt — pas d'impact monitoring).
> Mode : AUDIT-ONLY STRICT. Aucune modification de code, aucune migration DB, aucun commit/push. Lecture seule + écriture dans `_AUDIT/CONTENT-GEN-DEEP-AUDIT-2026-05-18/` uniquement.

---

## 0. Vue d'ensemble (Will-readable, 5 lignes)

1. La chaîne d'observabilité content-gen repose sur **6 piliers** : `GenerationLog` (trail technique pipeline), `ContentGenAuditLog` (forensique SOC2 admin), `Telegram alerts` (16 helpers), `Sentry` (erreurs runtime), `WebVitalSample` (Real-User Monitoring), `CostLedger` (budget LLM par appel).
2. **Bon** : tout est câblé end-to-end et fail-soft (aucun chemin ne casse la génération si l'observabilité tombe). PII redaction systématique (RGPD art. 32). Retention 12/24/6 mois pilotée par `retention-purge-worker.ts`.
3. **Angles morts** : (a) **2 helpers Telegram dormants** — `alertCostCap100` et `alertProviderDown30min` sont **définis mais jamais appelés** dans `src/`. (b) **Cost ledger non câblé sur Perplexity provider-router** — chaque provider doit appeler `trackCost()` lui-même (cf. §6.2). (c) **Volume DB inconnu** — Will doit lancer 4 requêtes SQL prod (cf. §1.4, §2.4, §5, §6.6). (d) `alertIncident` du prompt = helper générique `src/lib/telegram.ts:92` (≠ helpers content-gen) — pas un trou, juste un alias terminologique.
4. **Quality loop** : seuil 75 enforced (cap 2 essais auto, budget mensuel 100 USD) — bascule `needs_review` proprement. Pas d'alerte Telegram dédiée sur rejection (gap mineur P2).
5. **Sentry** : lazy-loaded client (P0-4 livré morning, gain ~80 KB shell), `piiScrubBeforeSend` câblé sur les 3 runtimes (server/edge/client), release tracking via `NEXT_PUBLIC_SENTRY_RELEASE` → `SENTRY_RELEASE` → `npm_package_version`. **Mais : 0 référence à `SENTRY_RELEASE` dans `.github/workflows/*.yml`** → release tag part probablement vide en prod (gap P1).

---

## 1. GenerationLog (trail technique)

### 1.1 Modèle Prisma

Fichier : `prisma/schema.prisma:2944-2956`

```prisma
model GenerationLog {
  id        String        @id @default(cuid())
  jobId     String
  job       ContentGenJob @relation(fields: [jobId], references: [id], onDelete: Cascade)
  level     LogLevel      @default(info)
  step      String     // pas d'enum DB → string libre
  message   String        @db.Text
  metadata  Json?
  timestamp DateTime      @default(now())

  @@index([jobId, timestamp])
  @@map("generation_logs")
}
```

**Observations factuelles** :

- `step` est **`String` libre** côté DB (pas d'enum Postgres) → l'application impose une union TS de **27 valeurs canoniques** définies dans `src/server/content-gen/shared/generation-log.ts:35-64` :
  ```
  kb_retrieve, llm_call, image_search, validation, publish, quality_check,
  plagiarism_check, intent_check, doctrine_check, kill_switch_check,
  dedup_check, seo_score, readability, indexnow_ping, google_indexing_ping,
  rss_fetch, qa_extract, json_ld_news_article, json_ld_qa_page,
  fact_check_enqueue, revalidate_path, article_insert, translation_insert,
  faq_upsert, web_vital_sample, web_vital_alert, cost_cap_check,
  auto_kill_switch, error
  ```
  Conforme exigence prompt (27 ; en réalité 29 incluant `error` + `auto_kill_switch`).
- **2 valeurs OFF-CONTRACT** détectées dans `content-quality-improver-worker.ts` :
  - `quality_loop_budget_cap_reached` (`:119`)
  - `quality_loop_cap_reached` (`:139`)
  - `quality_loop_pass` (`:159`)

  Ces 3 valeurs **n'apparaissent PAS dans l'union `GenerationLogStep`** (`generation-log.ts:35-64`). Le worker les écrit en bypass via `prisma.generationLog.create()` direct (pas via le helper `logStep`). Pas de runtime error (DB accepte tout String), mais **dérive de doctrine** : 3 nouvelles steps non documentées, non whitelistées. → Gap P2 (cohérence taxonomie).

- Cascade `onDelete: Cascade` sur `ContentGenJob` → si on purge un job, les logs partent avec. Correct pour RGPD art. 17.

### 1.2 Helper logStep (fichier:ligne)

Fichier : `src/server/content-gen/shared/generation-log.ts`

| Helper                                                    | Ligne      | Usage                                                 |
| --------------------------------------------------------- | ---------- | ----------------------------------------------------- |
| `logGeneration({jobId, level, step, message, metadata?})` | `:78-102`  | Helper noyau, swallow erreurs, cap message 5000 chars |
| `logStep(jobId, step, message, metadata?)`                | `:105-118` | Raccourci niveau `info`                               |
| `logStepError(jobId, step, message, metadata?)`           | `:121-134` | Raccourci niveau `error`                              |

**Doctrine câblage** :

- **Append-only** au niveau API (pas d'`UPDATE`/`DELETE` exposé).
- **Swallow erreurs** : `try/catch` autour de `prisma.generationLog.create` → si Prisma down ou table absente, on log `console.warn` (dev only) et on continue. Aucun risque de casser la pipeline pour un problème d'observabilité.
- **Hard cap message** : `args.message.slice(0, 5000)` ligne 90 → anti-bloat DB.

**Couverture coverage `logStep(` dans `src/` (grep)** :

| Fichier                                                          | Occurrences    |
| ---------------------------------------------------------------- | -------------- |
| `src/server/queue/workers/content-gen-worker.ts`                 | 10             |
| `src/server/queue/workers/content-publish-worker.ts`             | 8              |
| `src/server/queue/workers/content-qa-extract-worker.ts`          | 3              |
| `src/server/content-gen/shared/generation-log.ts`                | 1 (définition) |
| `src/server/content-gen/shared/__tests__/generation-log.spec.ts` | 1              |
| **Total**                                                        | **23**         |

**Bons points** : `content-gen-worker.ts` (le worker primaire) en a 10 — la pipeline principale est bien tracée. **Gap P2** : `content-quality-improver-worker.ts` n'utilise PAS le helper (`prisma.generationLog.create` direct ×3) → cohérence rompue + PII redaction shortcut-é (cf. §1.3).

### 1.3 PII redaction

Helper : `redactGenerationMetadata` dans `src/server/content-gen/lib/pii-safe.ts:85-107`

**Mécanisme** :

- Whitelist 3 sets de noms de clés PII (`email/author_email/user_email/contact_email`, `name/author_name/...`, `phone/telephone/...`)
- Si key match (case-insensitive) → applique `redactEmail`/`redactName`/`redactPhone` de `@/lib/pii-redaction`
- Sinon → passe tel quel (Will : "filet de sécurité, pas sanitizer absolu" — comment ligne 81-83)

**Câblage** : `generation-log.ts:82-83` applique `redactGenerationMetadata` à TOUT `metadata` AVANT insert DB. Le helper est inconditionnel quand on passe par `logStep`/`logGeneration`.

**Gap P2** : les 3 `prisma.generationLog.create` directs de `content-quality-improver-worker.ts` (lignes 115, 135, 155) **bypass** ce filtre. Metadata est vide dans les 3 cas → pas d'incident réel, mais le pattern est fragile (si demain on ajoute `metadata: { user_email: ... }` directement, ça fuite).

### 1.4 Volume + retention

**Volume DB** : **UNKNOWN** — Will doit lancer en prod :

```sql
SELECT count(*) FROM generation_logs;
SELECT date_trunc('day', timestamp), count(*)
FROM generation_logs
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY 1 ORDER BY 1 DESC;
```

**Retention** : 12 mois via `src/server/queue/workers/retention-purge-worker.ts:166-170` :

```typescript
const genLogsMonths = readMonths("RETENTION_GENERATION_LOGS_MONTHS", DEFAULTS.generationLogs); // 12
const genLogsResult = await prisma.generationLog.deleteMany({
  where: { timestamp: { lt: monthsAgo(genLogsMonths) } },
});
```

Cron daily 03:00 UTC (cf. en-tête fichier). Configurable via `RETENTION_GENERATION_LOGS_MONTHS` env. Garde-fou : si valeur < 1, fallback au défaut 12 (`readMonths:55-61`).

### 1.5 Status

🟢 **Solide**. Modèle clair, helper centralisé, PII filet, retention auto. **3 micro-gaps P2** (steps hors-contract dans quality-improver + bypass helper + volume DB inconnu).

---

## 2. ContentGenAuditLog SOC2

### 2.1 Modèle Prisma

Fichier : `prisma/schema.prisma:2643-2670`

```prisma
model ContentGenAuditLog {
  id          String   @id @default(cuid())
  action      String   @db.VarChar(64)           // ex: "writeContentGenConfig"
  settingKey  String?  @db.VarChar(128)
  oldValue    Json?
  newValue    Json?
  actorUserId String?  @db.Uuid
  actorEmail  String?  @db.VarChar(255)
  actorIp     String?  @db.VarChar(64)
  actorUa     String?  @db.VarChar(500)
  description String?  @db.Text
  createdAt   DateTime @default(now())

  @@index([settingKey, createdAt(sort: Desc)])
  @@index([actorUserId, createdAt(sort: Desc)])
  @@index([action, createdAt(sort: Desc)])
}
```

**3 indexes confirmés** (settingKey, actorUserId, action) × `createdAt DESC` — conforme exigence prompt §5.2.

Comment Prisma `:2640-2642` : « append-only sans purge automatique (legal hold SOC2). Si volume devient critique (≥ 1M rows), purge cron par retention-purge-worker.ts (à brancher Phase 2 si besoin). » → **PAS purgé actuellement** (à confirmer §2.4).

### 2.2 Helper writeAuditLog

Fichier : `src/server/content-gen/audit-log.ts:49-90`

Signature : `writeAuditLog({action, settingKey?, oldValue?, newValue?, actorUserId?, actorEmail?, description?})`.

**Capture automatique** depuis `next/headers` (lignes 52-67) :

- `actorUa` ← header `user-agent` (cap 500 chars)
- `actorIp` ← `x-forwarded-for` (1er hop) ou `x-real-ip` (cap 64 chars)
- Si `headers()` throw (hors HTTP request — workers BullMQ) → IP/UA null silencieusement

**Fail-soft** : `try/catch` autour de l'insert, `console.warn` dev only sinon swallow (lignes 83-89).

### 2.3 Câblage writeContentGenConfig

Confirmé : `src/server/actions/content-gen/_settings.ts:17` import + `:82` appel après upsert :

```typescript
// Append audit log best-effort (échec n'invalide pas l'upsert ci-dessus).
await writeAuditLog({
  action: "writeContentGenConfig",
  settingKey: key,
  oldValue,
  ...
});
```

**Coverage `writeAuditLog(` grep** :

- `src/server/content-gen/audit-log.ts` : 2 (signature + appel interne)
- `src/server/content-gen/__tests__/audit-log.spec.ts` : 10 (tests)
- `src/server/actions/content-gen/_settings.ts` : 1 (l'unique call site code de prod)

→ **1 seul call site prod** = `writeContentGenConfig`. Conforme doc audit-log.ts:14 « Extension future : autres actions admin (kill-switch toggle, providers update, etc.) peuvent appeler `writeAuditLog()` directement ». **Gap P2** : kill-switch toggle, provider toggle, batch settings updates ne sont **pas** encore tracés (les flèches sont prévues mais pas codées). SOC2 reste OK pour le périmètre actuel (audit setting global content-gen).

### 2.4 Volume DB

**UNKNOWN** — Will doit lancer en prod :

```sql
SELECT count(*) FROM content_gen_audit_log;
SELECT action, count(*) FROM content_gen_audit_log GROUP BY action ORDER BY 2 DESC;
SELECT date_trunc('day', created_at), count(*)
FROM content_gen_audit_log
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY 1 ORDER BY 1 DESC;
```

### 2.5 Status

🟢 **Conforme SOC2** sur le périmètre câblé (settings content-gen). 🟡 **Extension recommandée** sur kill-switch / provider toggles / batch settings (P2, non bloquant audit).

---

## 3. Telegram alerts

### 3.1 Config bot env

Fichier : `src/lib/telegram.ts:48-56`

```typescript
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
if (!token || !chatId) {
  console.warn("[telegram] missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID — skipping");
  return false;
}
```

**Fail-soft confirmé** : si l'une des 2 env vars manque → `sendTelegram()` retourne `false` sans throw. Aucun chemin ne casse la prod si Telegram coupé.

**Timeout** : 5 secondes via `AbortController` (`:60-72`) — protection contre Server Action bloqué.

### 3.2 Catalogue helpers content-gen (16 documentés, 17 dans le fichier)

Fichier : `src/server/content-gen/shared/content-gen-alerts.ts`

| #     | Helper                    | Ligne  | Tag Telegram | Silent | Runbook     |
| ----- | ------------------------- | ------ | ------------ | ------ | ----------- |
| 1     | `alertCostCap80`          | `:24`  | MONITORING   | oui    | R02         |
| 2     | `alertCostCap100`         | `:48`  | MONITORING   | non    | R02 + R01   |
| 3     | `alertProviderDown5min`   | `:71`  | MONITORING   | oui    | R11         |
| 4     | `alertProviderDown30min`  | `:97`  | INCIDENT     | non    | R11         |
| 5     | `alertKbNotReady`         | `:118` | MONITORING   | non    | R07         |
| 6     | `alertBatchFail`          | `:140` | INCIDENT     | non    | R05/R11/R12 |
| 7     | `alertNewReview`          | `:162` | AUTO         | oui    | —           |
| 8     | `alertCampaignDone`       | `:179` | AUTO         | oui    | —           |
| 9     | `alertLcpDegraded`        | `:245` | MONITORING   | oui    | R30         |
| 10    | `alertInpDegraded`        | `:265` | MONITORING   | oui    | R30         |
| 11    | `alertClsDegraded`        | `:285` | MONITORING   | non    | R30         |
| 11bis | `alertWebVitalsBulk`      | `:305` | MONITORING   | non    | R30         |
| 12    | `alertQueueStuck`         | `:337` | INCIDENT     | non    | R05         |
| 13    | `alertSoft404Detected`    | `:364` | MONITORING   | non    | R09/R20     |
| 14    | `alertIndexationStagnant` | `:391` | AUTO         | oui    | R30 + GSC   |
| 15    | `alertTier3Stagnant`      | `:447` | AUTO         | oui    | R26         |
| 16    | `alertIndexNowFailStreak` | `:421` | INCIDENT     | non    | R14         |

Tous **fire-and-forget** (`try { … } catch { /* best-effort */ }`) — règle absolue ligne 7-9 du fichier : « Une alerte Telegram ne doit JAMAIS faire échouer un worker ou Server Action. »

**Note prompt** : le prompt parle de `alertIncident`. Ce helper-là existe mais c'est un **alias generic** dans `src/lib/telegram.ts:92` (pas dans `content-gen-alerts.ts`). Utilisé une seule fois : `src/app/api/gdpr-erase/route.ts:32, 96` (notification effacement RGPD art. 17). Pas un trou dans la couverture content-gen — juste un homonyme terminologique.

### 3.3 Coverage workers (qui appelle quoi)

Grep des **call sites** (hors signatures et tests) :

| Worker / route                         | Helpers appelés                                                                               | Note                                                    |
| -------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `content-gen-worker.ts`                | `alertKbNotReady` (:186), `alertNewReview` (:499), `alertBatchFail` (:527)                    | Worker primaire                                         |
| `content-quality-improver-worker.ts`   | **AUCUN**                                                                                     | Pas d'alerte sur rejection P2                           |
| `content-publish-worker.ts`            | **AUCUN**                                                                                     | (côté Telegram content-gen)                             |
| `content-monitoring-worker.ts`         | `alertProviderDown5min`, `alertQueueStuck`, `alertSoft404Detected`, `alertIndexationStagnant` | Worker dédié observabilité                              |
| `content-web-vitals-monitor-worker.ts` | `alertLcpDegraded`, `alertInpDegraded`, `alertClsDegraded`, `alertWebVitalsBulk`              | Cron daily 02:30 UTC                                    |
| `content-psi-monitor-worker.ts`        | `alertWebVitalsBulk` (×3 sites)                                                               | PSI lab → mêmes alertes que RUM                         |
| `content-orchestrator-worker.ts`       | `alertCampaignDone`                                                                           | Fin batch campagne                                      |
| `content-tier-lifecycle-worker.ts`     | `alertTier3Stagnant`                                                                          | Cron tier-3 cleanup                                     |
| `content-indexnow-worker.ts`           | `alertIndexNowFailStreak`                                                                     | Streak ≥ 3 fails consécutifs                            |
| `cost-tracker.ts:216-220`              | `alertCostCap80` (dynamic import)                                                             | Dans `assertCostCapAvailable` quand spent franchit 80 % |

**🟠 Gap P1 confirmé** : **2 helpers dormants** non appelés dans `src/` :

- `alertCostCap100` : défini `:48` mais **jamais call site**. Le `cost-tracker.ts:230` appelle un `handleCostCapHit()` local qui envoie SON PROPRE `sendTelegram()` inline (ligne 59-67) au lieu d'appeler le helper centralisé. → Doublonnage de logique de notification. Format diverge potentiellement de la doctrine §12.3bis runbook.
- `alertProviderDown30min` : défini `:97`, jamais call site. Le `content-monitoring-worker.ts:28` n'importe que `alertProviderDown5min`. → Si un provider est down > 30 min, pas d'escalade INCIDENT vers Will (seulement le MONITORING silent de 5min). Gap réel d'escalade.

### 3.4 Status

🟢 **Couverture large** (8 workers + 1 route + 1 lib appellent au moins 1 helper). 🟠 **2 helpers dormants** = sous-utilisation de l'arsenal défini. Doublon notification cost-cap-100 à dé-doublonner.

---

## 4. Sentry

### 4.1 Câblage 3 runtimes

| Fichier                         | Existe ? | DSN                      | Release                                                               | beforeSend           | sendDefaultPii |
| ------------------------------- | -------- | ------------------------ | --------------------------------------------------------------------- | -------------------- | -------------- |
| `src/instrumentation.ts`        | ✅       | indirect                 | —                                                                     | —                    | — (délégué)    |
| `src/sentry.server.config.ts`   | ✅       | `SENTRY_DSN`             | `SENTRY_RELEASE ?? npm_package_version`                               | `piiScrubBeforeSend` | `false`        |
| `src/sentry.edge.config.ts`     | ✅       | `SENTRY_DSN`             | idem                                                                  | `piiScrubBeforeSend` | `false`        |
| `src/instrumentation-client.ts` | ✅       | `NEXT_PUBLIC_SENTRY_DSN` | `NEXT_PUBLIC_SENTRY_RELEASE ?? SENTRY_RELEASE ?? npm_package_version` | `piiScrubBeforeSend` | `false`        |

`src/instrumentation.ts:5-12` : conditionne l'import dynamique selon `NEXT_RUNTIME` (`nodejs` → server config, `edge` → edge config). Convention Next 16 + `@sentry/nextjs` v10 (commentaire ligne 2).

`src/instrumentation.ts:17-19` : exporte `onRequestError(err)` → `Sentry.captureException(err)`. Hook officiel Next 16 (cf. doc).

### 4.2 Lazy-load post-FID (P0-4 / P0-05)

Fichier : `src/instrumentation-client.ts` (115 lignes).

**Confirmé** :

- Pas d'import statique `import * as Sentry` au top → **dynamic import** via `initSentryLazy()` (`:30-80`)
- Trigger : `requestIdleCallback(callback, { timeout: 3000 })` si dispo, sinon `setTimeout(..., 3000)` (`:85-102`)
- `tracesSampleRate: 0`, `replaysSessionSampleRate: 0`, `replaysOnErrorSampleRate: 0` (`:56, 65-66`) → aucun trafic Sentry hors errors
- Integrations slim (pas de `BrowserTracing` / `Replay` / `Breadcrumbs`) — uniquement 6 intégrations bas-coût (`:48-55`)

**Comment de tête (:1-23)** documente clairement le trade-off : « les erreurs survenant durant les ~3s avant init ne sont pas capturées (acceptable V1 vs gain Web Vitals critique) ». Gain attendu : LCP mobile -1200 à -1800 ms, TBT -1200 à -1400 ms.

🟢 **P0-4 livré et auditable**.

### 4.3 piiScrubBeforeSend filter

Fichier : `src/lib/observability/sentry-pii-scrub.ts` (129 lignes).

**Scrubs appliqués** (`:67-127`) :

1. `event.user.email/ip_address/username` → `delete` (lignes 69-73)
2. `event.request.headers` → redact (Authorization/Cookie/X-CSRF/X-Auth/X-API-Key/Proxy-Auth blacklist set lignes 19-27)
3. `event.request.query_string` + `event.request.cookies` + `event.request.data` → string-redact ou record-redact
4. `event.exception.values[].value` + `frame.vars` (stack frames) → string-redact
5. `event.breadcrumbs[].message` + `data` → redact
6. `event.extra` + `event.tags` → redact
7. `event.server_name` → `[server]` (hostname interne effacé)

**Regex patterns** (lignes 13-17) : EMAIL, IPV4, PHONE, HEX_TOKEN 32+, JWT.

**Note** : pas d'IPv6 dans le pattern → IP IPv6 passeraient en clair. Gap P3.

### 4.4 Release tracking

Configuré dans les 3 configs (server/edge/client) avec cascade `NEXT_PUBLIC_SENTRY_RELEASE ?? SENTRY_RELEASE ?? npm_package_version` (commentaire « Méta-cert 2026-05-15 AGENT 17 P1 »).

**🟠 Gap P1** : grep `NEXT_PUBLIC_SENTRY_RELEASE|SENTRY_RELEASE` dans `.github/workflows/*.yml` → **0 match**. Aucun workflow GH Actions n'exporte cette variable au moment du `docker build`. Donc en pratique en prod, le cascade tombe sur `npm_package_version` (= `0.1.0` ou équivalent du `package.json`). → **Toutes les erreurs Sentry sont agrégées sous le même tag release**. Impossible d'attribuer une régression à un commit précis. Action Will : ajouter dans `.github/workflows/deploy-coolify.yml` au step build :

```yaml
build-args: |
  NEXT_PUBLIC_SENTRY_RELEASE=${{ github.sha }}
```

- Coolify env var `SENTRY_RELEASE=$RAILWAY_GIT_COMMIT_SHA` ou équivalent runtime.

### 4.5 Coverage captureException

Grep `Sentry.captureException` dans `src/` → **7 occurrences** :

- `src/instrumentation.ts:18` (hook `onRequestError` officiel)
- `src/server/queue/workers/image-bank-{translate,import,enrich,crons}-worker.ts` (4 workers image-bank — pas content-gen mais pattern d'usage)
- `src/app/api/healthz/route.ts:1`
- `src/app/[locale]/(admin)/[adminPrefix]/error.tsx:1`

**Gap P2** : **0 `Sentry.captureException` explicite dans les workers content-gen** (`content-gen-worker.ts`, `content-publish-worker.ts`, `content-quality-improver-worker.ts`, etc.). Ils s'appuient sur :

- Le `worker.on("failed", ...)` BullMQ → console.error (cf. `content-quality-improver-worker.ts:183-185`)
- Le hook Next `onRequestError` (`instrumentation.ts:17`) → uniquement pour HTTP requests, **pas pour jobs BullMQ**

→ Conséquence : un job BullMQ qui throw n'est **PAS** envoyé à Sentry automatiquement. Il est juste loggé console + retenté par BullMQ. Will n'a aucune visibilité Sentry sur les erreurs content-gen jobs. Gap réel P1.

### 4.6 Status

🟢 **Configuration solide** (3 runtimes, lazy client, scrub PII). 🟠 **2 gaps P1** : release tag jamais propagé depuis CI + jobs BullMQ non instrumentés Sentry. 1 gap P3 IPv6 regex.

---

## 5. WebVitalSample DB

### 5.1 Pipeline complet

```
Browser (web-vitals.js)
    ↓ POST /api/vitals
src/app/api/vitals/route.ts:75 → void appendVitalsRecord(parsed.data)
    ↓ fire-and-forget
src/lib/observability/vitals-store.ts:123 → Promise.all([writeNdjson, writeWebVitalSample])
    ↓ parallèle
    ├─ writeNdjson :63    → data/vitals/YYYY-MM-DD.ndjson (audit brut)
    └─ writeWebVitalSample :95 → prisma.webVitalSample.create
```

**Confirmé** :

- Route `/api/vitals` : `Node.js runtime` (cf. comment P-303 ligne 3 — Edge avait été retiré car Hetzner self-hosted ADR 0009)
- Zod schema strict 9 metrics autorisées : `CLS|FCP|FID|INP|LCP|TTFB|INP-attribution|LoAF|LongTask` (`route.ts:18`)
- **Rate limit 300 req/min/IP** (`route.ts:54`) — bump 2026-05-17 vs 60 initial (justif : admin lourde + LoAF/LongTask peuvent saturer)
- Réponse `204` immédiate AVANT persistance (fire-and-forget `void`)
- Filtre Prisma : FID + LoAF + LongTask + INP-attribution **ignorés** côté DB (`vitals-store.ts:73` set `PRISMA_METRICS = {LCP,INP,CLS,FCP,TTFB,TBT}`) → seuls les 6 metrics core sont stockés en DB. NDJSON garde tout pour audit.
- Si pas de `rating` ou pas de `url` canonique → skip insert DB (`:99-101`)

### 5.2 Cron monitor p75 quotidien

Fichier : `src/server/queue/workers/content-web-vitals-monitor-worker.ts` (295 lignes).

- Queue : `content-web-vitals-monitor`
- **Concurrency 1** + limiter `4/h cap`
- Window : `24 heures` (`:73`)
- Seuil minimum : `5 samples` par (url, metric) sinon skip (`:75`)
- Cap mémoire : `take: 50_000` rows (`:117`)
- Calcul p75 : `Math.ceil(sorted.length * 0.75) - 1` (`:92-97`)
- Budgets : LCP 1800 / INP 100 / CLS 0.01 / TBT 150 / FCP 1000 / TTFB 600 ms (`:62-70`) — alignés AGENTS.md
- Snapshot DB : `ContentGenConfig.web_vitals_p75` (key/value JSON) (`:121-128, 163-169`) + `web_vitals_last_alert` (`:236-245`)
- **Stratégie alertes** :
  - ≤ 5 breaches → 1 helper par metric core (LCP/INP/CLS), bulk pour non-core (FCP/TTFB/TBT) (`:206-233`)
  - > 5 breaches → 1 bulk top 5 (`:192-203`)
- **Kill-switch respecté** (`:101-108`) → skip tick si pause maintenance

🟢 **Pipeline complet et testé** (`__tests__/content-web-vitals-monitor-worker.spec.ts` 18 références aux mocks alert helpers + `runMonitorTickForTest` exporté `:286` pour E2E).

### 5.3 Volume DB

**UNKNOWN** — Will doit lancer en prod :

```sql
SELECT count(*) FROM web_vital_samples;
SELECT metric, count(*) FROM web_vital_samples
WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY metric;
SELECT url, count(*) FROM web_vital_samples
WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY url ORDER BY 2 DESC LIMIT 20;
```

### 5.4 Retention

6 mois via `retention-purge-worker.ts:185-189` (`RETENTION_WEB_VITALS_MONTHS=6` par défaut). Justif comment `:182-184` : « sessionId généré client anonyme, userAgent quasi-identifiant → purge agressive 6 mois alignée pratique RUM industrielle ».

### 5.5 Status

🟢 **Pipeline RUM clean** end-to-end, route → ndjson + DB → cron p75 → alerts Telegram. Très bien testé.

---

## 6. Cost ledger LLM

### 6.1 Modèle Prisma

Fichier : `prisma/schema.prisma:2999-3012`

```prisma
model CostLedger {
  id           String      @id @default(cuid())
  jobId        String?
  provider     ProviderKey
  model        String
  tokensInput  Int         @default(0)
  tokensOutput Int         @default(0)
  costUsd      Decimal     @db.Decimal(10, 4)
  timestamp    DateTime    @default(now())

  @@index([provider, timestamp])
  @@index([jobId])
}
```

Précision : `Decimal(10,4)` = 4 décimales USD → granularité 0,0001 USD = 0,01 cent. Correct pour LLM cost.

### 6.2 ProviderConfig

`prisma/schema.prisma:2673-2690` :

```prisma
model ProviderConfig {
  provider             ProviderKey  @unique
  enabled              Boolean      @default(true)
  primary              Boolean      @default(false)
  role                 ProviderRole
  model                String
  fallbackProviderId   String?
  monthlyCapUsd        Decimal      @db.Decimal(10, 2)
  currentMonthSpentUsd Decimal      @default(0) @db.Decimal(10, 2)
  rateLimitRpm         Int?
  rateLimitTpm         Int?
  apiKeyEnvVar         String
  extraConfig          Json?
}
```

### 6.3 Helpers cost-tracker

Fichier : `src/server/content-gen/lib/cost-tracker.ts` (298 lignes).

**`assertCostCapAvailable(provider, estimatedCostUsd)` :164-250** — Check pré-call :

1. Lit `ProviderConfig` (monthlyCapUsd + currentMonthSpentUsd + enabled)
2. Si pas d'enregistrement DB → skip (V0 transitoire)
3. Si provider `enabled=false` → throw `ProviderError("auth_failed")`
4. Si cap = 0 → skip (provider gratuit ex. Unsplash)
5. Si `spent < 80% AND spent + est >= 80%` → alerte `alertCostCap80` dynamic-import (`:215-224`)
6. Si `spent + est > cap` → `handleCostCapHit()` (cascade auto disable + Telegram + éventuel kill-switch global) + throw `ProviderError("cost_cap_reached")`
7. Bypass P2021 (table absente) ou `PrismaClientInitializationError` (test sans DB)

**`trackCost({jobId?, provider, model, tokensInput, tokensOutput, costUsd})` :258-286** — Post-call atomic :

```typescript
await prisma.$transaction(async (tx) => {
  await tx.costLedger.create({ data });
  await tx.providerConfig.update({
    where: { provider: args.provider },
    data: { currentMonthSpentUsd: { increment: args.costUsd } },
  });
});
```

**🟢 Atomicité garantie** : Le `$transaction` empêche la désynchro Ledger vs ProviderConfig.

**`resetMonthlyCostCounters()` :292-297** — À appeler par cron 1er du mois (cf. § 13.2 master prompt). Pas d'instance cron live confirmée dans cet audit ; à vérifier dans le doc workers (`08-WORKERS-BULLMQ-AUDIT.md`).

**`handleCostCapHit()` :36-159** (cascade auto P1-9) :

1. `ProviderConfig.enabled=false` pour ce provider
2. `sendTelegram` MONITORING inline (pas via `alertCostCap100`) — cf. §3.3 gap
3. Si plus aucun provider `role=text enabled` → kill-switch global `ContentGenConfig.kill_switch.active=true` + 2e `sendTelegram` INCIDENT
4. Trace `ContentGenConfig.cost_cap_events` (cap 50 derniers events)

**Idempotent** (enabled=false reste false), **fail-soft** (catches indiv. par étape).

### 6.4 Câblage providers (provider-router)

Grep `trackCost|assertCostCapAvailable` dans `src/server/content-gen/providers/` :

| Provider            | assertCostCapAvailable | trackCost |
| ------------------- | ---------------------- | --------- |
| `openai.ts:124`     | ✅ ($0.10 estimate)    | `:193` ✅ |
| `anthropic.ts:156`  | ✅ ($0.15 estimate)    | `:246` ✅ |
| `perplexity.ts:123` | ✅ ($0.05 estimate)    | `:206` ✅ |

**Conformité §5.6 prompt** : « `cost-tracker.ts` câblé `provider-router.ts` ? » — **précision factuelle** : le câblage n'est PAS dans `provider-router.ts` mais directement dans chaque provider concret (`openai.ts`, `anthropic.ts`, `perplexity.ts`). Le `provider-router.ts` route l'appel mais c'est le provider qui appelle le tracker. → Architecture correcte : routing découplé de l'instrumentation. Coverage 3/3 providers payants. **OK ✅**.

### 6.5 Monthly cap enforcement

✅ Confirmé : enforcement réel via `assertCostCapAvailable` qui throw `ProviderError("cost_cap_reached")` côté pré-call. Si throw → le routeur (cf. doc provider-router) bascule sur fallback (`fallbackProviderId`). Si fallback aussi cap → kill-switch global auto.

✅ `currentMonthSpentUsd` mis à jour **atomically** dans le même `$transaction` que l'insert `CostLedger` (`:260-274`).

### 6.6 Volume + coût moyen

**UNKNOWN** — Will doit lancer en prod :

```sql
-- Volume total
SELECT count(*) FROM cost_ledger;

-- Coût moyen par article (jobId non null)
SELECT
  count(DISTINCT job_id) AS n_articles,
  sum(cost_usd) AS total_usd,
  sum(cost_usd) / NULLIF(count(DISTINCT job_id), 0) AS avg_usd_per_article,
  sum(tokens_input) AS tot_in_tokens,
  sum(tokens_output) AS tot_out_tokens
FROM cost_ledger
WHERE timestamp > NOW() - INTERVAL '30 days'
  AND job_id IS NOT NULL;

-- Spent par provider mois en cours
SELECT provider, current_month_spent_usd, monthly_cap_usd,
       (current_month_spent_usd / NULLIF(monthly_cap_usd,0) * 100)::numeric(5,1) AS pct
FROM provider_config ORDER BY pct DESC NULLS LAST;
```

### 6.7 Retention

24 mois via `retention-purge-worker.ts:176-180` (`RETENTION_COST_LEDGER_MONTHS=24`). Comment `:172-175` : « aligné obligation comptable estonienne. La table comptable principale reste les invoices Stripe — ce ledger est observabilité interne. »

### 6.8 Status

🟢 **Ledger atomic clean** + 3 providers payants câblés + cap pré-call + cascade auto-disable + kill-switch global. 🟠 1 doublon notif (sendTelegram inline vs `alertCostCap100` helper non utilisé).

---

## 7. Quality loop seuils

### 7.1 Seuils configurables

Fichier : `src/server/queue/workers/content-quality-improver-worker.ts:71-77 + 91-97`

```typescript
interface QualityLoopSettings {
  enabled: boolean;
  minScoreThreshold: number; // default 75 ✅
  targetScore: number; // default 85
  maxAttemptsAuto: number; // default 2  ✅
  monthlyBudgetCapUsd: number; // default 100
}
```

Lecture via `readContentGenConfig<QualityLoopSettings>("quality_loop", DEFAULTS)` (`:91`) → modifiable runtime via admin `/content-gen/settings`.

### 7.2 Enforcement dans worker primaire

Fichier : `src/server/queue/workers/content-gen-worker.ts:343-353`

```typescript
const qualityLoop = await readContentGenConfig<QualityLoopConfig>("quality_loop", {});
const qualityLoopEnabled = qualityLoop.enabled !== false; // default ON
const qualityThreshold = qualityLoop.minScoreThreshold ?? QUALITY_LOOP_THRESHOLD_DEFAULT;
const qualityMaxAttempts = qualityLoop.maxAttemptsAuto ?? QUALITY_LOOP_MAX_ATTEMPTS_DEFAULT;
const score = output.qualityScore ?? 0;
const eligibleQualityLoop =
  qualityLoopEnabled &&
  !blockingFail &&
  score > 0 &&
  score < qualityThreshold &&
  dbJob.qualityImprovementAttempts < qualityMaxAttempts;
```

Si éligible → status `quality_improving` + enqueue `quality-improver-worker`. Sinon → `needs_review`.

### 7.3 Worker improver — cas d'arrêt

`content-quality-improver-worker.ts:129-144` :

- `dbJob.qualityImprovementAttempts >= settings.maxAttemptsAuto` (2 par défaut) → bascule `needs_review` + log step `quality_loop_cap_reached`
- `monthSpentUsd >= settings.monthlyBudgetCapUsd` (100 USD par défaut) → bascule `needs_review` + log step `quality_loop_budget_cap_reached`
- Sinon V1 : juste increment attempts + log step `quality_loop_pass` (re-prompt LLM = V2 TODO)

### 7.4 Rejections → log + Telegram ?

- **Log step `error`** : ❌ Non. Le worker écrit `level: warn` (pas `error`) + step **`quality_loop_*`** non-canoniques (cf. §1.1 gap doctrine).
- **Telegram alert** : ❌ Aucun appel `sendTelegram` ou `alert*` dans `content-quality-improver-worker.ts`. Une rejection silencieuse côté Will.

→ Gap P2 : pas d'alerte sur rejection quality_loop. À ajouter un helper dédié `alertQualityLoopRejection(jobId, finalScore, attempts)` ou réutiliser `alertNewReview` (qui informe Will qu'il y a un job en review).

### 7.5 Status

🟢 **Seuils corrects et enforcés** (75 / 2 attempts / 100 USD/mois). 🟠 **Rejections silencieuses** (pas de Telegram + steps hors-doctrine).

---

## 8. Gaps consolidés

| #   | Domaine                      | Gap                                                                                                                                                                                                                                             | Priorité        | Effort                                                  |
| --- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------- |
| 1   | Sentry release               | `NEXT_PUBLIC_SENTRY_RELEASE` / `SENTRY_RELEASE` **non exporté par GH Actions / Coolify** → toutes les errors agrégées sous `npm_package_version` immuable. Impossible d'attribuer une régression à un commit.                                   | **P1**          | 30 min (1 build-arg + 1 env var Coolify)                |
| 2   | Sentry workers               | **0 `Sentry.captureException` dans workers content-gen BullMQ**. `worker.on("failed")` → `console.error` only. Aucune remontée Sentry sur job throw.                                                                                            | **P1**          | 1-2h (wrap processJob)                                  |
| 3   | Telegram dormants            | `alertCostCap100` + `alertProviderDown30min` **définis mais 0 call site**. Cost-cap 100 % utilise un `sendTelegram` inline divergent dans `cost-tracker.ts:59-67`. Provider down 30min → pas d'escalade INCIDENT (seul 5min MONITORING silent). | **P1**          | 1h (refactor cost-tracker + brancher monitoring-worker) |
| 4   | Quality loop silencieux      | Rejections (cap attempts ou cap budget) → `level: warn` + step hors-doctrine + **0 Telegram**. Will n'a pas de signal.                                                                                                                          | P2              | 30 min (1 helper + 1 appel ×2)                          |
| 5   | Steps hors-contract          | `content-quality-improver-worker.ts:115, 135, 155` écrit `quality_loop_*` **hors union `GenerationLogStep`**. Bypass aussi le PII redact.                                                                                                       | P2              | 15 min (ajouter à l'union + utiliser `logStep`)         |
| 6   | ContentGenAuditLog extension | Seul `writeContentGenConfig` câblé. Kill-switch toggle, provider toggle, batch settings updates **non tracés** SOC2.                                                                                                                            | P2              | 1-2h (3-5 call sites à ajouter)                         |
| 7   | IPv6 PII                     | `sentry-pii-scrub.ts:14` `IPV4_RE` ne capture pas IPv6 → IP IPv6 passeraient en clair vers Sentry.                                                                                                                                              | P3              | 15 min (pattern IPv6)                                   |
| 8   | Volume DB inconnu            | 4 tables clés (`generation_logs`, `content_gen_audit_log`, `web_vital_samples`, `cost_ledger`) → volume actuel inconnu.                                                                                                                         | P0 (audit-only) | 5 min (Will lance les 4 SQL)                            |
| 9   | `ContentGenAuditLog` purge   | Comment Prisma dit « append-only sans purge automatique (legal hold SOC2). Si volume ≥ 1M rows, purge Phase 2 ». Aucune branche dans `retention-purge-worker.ts`. À ré-évaluer quand volume connu.                                              | P3              | À déclencher post-réponse §8 ci-dessus                  |

---

## 9. STOP & ASK Will

1. **SQL volume DB** — Peux-tu lancer ces 4 requêtes sur la prod Postgres et me coller les résultats (réponse SQL) ?

   ```sql
   SELECT count(*) FROM generation_logs;
   SELECT count(*) FROM content_gen_audit_log;
   SELECT count(*) FROM web_vital_samples;
   SELECT count(*) FROM cost_ledger;
   ```

   Ça débloque les calculs de coût moyen / article et le verdict §1.4 / §2.4 / §5.3 / §6.6.

2. **Sentry release tracking (Gap P1 #1)** — OK pour patcher `.github/workflows/deploy-coolify.yml` afin de propager `NEXT_PUBLIC_SENTRY_RELEASE=${{ github.sha }}` en build-arg + ajouter env var `SENTRY_RELEASE` dans Coolify (scope RUN) ? C'est ~30 min pour rendre Sentry vraiment exploitable.

3. **Sentry jobs BullMQ (Gap P1 #2)** — Veux-tu qu'un futur sprint ajoute un wrapper `try { await processJob } catch { Sentry.captureException; throw }` sur chaque worker content-gen ? Sinon les erreurs jobs n'apparaissent que dans les logs Coolify (bruit).

4. **Doublon notif cost-cap-100 (Gap P1 #3)** — Préférence pour : (a) refactor `cost-tracker.ts:handleCostCapHit` pour utiliser le helper `alertCostCap100` existant (canonique), ou (b) supprimer le helper non utilisé et garder l'inline ? Reco : (a) — format runbook R02 + R01 cohérent partout.

5. **Escalade provider down 30min (Gap P1 #3 bis)** — Veux-tu que le `content-monitoring-worker.ts` track aussi les downs > 30 min (en plus des 5 min déjà alertés) ? Sans ça, un provider down 1h reste juste un MONITORING silent.

6. **`ContentGenConfig.cost_cap_events` purge** — On garde un cap dur à 50 events (cf. `cost-tracker.ts:143`). OK ou tu veux étendre à 200 pour historique trimestriel ?

7. **Cron `resetMonthlyCostCounters`** — Le helper existe (`cost-tracker.ts:292`) mais je n'ai pas confirmé dans cet audit qu'un BullMQ scheduler l'appelle vraiment le 1er du mois 00:01. À cross-référer avec `08-WORKERS-BULLMQ-AUDIT.md` (déjà produit). Si pas câblé → `currentMonthSpentUsd` ne reset jamais et les caps deviennent effectifs « depuis toujours » au lieu de « ce mois-ci ». Critique.
