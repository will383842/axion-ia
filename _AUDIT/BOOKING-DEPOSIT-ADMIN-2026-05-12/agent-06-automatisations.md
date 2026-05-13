# Agent 6 — Automatisations (queue, crons, workers)

**Repo** : `C:\Users\willi\Documents\Projets\Axion-IA\axionia`
**HEAD** : `ff3ccbc9edaf2bf96cc33d289b2709d10f39d742`
**Branch** : `main`
**Date** : 2026-05-12
**Mode** : AUDIT-ONLY (lecture-seule, aucune écriture code applicatif).
**Doctrine** : Code = SSOT. Cible V1 = booking-deposit-admin.

> Audit pour le master `_AUDIT/PROMPT-BOOKING-DEPOSIT-ADMIN-2026.md` (§3 Agent 6). Inventaire neutre + diff doctrine `cible V1 ~15 jobs` vs `réalité V0` + recommandations Top 10 + scoring.

---

## 1. Périmètre audité

### 1.1 Fichiers source

| Fichier                                                         | Rôle                                                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/server/queue/connection.ts:1-32`                           | Connexion ioredis BullMQ (lazyConnect, `maxRetriesPerRequest: null` requis).               |
| `src/server/queue/queues.ts:1-121`                              | Déclaration de 6 queues + helper `enqueueEmail` + `bootRepeatableJobs()`.                  |
| `src/server/queue/types.ts:1-79`                                | Types jobs : `EmailJobName` (12 templates), 5 interfaces job data.                         |
| `src/server/queue/worker.ts:1-46`                               | Entry point `pnpm worker` : démarre 4 workers + appelle `bootRepeatableJobs()`.            |
| `src/server/queue/workers/email-worker.ts:1-50`                 | Worker `emails` (concurrency 8) — rend template + envoie via Nodemailer.                   |
| `src/server/queue/workers/option-expiration-worker.ts:1-124`    | Worker `option-expiration` (concurrency 1) — flip `pending→expired` + libère slot.         |
| `src/server/queue/workers/option-reminder-worker.ts:1-70`       | Worker `option-reminder` (concurrency 1) — fenêtre [22h, 26h] + sentinel `reminderSentAt`. |
| `src/server/queue/workers/retention-purge-worker.ts:1-152`      | Worker `retention-purge` (concurrency 1) — purge RGPD 4 tables.                            |
| `src/lib/telegram.ts:1-98`                                      | `sendTelegram()` fail-soft + `alertOps`, `alertIncident` (Sprint 23 ops tags).             |
| `src/instrumentation.ts:1-19`                                   | Hook Next.js 16 — branche `sentry.server.config.ts`/`sentry.edge.config.ts`.               |
| `src/sentry.server.config.ts:1-15`                              | `Sentry.init` côté Node (tracesSampleRate, beforeSend PII scrub).                          |
| `src/app/[locale]/(admin)/[adminPrefix]/infra/page.tsx:230-388` | Console admin /infra (read-only, cards live status 14 outils).                             |
| `src/app/[locale]/(admin)/[adminPrefix]/alerts/page.tsx:1-100`  | Console admin /alerts agrégée (UptimeRobot + Coolify + Sentry pull).                       |
| `package.json:60`                                               | Script `worker = tsx src/server/queue/worker.ts`.                                          |

### 1.2 État queue/worker présent au HEAD

| Queue               | Trigger                                  | Worker concurrency | Attempts | Backoff                    | Idempotence                                                                            | DLQ                                                                             |
| ------------------- | ---------------------------------------- | ------------------ | -------- | -------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `emails`            | enqueue manuel (`enqueueEmail`)          | 8                  | 5        | exponential delay 5 000 ms | 🟡 implicite (template+to+payload, **pas de jobId**)                                   | 🔴 absente (`removeOnFail age 30j count 5000`, mais pas de queue dédiée failed) |
| `option-expiration` | repeatable `*/5 * * * *`                 | 1                  | 1        | n/a (1 attempt)            | 🟢 `jobId: option-expiration-cron` côté cron + verrou pessimiste `FOR UPDATE` côté job | 🔴 absente                                                                      |
| `option-reminder`   | repeatable `0 * * * *`                   | 1                  | 1        | n/a                        | 🟢 `jobId: option-reminder-cron` + sentinel `reminderSentAt`                           | 🔴 absente                                                                      |
| `newsletter`        | non utilisé (placeholder)                | n/a                | 5        | exp 5s                     | n/a                                                                                    | 🔴 absente                                                                      |
| `search-indexer`    | non utilisé (placeholder, FTS GENERATED) | n/a                | 5        | exp 5s                     | n/a                                                                                    | 🔴 absente                                                                      |
| `retention-purge`   | repeatable `0 3 * * *`                   | 1                  | 1        | n/a                        | 🟢 `jobId: retention-purge-cron` + ActivityLog `*.purged` (audit trail emailHash)      | 🔴 absente                                                                      |

> Lockfile cron : `bootRepeatableJobs()` (`queues.ts:84`) `removeRepeatable` puis `add` à chaque boot worker → safe en multi-instance HA scaling (fix Fork 1 W2 inscrit en commentaire). Le `jobId` figé garantit qu'un seul tick par cadence existe dans `repeat:` ZSET.

### 1.3 Crons configurés — réalité

- ✅ **Crons BullMQ repeatable** (3 actifs, déclarés `queues.ts:84-120`) :
  1. `option-expiration` `*/5 * * * *`
  2. `option-reminder` `0 * * * *`
  3. `retention-purge` `0 3 * * *` UTC
- 🔴 **Aucun `node-cron`, ni cron file Coolify, ni Sentry Crons monitoring** (`checkIn`/`monitorSlug`) — Grep `checkIn|cron.*monitor|monitorSlug` dans `axionia/src/` → **0 résultat**.
- 🟡 Console admin `/infra` (`infra/page.tsx:111-115`) liste Sentry comme "ok" si `SENTRY_DSN` configuré, **mais ne vérifie pas si les crons reçoivent leurs check-ins**.
- 🟡 Page `/alerts` (`alerts/page.tsx:1-100`) agrège UptimeRobot + Coolify + Sentry issues, **pas les jobs en `failed` BullMQ**.

### 1.4 Sentry — couverture côté workers

- `sentry.server.config.ts:1-15` charge le DSN au runtime Node. Le `Worker` BullMQ tourne dans le même process si on lance `pnpm worker` → `sentry/nextjs` devrait wrap les exceptions globalement via `onRequestError`, **mais aucun `Sentry.captureException()` explicite n'est posé dans les 4 workers** (Grep `Sentry|sentry` dans `src/server/queue/` → 0 résultat).
- Les `worker.on('failed', …)` se contentent de `console.error()` (`email-worker.ts:45-47`, `option-expiration-worker.ts:118-120`, etc.) → en production sans Sentry breadcrumb explicite, les retries silencieux disparaissent dans les logs Docker rotatifs.
- 🔴 **Sentry Crons monitoring désactivé** : aucun `Sentry.cron(...)` ou `Sentry.captureCheckIn(...)` pour un des 3 crons → si Redis est down 24 h, on ne sait pas que les crons ne tournent pas.

---

## 2. Constats positifs (≥ 3)

### 2.1 ✅ Anti-double-cron sur HA scaling (Fork 1 W2)

`queues.ts:86-119` exécute systématiquement `removeRepeatable(...)` avant `add(...)` avec un `jobId` figé pour chaque cron. Ça évite que deux instances workers laissent traîner deux entrées dans le ZSET `bull:option-expiration:repeat:` au boot et déclenchent le job deux fois par tick. Pattern propre, documenté (commentaire `queues.ts:81-83`).

### 2.2 ✅ Verrou pessimiste + re-vérification dans la transaction (Fork 1 C1)

`option-expiration-worker.ts:44-95` ne se contente pas d'un `findMany` au début du tick. Pour chaque option potentiellement expirée, il ouvre une `$transaction`, fait un `SELECT … FOR UPDATE` sur le slot et **relit `bookingOption.status`** pour s'assurer qu'un admin n'a pas confirmé/refusé entre-temps. Le `if (!result) continue` (`:98`) skip aussi l'enqueue d'email et la notif Telegram si la course est perdue → idempotence garantie même sous concurrence admin.

### 2.3 ✅ Sentinel `reminderSentAt` + fenêtre élargie (Fork 1 C3)

`option-reminder-worker.ts:22-29` utilise une fenêtre `[22 h, 26 h]` (4 h) au lieu d'une fenêtre glissante 1 h pile, garantissant la capture par au moins 2 ticks horaires. Combiné avec le `reminderSentAt: null` dans le `where`, double-rappel impossible. Pattern résilient aux dispatch_offset.

### 2.4 ✅ Graceful shutdown 25 s

`worker.ts:30-39` écoute `SIGTERM`/`SIGINT` (Coolify SIGKILL à 30 s par défaut) et drain via `Promise.race([drainAll, 25 s])` avant `process.exit(0)`. Les jobs en cours peuvent finir, et Coolify a 5 s de marge. Pattern Sprint 15 fix Fork 1 W3.

### 2.5 ✅ Retention RGPD avec audit trail emailHash

`retention-purge-worker.ts:73-93` ne fait pas un simple hard delete : chaque submission/newsletter purgée crée un `ActivityLog` avec `emailHash SHA-256` (`hashEmail()` `:46-52`) pour conserver la traçabilité RGPD art. 30 sans violer l'art. 17. Defaults env-overridables avec garde anti-misconfig (`readMonths()` `:38-44` rejette < 1).

### 2.6 ✅ Lazy Redis connection

`connection.ts:23` `lazyConnect: true` : si Redis n'est pas joignable au boot Next.js (cas dev), le process ne plante pas — la connexion est différée jusqu'à la première commande BullMQ. Évite que tout `import` des queues casse l'app entière.

---

## 3. Constats négatifs

### 3.1 🔴 P0 — Aucun job de paiement, devis, signature, facture (12 jobs manquants V1)

**Source** : Reality Check `00-REALITY-CHECK.md` §9 GAPs P0 #1, #3, #6, #7, #16, #17.

Sur les 15 jobs cibles V1, **seulement 3 sont implémentés** côté cron (option-expiration + option-reminder + retention-purge). Les **12 autres sont absents** :

| #   | Job cible V1                              | Cadence cible       | État actuel | Source                                        |
| --- | ----------------------------------------- | ------------------- | ----------- | --------------------------------------------- |
| 1   | `payment-deposit-expiration`              | `*/15 * * * *`      | 🔴 absent   | Pas de modèle `Payment` (Reality §1.1)        |
| 2   | `payment-deposit-reminder` (J+1, J+2)     | quotidien × 2       | 🔴 absent   | Pas de modèle `Payment`                       |
| 3   | `cadrage-reminder` (J-1, H-2)             | quotidien + horaire | 🔴 absent   | Pas de modèle `CadrageMeeting` (Reality §1.1) |
| 4   | `quote-expiration` (Yousign > 7j)         | `0 4 * * *`         | 🔴 absent   | Pas de modèle `Quote` ni `SignatureRequest`   |
| 5   | `nda-expiration` (Yousign > 7j)           | `0 4 * * *`         | 🔴 absent   | Pas de modèle `Nda`                           |
| 6   | `booking-j7-invoice`                      | `0 5 * * *`         | 🔴 absent   | Pas de modèle `Invoice`                       |
| 7   | `booking-j1-reminder`                     | `0 9 * * *` H-24    | 🔴 absent   | —                                             |
| 8   | `booking-j0-checkin`                      | `0 8 * * *`         | 🔴 absent   | Pas de `BookingStatus.in_progress`            |
| 9   | `booking-j1-debrief` (NPS)                | `0 10 * * *`        | 🔴 absent   | Pas de Survey trigger post-booking auto       |
| 10  | `booking-completion-auto`                 | `0 11 * * *`        | 🔴 absent   | Pas de `BookingStatus.completed`              |
| 11  | `invoice-balance-due` (J+15)              | `0 6 * * *`         | 🔴 absent   | Pas de modèle `Invoice`                       |
| 12  | `invoice-balance-overdue` (J+30)          | `0 6 * * *`         | 🔴 absent   | Pas de modèle `Invoice`                       |
| 13  | `refund-trigger`                          | `0 7 * * *`         | 🔴 absent   | Pas de modèle `Refund`                        |
| 14  | `webhook-dlq-retry` (Stripe/Yousign)      | `*/5 * * * *`       | 🔴 absent   | Pas de modèle `Webhook` (Reality §1.1)        |
| 15  | `capacity-recompute` (CapacityWindow D23) | `0 0 * * *`         | 🔴 absent   | Pas de modèle `CapacityWindow`                |

**Impact** : la promesse copy CGV `/conditions-generales` (`legal.ts:134` annulation 7j/2j) + `/interventions/*` (`interventions.ts:236` acompte 50 %, facture immédiate) ne peut pas être **opérationnellement automatisée**. Tout est manuel admin Will → SLA 1 h ouvré (`reserver/page.tsx:391`) non-tenable à 5+ bookings/jour.

### 3.2 🔴 P0 — Pas de DLQ ni alerting `failed` jobs

`queues.ts:24` configure `removeOnFail: { age: 30 * 24 * 3600, count: 5000 }` → les jobs en `failed` restent **30 jours dans la même queue Redis** sans être migrés vers un canal dédié. Conséquences :

- Aucune `Queue('failed-jobs', …)` séparée pour reprise / inspection rapide.
- Aucun `worker.on('failed', (job, err) => Sentry.captureException(err))` (`email-worker.ts:45-47` : log console uniquement).
- Aucune alerte Telegram si `getFailedCount() > 0` (Grep `getFailedJobs|getFailedCount` dans `src/` → 0 résultat).
- La page `/alerts` (`alerts/page.tsx:1-100`) ne pull pas BullMQ — donc Will ne sait jamais qu'un email transactionnel a définitivement échoué après 5 attempts.

**Impact** : un job `booking-confirmed` qui plante 5 fois (SMTP down, template Zod parse error, …) disparaît silencieusement au bout de 30 jours.

### 3.3 🔴 P0 — Aucun monitoring Sentry Crons

Sentry Crons (https://docs.sentry.io/product/crons/) permet d'envoyer un `checkIn` par exécution de cron pour détecter "cron n'a pas tourné depuis N min". Grep `checkIn|monitorSlug|Sentry.cron` dans `axionia/src/` → **0 résultat**. Les 3 crons existants peuvent rester silencieux 24-48 h (Redis disconnecté, worker process killé en boucle, Coolify deploy cassé) sans alerte.

**Impact** : si `retention-purge` ne tourne pas pendant 3 mois, on découvre la dette RGPD seulement à l'audit annuel.

### 3.4 🔴 P0 — Pas d'idempotence sur enqueueEmail (clé naturelle absente)

`enqueueEmail()` (`queues.ts:62-74`) ne pose **jamais** de `jobId` explicite côté job ajouté à la queue `emails`. BullMQ génère un UUID auto → si un Server Action est appelé deux fois (double-click, retry navigateur, rejeu webhook), **deux emails identiques partent**.

```ts
// queues.ts:73
await emailsQueue.add(template, data, addOptions);
// ↑ pas de { jobId: `${bookingId}-${template}-${day}` }
```

**Impact** : ligne 134 `booking/actions.ts` enqueue `booking-confirmed` après création — si la transaction Prisma commit puis le client retry pour cause de timeout (504 Coolify), deux emails de confirmation envoyés au même contact. Doctrine §3 prompt cible la clé `bookingId + jobType + day`.

### 3.5 🟠 P1 — Concurrency 1 sur tous les workers cron (sauf emails)

Les 3 workers cron (`option-expiration`, `option-reminder`, `retention-purge`) tournent en `concurrency: 1`. C'est correct **tant qu'un seul process worker tourne**. Mais le commentaire `queues.ts:81-83` parle de "HA scaling" (= multi-instance) → en scaling-out, deux workers actifs simultanément vont :

- partager le verrou pessimiste `FOR UPDATE` sur slot ✅ (Postgres garantit la sérialisation),
- mais récupérer le même job repeatable via `jobId` figé ✅ (BullMQ dedup ZSET),
- **et ouvrir 2 transactions Prisma sur la même option** → la 2e va re-vérifier `status='pending'` et bailout (`option-expiration-worker.ts:60-61`) ✅.

→ OK fonctionnellement. **Mais** rien ne contrôle qu'un worker en cours d'exécution n'est pas tué pendant le drain → le cron suivant peut redémarrer le tick sur des options déjà flippées. Pattern résilient grâce au sentinel, mais à documenter dans `_AUDIT/`.

### 3.6 🟠 P1 — Backoff exponential 5s × 5 attempts → max 30 min retry

`queues.ts:21-22` `attempts: 5, backoff: { type: "exponential", delay: 5000 }` → tentatives à T+0, T+5s, T+25s, T+125s (~2 min), T+625s (~10 min), T+3125s (~52 min). Total ~1 h. Le master prompt §"Résilience" demande 1s, 5s, 30s, 5 min, 1 h. **C'est proche, mais avec delay 5000 ms en base on perd le `1s` initial** → premier retry après 5 s seulement → un blip SMTP de 2 s qui résolverait avec 1 s de retry perd plus de temps. À aligner.

### 3.7 🟠 P1 — `webhook-dlq-retry` impossible sans modèle `Webhook`

Le job cible V1 #14 (`webhook-dlq-retry` toutes les 5 min) suppose une table `WebhookEvent` ou `StripeWebhookEvent` (Reality `00-REALITY-CHECK.md:23-24` → 🔴 NON présente). Donc :

- pas de capture des webhooks Stripe `checkout.session.completed`, `charge.refunded`, etc.
- pas de capture des webhooks Yousign `signature_request.completed`.
- pas de retry en cas de DB blip ou de race avec un autre handler.

→ Bloqué par GAP DB Agent 1 (Reality §1.1).

### 3.8 🟠 P1 — Pas d'observabilité métriques queue

Aucune métrique exportée Prometheus / OpenTelemetry / dashboard admin temps réel des queues. Page `/infra` (`infra/page.tsx`) liste Redis comme `ok` si `REDIS_URL` configuré (`:358-360`), **sans introspecter** les queues actives, la taille du backlog, le ratio `completed/failed`.

**Impact** : si la queue `emails` accumule 10 000 jobs en attente (SMTP overload), Will le découvre via Mailhog/PowerMTA, pas via /admin.

### 3.9 🟡 P2 — Queues `newsletter` et `search-indexer` déclarées mais inutilisées

`queues.ts:42-50` instancie deux `Queue` objets jamais consommés par un worker. Pas de coût Redis significatif (juste une clé namespace), mais dette de code à clarifier : V1+ campaign newsletter via Mailwizz (donc inutile) ou intégration future ? Bloque la lecture du fichier `queues.ts`.

### 3.10 🟡 P2 — Aucun test d'intégration des crons

Grep `option-expiration.*test|option-reminder.*test|retention.*test` dans `axionia/` → 0 résultat. La couverture tests (118 tests verts au Sprint 24.1) est forte sur les actions, mais aucune simulation `FakeRedis`/`testcontainers` pour les workers. Régression possible non détectée.

### 3.11 🟡 P2 — Aucun cron `health/heartbeat` admin

Pas de cron qui enqueue un `noop` toutes les minutes pour confirmer que le worker tourne. La page `/infra` checke Redis (`infra/page.tsx:356-362`) mais pas "un worker BullMQ a complété un job dans les 5 dernières minutes".

### 3.12 🟡 P2 — `process.exit(0)` du shutdown ne flush pas Sentry

`worker.ts:35-36` appelle `process.exit(0)` sans `await Sentry.flush(2000)` → les `captureException()` posés par les `worker.on('failed')` (si jamais on en ajoute, voir reco) peuvent être perdus dans le buffer Sentry au shutdown SIGTERM.

### 3.13 🟡 P3 — Tagging Telegram cron-job pauvre

`alertOps('MONITORING', …)` existe (`telegram.ts:78-84`) mais n'est jamais appelé par les workers cron. Les seuls Telegram envoyés depuis un worker sont `OPTION EXPIRÉE` silencieux (`option-expiration-worker.ts:106-110`). Pas d'alerting `[MONITORING] retention-purge n'a pas tourné depuis 36 h`.

---

## 4. Recommandations Top 10

Priorité décroissante. **V1 = livré dans le Sprint Booking-Deposit-Admin**. **V2+ = roadmap ultérieure** (non bloquant).

| #   | Reco                                                                                                                                                                                                                                                  | Priorité | Effort      | V1/V2+ | Fichier(s) cible(s)                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- | ------ | ---------------------------------------------------------------- |
| 1   | **Créer 12 jobs manquants V1** (voir tableau §3.1). Découpe : 6 jobs `payment-*` + 5 jobs `booking-*` + 1 `webhook-dlq-retry`. Bloqué par modèles DB Agent 1 (Payment, Invoice, Quote, Nda, CadrageMeeting).                                          | 🔴 P0    | XL (3-5j)   | V1     | `src/server/queue/types.ts`, `queues.ts`, nouveau worker par job |
| 2   | **DLQ dédiée + alerting Telegram**. Ajouter une `Queue('failed-jobs', …)` qui consomme les jobs `failed` via QueueEvents, et un worker quotidien `failed-jobs-alert` qui envoie `alertOps('INCIDENT', 'failed_count=42 …')` si > 0.                   | 🔴 P0    | M (1j)      | V1     | `queues.ts`, nouveau `workers/failed-jobs-alert.ts`              |
| 3   | **Sentry Crons monitoring** sur les 3 crons existants + 12 nouveaux. Pattern : `const checkInId = Sentry.captureCheckIn({ monitorSlug: 'option-expiration', status: 'in_progress' }); …; Sentry.captureCheckIn({ checkInId, status: 'ok'/'error' });` | 🔴 P0    | S (4h)      | V1     | tous workers `src/server/queue/workers/*.ts`                     |
| 4   | **Idempotence stricte via `jobId`** sur tous les enqueue. Format `${bookingId}-${jobType}-${YYYY-MM-DD}` (selon doctrine prompt §3). Empêche le double-enqueue après retry client.                                                                    | 🔴 P0    | M (1j)      | V1     | `queues.ts:62-74` (helper `enqueueEmail`) + actions appelantes   |
| 5   | **Sentry.captureException dans `worker.on('failed')`** + `Sentry.flush(2000)` avant `process.exit(0)`. Ajouter aussi un `setUser/setTag('queue', name)` pour faciliter le tri Sentry.                                                                 | 🟠 P1    | S (2h)      | V1     | 4 workers + `worker.ts:35-36`                                    |
| 6   | **Backoff aligné doctrine prompt** : passer de `delay: 5000` à un backoff custom `function getDelay(attempts) { return [1000, 5000, 30000, 300000, 3600000][attempts-1] ?? 3600000 }`. Couvre du blip SMTP 1s à la panne SMTP 1h.                     | 🟠 P1    | S (1h)      | V1     | `queues.ts:21-22`                                                |
| 7   | **Dashboard /admin/infra étendu queues**. Ajouter une card par queue : backlog count, waiting/active/completed/failed counts (`emailsQueue.getJobCounts()`). Pull server-only, refresh 30 s.                                                          | 🟠 P1    | M (1j)      | V1     | `src/app/[locale]/(admin)/[adminPrefix]/infra/page.tsx`          |
| 8   | **Tests d'intégration workers** via `testcontainers/redis` ou `ioredis-mock`. Pattern : créer un job, fake l'horloge, asserter side-effects (Prisma writes, Telegram mock calls).                                                                     | 🟠 P1    | L (2j)      | V1     | nouveau dossier `src/server/queue/workers/__tests__/`            |
| 9   | **Cron `heartbeat` 1 min** qui écrit un timestamp dans Redis `axionia:worker:heartbeat`. Card admin `/infra` lit ce TS et alerte si > 5 min. Plus simple que Sentry Crons pour la vue Will.                                                           | 🟡 P2    | S (3h)      | V1     | nouveau `workers/heartbeat-worker.ts` + ajout card               |
| 10  | **Cleanup queues placeholders** : supprimer `newsletter` et `search-indexer` du fichier `queues.ts` si pas utilisées V1, ou les commenter avec un `// V2+ : Mailwizz campaign worker`.                                                                | 🟡 P2    | XS (15 min) | V2+    | `queues.ts:42-50` + `types.ts:54-70`                             |

---

## 5. Sources citées

### 5.1 Code source

- `src/server/queue/connection.ts:1-32` — connection ioredis BullMQ.
- `src/server/queue/queues.ts:1-121` — 6 queues + `bootRepeatableJobs`.
- `src/server/queue/types.ts:1-79` — types jobs.
- `src/server/queue/worker.ts:1-46` — entry point + graceful shutdown.
- `src/server/queue/workers/email-worker.ts:1-50` — worker emails.
- `src/server/queue/workers/option-expiration-worker.ts:1-124` — worker expiration option 48h.
- `src/server/queue/workers/option-reminder-worker.ts:1-70` — worker rappel H+24.
- `src/server/queue/workers/retention-purge-worker.ts:1-152` — worker RGPD daily.
- `src/lib/telegram.ts:1-98` — `sendTelegram` + `alertOps` + `alertIncident`.
- `src/instrumentation.ts:1-19` — hook Next.js 16 Sentry init.
- `src/sentry.server.config.ts:1-15` — Sentry runtime Node.
- `src/app/[locale]/(admin)/[adminPrefix]/infra/page.tsx:230-388` — page admin infra.
- `src/app/[locale]/(admin)/[adminPrefix]/alerts/page.tsx:1-100` — page admin alerts.
- `package.json:60` — script `pnpm worker`.

### 5.2 Reality Check 2026-05-12

- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/00-REALITY-CHECK.md` §1.1 (modèles DB absents), §5 (queues), §6 (templates), §9 (GAPs P0/P1).

### 5.3 Doctrine

- `_AUDIT/PROMPT-BOOKING-DEPOSIT-ADMIN-2026.md` §3 "Agent 6" (15 jobs cible V1, résilience exponential backoff, DLQ, idempotence clé `${bookingId}-${jobType}-${day}`).
- `_AUDIT/AUDIT-WEB-VITALS-2026-ROADMAP.md:237` (P-506 CrUX cron monthly — référence d'usage cron côté GHA, non-bloquant).
- `AGENTS.md` (perf budget — orthogonal au scope queue).

---

## 6. Score /100

Pondération : couverture jobs V1 ×3, résilience ×2, idempotence ×2, monitoring ×2, observabilité ×1. Total max = 100.

| Critère                             | Poids | Score brut /10 | Score pondéré | Justification                                                                                                                                  |
| ----------------------------------- | ----- | -------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Couverture des 15 jobs V1**       | ×3    | 2 / 10         | 6 / 30        | 3 jobs sur 15 implémentés (option-expiration, option-reminder, retention-purge). 12 absents — bloqués par GAPs DB.                             |
| **Résilience (retry + DLQ)**        | ×2    | 4 / 10         | 8 / 20        | Backoff exponential 5 attempts ✅, mais pas de DLQ dédiée, pas d'alerting `failed`, attempts:1 sur les 3 crons.                                |
| **Idempotence (clé naturelle)**     | ×2    | 5 / 10         | 10 / 20       | ✅ `jobId` figé sur les 3 crons + verrou pessimiste + sentinel `reminderSentAt`. ❌ Pas de `jobId` sur `enqueueEmail` (double-email possible). |
| **Monitoring (Sentry Crons)**       | ×2    | 1 / 10         | 2 / 20        | ❌ Aucun `Sentry.captureCheckIn`. ❌ Aucun `Sentry.captureException` explicite dans workers. ✅ Sentry SDK chargé.                             |
| **Observabilité (admin dashboard)** | ×1    | 3 / 10         | 3 / 10        | ✅ Page `/infra` + `/alerts` agrégées. ❌ Pas de métriques queues (backlog, ratio, completed/failed). ❌ Pas de heartbeat.                     |
| **Total**                           |       |                | **29 / 100**  | Note : socle solide mais largement sous-dimensionné face à la cible V1 booking-deposit-admin.                                                  |

> **Lecture** : le code existant (M8 Sprint 15) est **propre techniquement** (graceful shutdown, verrou pessimiste, sentinel reminderSentAt, retention RGPD audit trail) mais ne couvre qu'**option 48h + RGPD daily**. La V1 booking-deposit-admin requiert **multiplier par 5 le périmètre** (12 jobs supplémentaires) + ajouter DLQ + Sentry Crons + idempotence stricte sur `emails`.

---

## 7. Marquage V1 vs V2+

### 7.1 V1 (à livrer dans le sprint Booking-Deposit-Admin)

- 🔴 12 nouveaux jobs (§3.1) — bloqués par modèles DB Agent 1.
- 🔴 DLQ dédiée + alerting Telegram (Reco #2).
- 🔴 Sentry Crons monitoring sur les 15 jobs (Reco #3).
- 🔴 `jobId` strict sur `enqueueEmail` (Reco #4).
- 🟠 `Sentry.captureException` + `flush` (Reco #5).
- 🟠 Backoff aligné doctrine 1s/5s/30s/5min/1h (Reco #6).
- 🟠 Dashboard `/admin/infra` étendu (Reco #7).
- 🟠 Tests d'intégration workers (Reco #8).

### 7.2 V2+ (post-V1 / future evolution)

- 🟡 Heartbeat 1 min via Redis TS (Reco #9) — utile mais Sentry Crons couvre le besoin V1.
- 🟡 Cleanup `newsletter` + `search-indexer` queues placeholders (Reco #10) — quand décision Mailwizz V2 prise.
- 🟡 Migration BullMQ Pro / metrics OpenTelemetry / Grafana — si scale > 100 jobs/min.
- 🟡 Stratégie rollback Coolify worker (blue/green ou canary) — si on multi-instance.
- 🟡 Migration cron Coolify natif (au lieu de repeatable BullMQ) — si on veut isoler le scheduler du worker.

---

## 8. Annexes

### 8.1 Bilan rapide queue par queue (snapshot V0)

```
emails              : 12 templates, worker concurrency 8, attempts 5 exp 5s, RFC 8058 ✅
option-expiration   : 1 worker, cron */5 *, attempts 1, verrou FOR UPDATE ✅
option-reminder     : 1 worker, cron 0 *, attempts 1, sentinel reminderSentAt ✅
newsletter          : déclarée, jamais consommée ❌
search-indexer      : déclarée, jamais consommée ❌
retention-purge     : 1 worker, cron 0 3 *, attempts 1, audit trail emailHash ✅
```

### 8.2 Notes méthodologiques

- Aucun code applicatif modifié, aucun `git`, `pnpm`, ni écriture hors ce `.md`. Conforme AUDIT-ONLY.
- Citations `file:LINE` HEAD `ff3ccbc9`.
- Limite : `[INCONNU]` posé sur le comportement réel runtime de `worker.on('failed')` quand Sentry DSN est actif → `@sentry/nextjs` v10 wrapping global non vérifié (lecture seule). À documenter Sprint 15 Fork dédié si nécessaire.
- Doctrine Code = SSOT respectée : aucune affirmation copy n'est traitée comme spec — tout est ancré sur grep + lecture file.
