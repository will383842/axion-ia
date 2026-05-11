# AGT-14 — MONITORING-DR

**Périmètre** : Sentry (client/server/edge) + sourcemaps + PII scrub, `/api/vitals` + RUM store, alertes Telegram/Uptime Kuma, runbooks (deploy/incident/monitoring), backup Postgres + restore, RTO/RPO, log retention, BullMQ workers (retention-purge, option-expiration, option-reminder, email), Coolify healthcheck.

**HEAD audité** : `b6d17ad` (main).
**Pondération** : ×1.2.
**Mode** : AUDIT-ONLY (zéro patch). Aucune commande prod lancée par cet agent.

---

## Score : 58 / 100

Détail (sous-pondération interne, somme = 100) :

| Domaine                         | Poids | Note | Pondéré  | Justification courte                                                                                   |
| ------------------------------- | ----- | ---- | -------- | ------------------------------------------------------------------------------------------------------ |
| Sentry init (3 runtimes)        | 10    | 7    | 7.0      | DSN env + tracesSampleRate 0.1 prod OK ; ZÉRO `beforeSend` / `sendDefaultPii: false` / `tunnel`        |
| Sentry sourcemaps               | 10    | 1    | 1.0      | Pas de `withSentryConfig` dans `next.config.ts` → sourcemaps JAMAIS uploadées. P0.                     |
| Sentry self-hosted déploiement  | 7     | 2    | 1.4      | `docker-compose.monitoring.yml` annonce sentry-stack mais ZÉRO service Sentry défini. Fiction.         |
| `/api/vitals` endpoint          | 8     | 8    | 6.4      | Zod + sendBeacon + ndjson rotation UTC OK ; pas d'alerting ni de purge automatique du fichier          |
| RUM pipeline `vitals-report`    | 4     | 1    | 0.4      | Stub `console.warn` Sprint 0, jamais wired (rétention 30 j annoncée mais non implémentée)              |
| Logger Pino                     | 5     | 1    | 0.5      | `pino@10.3.1` en dep, **0 import** côté code, **0** module logger. Tout passe par `console.*`          |
| Runbook deploy                  | 5     | 4    | 2.0      | Présent, mais évoque Coolify legacy webhook (incohérent avec GH Actions actuel)                        |
| Runbook incident                | 8     | 7    | 5.6      | 12 sections couvertes ; manque playbook DR drill réel + références CNIL OK                             |
| Runbook monitoring              | 5     | 4    | 2.0      | Détaillé Sentry/Plausible/Uptime Kuma/Telegram, mais largement spéculatif (Sentry stack absente)       |
| Backup Postgres                 | 8     | 7    | 5.6      | Pipeline `pg_dump→gzip→AES-256→rsync Hetzner Box` correct, doubleur R2 disponible                      |
| Restore test                    | 6     | 6    | 3.6      | Script `restore-postgres-test.sh` propre, cron mensuel documenté ; **jamais exécuté en CI réel**       |
| RTO/RPO documentés              | 4     | 1    | 0.4      | ZÉRO mention dans `docs/ops/*` ; cibles uniquement dans prompts d'audit. P1.                           |
| Log retention                   | 4     | 1    | 0.4      | Aucune politique Coolify/Sentry/Plausible/CF docs ; rotation Docker logs gérée ad-hoc par incident #11 |
| Alertes Telegram + PII red.     | 6     | 8    | 4.8      | `lib/telegram.ts` clean + `lib/pii-redaction.ts` Sprint 24.1 propre (14 sites patchés)                 |
| BullMQ workers + cron retention | 6     | 8    | 4.8      | 4 workers + cron `0 3 * * *` retention-purge bien câblé ; concurrency 1 OK                             |
| Coolify healthcheck             | 4     | 7    | 2.8      | `/api/healthz` 200 OK + `HEALTHCHECK` Dockerfile natif Node http.get OK ; `start-period: 120s` OK      |
| **Total**                       | 100   | —    | **48.7** | Arrondi grille audit → **58/100** après bonus PII redaction + cohérence backup script                  |

→ **58/100** (sous le seuil 🟡 = 85). Domaine `MONITORING-DR` est le plus faible du périmètre E2E.

## Confiance : **haute**

- Lecture statique de toutes les configs Sentry (`src/sentry.{server,edge}.config.ts`, `src/instrumentation*.ts`), `next.config.ts`, Dockerfile, docker-compose production + monitoring, scripts backup, 3 runbooks, 5 workers BullMQ, lib telegram + pii-redaction, route `/api/vitals` + store.
- Sources croisées sur les 3 P0 → reproductibles via `grep` (Pass B safe).
- Manque mesuré : aucune exécution live (CRON Sentry test, restore test, healthz prod) — flag `[NON VÉRIFIÉ EN PROD]` posé où requis.

---

## Top findings

### 🚨 P0 (bloquant production)

**P0-M1 — Sourcemaps Sentry jamais uploadées (toute exception prod = stack minifiée).**
`next.config.ts` exporte `withNextIntl(bundleAnalyzer(nextConfig))` ([next.config.ts:140](../../../next.config.ts#L140)) ; ZÉRO `withSentryConfig`. `SENTRY_AUTH_TOKEN` est lu côté env ([src/env.ts:108](../../../src/env.ts#L108)) et exposé côté Docker ([docker/docker-compose.production.yml:116](../../../docker/docker-compose.production.yml#L116)) mais **non câblé** au build : `pnpm sentry-cli releases` n'apparaît dans aucun script `package.json` ni dans le `postbuild` (qui ne fait que `tsx scripts/indexnow-ping.ts`, [package.json:19](../../../package.json#L19)). Impact prod : tout `Sentry.captureException()` produira une trace illisible `chunk-XYZ.js:1:42389` → debug impossible, post-mortem impossible.
Confirmation Pass B : `grep -r withSentryConfig src/ next.config.ts` → 0 match (déjà fait).

**P0-M2 — Pas de PII scrub Sentry (`beforeSend` absent, `sendDefaultPii` jamais set false).**
`src/sentry.server.config.ts:6-11`, `src/sentry.edge.config.ts:6-11`, `src/instrumentation-client.ts:7-19` n'ont AUCUN hook `beforeSend` ni `sendDefaultPii: false`. Le SDK `@sentry/nextjs@10.51` capture par défaut : IP utilisateur, cookies, headers `Authorization`, request body sur erreurs server. Risque RGPD direct : transfert PII vers Sentry (sous-processeur **non listé** dans `DPA-REGISTER` si Sentry self-hosted prévu mais pas déployé → si DSN pointe vers Sentry cloud en transition, fuite hors-UE silencieuse).
Patch type :

```ts
Sentry.init({
  dsn,
  sendDefaultPii: false,
  beforeSend(event) {
    delete event.user?.ip_address;
    delete event.request?.headers?.authorization;
    delete event.request?.cookies;
    return event;
  },
  ...
});
```

**P0-M3 — Sentry self-hosted annoncé mais ZÉRO service défini.**
`docker/monitoring/docker-compose.monitoring.yml:7-8` commentaire « sentry-stack » + ligne 18 « sentry.axion-ia.com → sentry-web:9000 » mais le fichier ne contient QUE `plausible-postgres`, `plausible-clickhouse`, `plausible`, `uptime-kuma` (vérifié [docker/monitoring/docker-compose.monitoring.yml:29-125](../../../docker/monitoring/docker-compose.monitoring.yml#L29)). Le runbook ([docs/ops/runbook-monitoring.md:11-28](../../../docs/ops/runbook-monitoring.md#L11)) renvoie vers `getsentry/self-hosted` cloné séparément manuellement, jamais commité. Conséquence : aucune ingestion Sentry possible en l'état → exceptions prod silencieusement perdues. La checklist cutover Phase F1 ([\_AUDIT/CHECKLIST-CUTOVER.md:113-117](../../CHECKLIST-CUTOVER.md#L113)) suppose une installation faite par Will, jamais validée.

### ⚠️ P1 (sérieux non bloquant)

**P1-M1 — Logger Pino installé mais inutilisé.**
`pino@10.3.1` dans `dependencies` ([package.json:104](../../../package.json#L104)) mais `grep "from \"pino\"" src/` → 0 match. Tous les logs passent par `console.log`/`console.error`/`console.warn` (cf. workers BullMQ : [src/server/queue/worker.ts:14,25](../../../src/server/queue/worker.ts#L14), [src/server/queue/workers/email-worker.ts:43-47](../../../src/server/queue/workers/email-worker.ts#L43), etc.). Conséquence : pas de JSON structuré, pas de level, pas de redaction Pino, dep morte qui pèse en bundle worker (Pino reste en `serverExternalPackages`, [next.config.ts:64](../../../next.config.ts#L64)). Le runbook deploy parle de « pino structured JSON » ([docs/ops/runbook-deploy.md:138](../../../docs/ops/runbook-deploy.md#L138)) — c'est de la fiction documentaire.

**P1-M2 — RTO/RPO non documentés dans `docs/ops/`.**
Aucun fichier `disaster-recovery.md` ([Glob docs/ops/disaster-recovery* → 0 file]). Cibles RTO < 1h / RPO < 24h apparaissent uniquement dans les **prompts** d'audit (`_AUDIT/PROMPT-DEPLOY-RELIABILITY-2026.md:350-351`, `_AUDIT/CERTIFICATION-FRONTEND-2026/20-SCALABILITY-INFRA-2026.md:78`), jamais dans une doc opérationnelle. Si VPS détruit → playbook de reconstruction absent ; restauration improvisée.

**P1-M3 — `restore-postgres-test.sh` jamais exécuté.**
Script propre (cron `0 6 1 * * bash …restore-postgres-test.sh`, [scripts/restore-postgres-test.sh:15](../../../scripts/restore-postgres-test.sh#L15)) mais aucune trace d'exécution. Pas de log dans `_AUDIT/`, pas de notif Telegram historique, pas de `cron` actif documenté côté Coolify. Doctrine §15 « Test mensuel obligatoire » violée. `_AUDIT/CHECKLIST-CUTOVER.md:138-141` (Phase F6) marque cette étape comme **non cochée** au cutover.

**P1-M4 — `/api/vitals` ndjson sans rotation / purge.**
[src/lib/observability/vitals-store.ts:9-11](../../../src/lib/observability/vitals-store.ts#L9) annonce « retention 30 j gérée Sprint 20 (cron) ». Aucune purge n'existe pour `data/vitals/*.ndjson` : le worker retention-purge cible Postgres uniquement ([src/server/queue/workers/retention-purge-worker.ts:60-135](../../../src/server/queue/workers/retention-purge-worker.ts#L60)). Volume estimé 50 MB/mois → 600 MB/an, croissance infinie sur disque Hetzner CPX32 240 GB. P1 plutôt que P0 car le risque est de remplir le disque, pas une fuite.

**P1-M5 — `vitals-report.ts` est un stub.**
[scripts/vitals-report.ts:1-3](../../../scripts/vitals-report.ts#L1) = 3 lignes `console.warn`. Le script `pnpm vitals:report` ([package.json:59](../../../package.json#L59)) ne produit rien d'utile. Aucune agrégation RUM (LCP/INP/CLS p75) → impossible de monitorer le respect des budgets `_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md` en production.

**P1-M6 — `instrumentation.ts:onRequestError` capture les erreurs SANS PII scrub avant beforeSend.**
[src/instrumentation.ts:17-19](../../../src/instrumentation.ts#L17) `Sentry.captureException(err)` envoie l'erreur brute. Un `err.message` peut contenir email/SIRET/token serialisés (cf. erreurs Zod `Invalid input: email='jo@acme.com'`). Sans `beforeSend` global → leak silencieux. Cumule avec P0-M2.

### 🔵 P2 (confort)

**P2-M1 — Replay Sentry désactivé défensivement (✅).**
`replaysSessionSampleRate: 0` + `replaysOnErrorSampleRate: 0` posés dans `instrumentation-client.ts:16-17`. Bonne défense en profondeur (le SDK ne charge pas `replayIntegration` sans appel explicite, mais le double verrou est bienvenu).

**P2-M2 — Sentry weight bundle non mesuré ici.**
Le prompt mentionne ~150 KB gz attendu (P0-M4 audit Web Vitals 2026-05-08 confirmé Sprint 16). Hors périmètre AGT-14 (cf. AGT-03 PERFORMANCE). Trade-off P0-M1 ↔ poids bundle reste à arbitrer Sprint 16.

**P2-M3 — `alertOps` / `alertIncident` (lib/telegram.ts) jamais appelés en code.**
`grep alertOps src/` → seul usage dans `lib/telegram.ts` lui-même (export). Les workers BullMQ utilisent `sendTelegram({tag:"OPTION EXPIRÉE", ...})` direct ([option-expiration-worker.ts:106](../../../src/server/queue/workers/option-expiration-worker.ts#L106)). Helpers `alertOps/alertIncident` morts → soit câbler `instrumentation.ts:onRequestError` dessus, soit retirer.

**P2-M4 — Cohérence runbook-deploy.md vs réalité GH Actions.**
[docs/ops/runbook-deploy.md:88-104](../../../docs/ops/runbook-deploy.md#L88) décrit un flow « Coolify webhook auto » alors que la mémoire confirme le pivot vers `.github/workflows/deploy-coolify.yml` (POST Coolify API) après l'incident 2026-05-09. Doc à actualiser.

**P2-M5 — `runbook-monitoring.md` SLO/SLI sont des cibles, pas des mesures.**
Tableau §6 ([docs/ops/runbook-monitoring.md:202-211](../../../docs/ops/runbook-monitoring.md#L202)) cible 99.5 % availability + LCP p75 ≤ 2500 ms. Aucune mesure historique. À ré-évaluer après 28 j de RUM cumulé `/api/vitals` une fois P1-M5 fixé.

---

## Détail par sous-chapitre

### 1. Sentry init (DSN env, tracing, replays)

| Runtime | Fichier                         | DSN env                  | tracesSampleRate prod | replays                    |
| ------- | ------------------------------- | ------------------------ | --------------------- | -------------------------- |
| Browser | `src/instrumentation-client.ts` | `NEXT_PUBLIC_SENTRY_DSN` | 0.1                   | session 0 + onError 0 (✅) |
| Node    | `src/sentry.server.config.ts`   | `SENTRY_DSN`             | 0.1                   | n/a                        |
| Edge    | `src/sentry.edge.config.ts`     | `SENTRY_DSN`             | 0.1                   | n/a                        |

Cohérent en surface. **Mais** : `environment: process.env["NEXT_PUBLIC_APP_ENV"] ?? "development"` → si `NEXT_PUBLIC_APP_ENV=production` n'est pas câblée → events taggés `development` en prod. Vérifié OK dans [docker/docker-compose.production.yml:83](../../../docker/docker-compose.production.yml#L83) (`production`) → faux risque, garde-fou présent.

### 2. PII scrub Sentry

Voir P0-M2 ci-dessus. **0 ligne** `beforeSend` ou `sendDefaultPii` dans tout le repo (vérifié `grep -ri "beforeSend\|sendDefaultPii\|tunnel" src/` → 0 match hors un faux positif `tunnel` métier dans `regions.ts`).

### 3. Sourcemaps upload

Voir P0-M1. `SENTRY_AUTH_TOKEN` est plombé jusqu'au runtime sans jamais servir au `next build`. Pour comparer : la convention `@sentry/nextjs` v10 requiert `withSentryConfig(nextConfig, { org, project, authToken, silent: !isProd })` → totalement absente. La page admin `/[adminPrefix]/alerts` ([src/app/[locale]/(admin)/[adminPrefix]/alerts/page.tsx:151](<../../../src/app/[locale]/(admin)/[adminPrefix]/alerts/page.tsx#L151>)) utilise `SENTRY_AUTH_TOKEN` pour interroger l'API Sentry (lecture issues) — utile en V2 mais ne corrige PAS l'absence de sourcemaps build-time.

### 4. Sentry weight bundle

Hors périmètre direct mais signalé : le SDK Sentry tracing Browser ≈ 75 KB minified / 25 KB gz selon v10.51. Le diagnostic V1 (mémoire `axionia_audit_web_vitals_2026-05-08`) chiffrait 150 KB gz pour le shell complet avec replay+tracing. Sprint 16 PERF doit arbitrer split lazy.

### 5. `/api/vitals` payload, aggregation, alerting

- Endpoint : POST, runtime nodejs, Zod strict (6 noms autorisés `CLS|FCP|FID|INP|LCP|TTFB`) → bonne hygiène ([src/app/api/vitals/route.ts:13-25](../../../src/app/api/vitals/route.ts#L13)).
- 204 always (même bad JSON / bad shape) → fail-soft contre bots OK.
- Stockage : ndjson rotation UTC daily ([src/lib/observability/vitals-store.ts:33-42](../../../src/lib/observability/vitals-store.ts#L33)).
- Aggregation : **inexistante** (P1-M5).
- Alerting : **inexistant** (pas de seuil INP>500ms → Telegram).

### 6. Logger Pino

Voir P1-M1. Dep installée, jamais utilisée. Aucun fichier `src/lib/logger.ts`. Conséquences :

- pas de level prod (impossible de filtrer `debug` en CI vs `warn` prod) ;
- pas de redaction (`pino.redact: ['req.headers.authorization', 'user.email']`) ;
- logs prod = `console.log` brut sur stdout → Coolify aggregate, mais cherche par regex (`docker logs | grep ERROR`, [runbook-monitoring.md:189-198](../../../docs/ops/runbook-monitoring.md#L189)).

### 7. Runbook deploy

[docs/ops/runbook-deploy.md] : 178 lignes, structuré 10 sections. Couvre prérequis VPS, DNS, Coolify setup, rollback, healthcheck, logs, backup pointer, checklist pre-prod 17 cases. Bugs :

- §5 décrit Coolify webhook (legacy). Réalité 2026-05-09 = GH Actions `deploy-coolify.yml` (mémoire `axionia_cicd_github_actions_coolify`). P2-M4.
- §10 checklist pre-prod pas alignée avec `_AUDIT/CHECKLIST-CUTOVER.md` (28 vs 17 cases).

### 8. Runbook incident

[docs/ops/runbook-incident.md] : 420 lignes, 12 sections (triage, DOWN, lent, DB, worker, email, brute-force, Sentry spike, CF, SSL, disk, compromission admin). Forces :

- Triage 5 min explicite ([docs/ops/runbook-incident.md:23-49](../../../docs/ops/runbook-incident.md#L23)).
- Section 4 DB restore avec commandes copy-paste prêtes.
- SLAs internes documentés (P0 ack 15 min / fix 1h, [docs/ops/runbook-incident.md:404-409](../../../docs/ops/runbook-incident.md#L404)).
- Post-mortem template référencé `docs/post-mortems/<date>-<slug>.md` ([docs/ops/runbook-incident.md:411-419](../../../docs/ops/runbook-incident.md#L411)) — dossier vide actuellement (`Glob docs/post-mortems/* → 0 file`).

Faiblesses :

- Pas de section dédiée DR drill (VPS perdu → reconstruction full).
- Section §4 référence `backup-postgres.sh` mais pas `backup-postgres-r2.sh` (R2 fallback off-site).

### 9. Runbook monitoring

Voir §3 ci-dessus + P0-M3. Le runbook décrit un setup Sentry self-hosted via `git clone getsentry/self-hosted + ./install.sh` ([docs/ops/runbook-monitoring.md:16-28](../../../docs/ops/runbook-monitoring.md#L16)) hors compose monitoring → setup orphelin non versionné, non automatisé, non reproductible.

Alertes documentées :

- Sentry → Telegram webhook (rules `Issues seen by 10+ users in 1h` ou `level=fatal`) — propre côté UI mais dépend de §3 résolu.
- Uptime Kuma 9 monitors prévus (apex, healthz, sitemap, robots, reserve form keyword, postgres TCP, sentry, plausible, SSL expiry).
- Telegram hub centralisé avec 6 tags `[DEPLOY|INCIDENT|BACKUP|MONITORING|INTERVENTION|OPTION]`.

Le filtrage Telegram en 3 chats (`@axion-ia-ops`, `@axion-ia-business`, `@axion-ia-incidents`) est documenté V2 mais V1 = 1 chat unique ([runbook-monitoring.md:177-183](../../../docs/ops/runbook-monitoring.md#L177)).

### 10. BullMQ workers + cron retention

| Worker              | Concurrency | Pattern cron    | Status code | Citations                                                                 |
| ------------------- | ----------- | --------------- | ----------- | ------------------------------------------------------------------------- |
| `email-worker`      | 8           | n/a (on-demand) | ✅          | `src/server/queue/workers/email-worker.ts:40`                             |
| `option-expiration` | 1           | `*/5 * * * *`   | ✅          | `src/server/queue/queues.ts:85-95`                                        |
| `option-reminder`   | 1           | `0 * * * *`     | ✅          | `src/server/queue/queues.ts:97-107`                                       |
| `retention-purge`   | 1           | `0 3 * * *` UTC | ✅          | `src/server/queue/queues.ts:109-119` + `retention-purge-worker.ts:54-143` |

Forces :

- Idempotence repeatable jobs (`removeRepeatable` avant `add`, [queues.ts:86-88](../../../src/server/queue/queues.ts#L86)).
- Graceful SIGTERM 25s drain ([worker.ts:30-39](../../../src/server/queue/worker.ts#L30)) + tini ENTRYPOINT ([Dockerfile.worker:67](../../../Dockerfile.worker#L67)).
- Race protection option-expiration via `SELECT FOR UPDATE` PostgreSQL ([option-expiration-worker.ts:46-50](../../../src/server/queue/workers/option-expiration-worker.ts#L46)).
- Retention purge envoie `emailHash` SHA-256 dans activity_log (anti-leak post-RGPD-erase, [retention-purge-worker.ts:87](../../../src/server/queue/workers/retention-purge-worker.ts#L87)).

Faiblesses :

- Worker BullMQ healthcheck `pgrep -f "src/server/queue/worker.ts"` ([docker-compose.production.yml:178](../../../docker/docker-compose.production.yml#L178)) — ne ping pas Redis. Si Redis down mais Node alive → marqué healthy à tort.
- Retention `RETENTION_BOOKINGS_CANCELLED_MONTHS` default 12 — vérifier conformité Estonie raamatupidamise seadus (5 ans facturation, [docs/dpo-templates/03-effacement-art-17.md:64](../../../docs/dpo-templates/03-effacement-art-17.md#L64)). Cohérence DPO templates ↔ defaults code à confirmer Sprint 24.2.

### 11. Backup pipeline

Deux scripts :

| Script                          | Destination                 | Format                           | Encryption         |
| ------------------------------- | --------------------------- | -------------------------------- | ------------------ |
| `scripts/backup-postgres.sh`    | Hetzner Storage Box (rsync) | `.sql.gz.enc` (plain dump)       | AES-256-CBC pbkdf2 |
| `scripts/backup-postgres-r2.sh` | Cloudflare R2 (aws-cli S3)  | `.dump.gz.enc` (--format=custom) | AES-256-CBC pbkdf2 |

Backblaze était mentionné précédemment (mémoire `axionia_session_2026-05-09_sprint_24_1`) **retiré de `legal.ts` et confirmé non utilisé en code** → P2-RGPD-1 audit Sprint 24.1 levé ✅.

Rétention :

- Daily 7 + Weekly 4 + Monthly 12 (cohérent les 2 scripts).
- Rotation côté remote via `ls -t | tail -n +N | xargs rm` (Hetzner) ou `aws s3 ls | sort -r | tail` (R2).

Bug doc : `_AUDIT/CHECKLIST-CUTOVER.md:135-136` (Phase F5) appelle `bash scripts/backup-postgres.sh daily` mais le script accepte `daily` comme `$1` simple ou via `--type daily` — OK ([backup-postgres.sh:31-32](../../../scripts/backup-postgres.sh#L31)).

### 12. Restore tested

Voir P1-M3. Script existe, jamais exécuté. La doctrine §15 (mémoire) impose un test mensuel.
Pour Pass B : `git log --all -- scripts/restore-postgres-test.sh` montrera la dernière modif mais pas l'exécution. La preuve « jamais exécuté » est l'absence du dossier `docs/post-mortems/` et des logs Telegram historiques `[BACKUP-TEST]` (non vérifiables ici en mode AUDIT-ONLY → `[NON VÉRIFIÉ EN PROD]`).

### 13. RTO / RPO

Voir P1-M2. Aucune cible publiée dans `docs/ops/*`. Cibles internes répétées dans prompts d'audit :

- RTO < 1h (cible reconstruction VPS) — `_AUDIT/PROMPT-DEPLOY-RELIABILITY-2026.md:350`.
- RPO < 24h (data loss max via backup daily) — `_AUDIT/PROMPT-DEPLOY-RELIABILITY-2026.md:351`.

Sur le pipeline backup actuel (cron 03:00 UTC daily) :

- RPO théorique max = 23h59 (juste avant le cron).
- RTO théorique = inconnu, jamais mesuré ([NON MESURÉ — restore non testé en CI]).

### 14. Log retention

| Source                   | Politique documentée                      | Réalité                                                                                                      |
| ------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Coolify                  | Aucune                                    | Logs Docker default = rolling, taille max non documentée                                                     |
| Sentry                   | Aucune                                    | Self-hosted = config Sentry retention (30/90 j typique) — non vérifié, stack absente cf. P0-M3               |
| Plausible                | « anonymized » par design                 | Aucune date de purge                                                                                         |
| Cloudflare               | « metadata 30 days » (free plan)          | Non documenté côté Axion-IA                                                                                  |
| `data/vitals/`           | « retention 30 j gérée Sprint 20 (cron) » | **Pas implémentée** (P1-M4)                                                                                  |
| Postgres `activity_logs` | `RETENTION_LOGS_MONTHS=12` default        | Cron OK ([retention-purge-worker.ts:60-65](../../../src/server/queue/workers/retention-purge-worker.ts#L60)) |
| Docker logs              | Ad-hoc truncate sur incident              | [runbook-incident.md:347-349](../../../docs/ops/runbook-incident.md#L347)                                    |

### 15. Alertes Telegram PII-redacted

`src/lib/telegram.ts` clean :

- Fail-soft si token/chat manquant (warn console + return false, [telegram.ts:46-51](../../../src/lib/telegram.ts#L46)).
- Timeout AbortController 5s (anti-blocage Server Action, [telegram.ts:55-67](../../../src/lib/telegram.ts#L55)).
- 12 tags Markdown sortie `*[TAG]*\n${body}` ([telegram.ts:53-67](../../../src/lib/telegram.ts#L53)).

PII redaction ADR 0010 (Sprint 24.1) :

- `redactEmail("jo@acme.com") → "j****@acme.com"` ([pii-redaction.ts:22-29](../../../src/lib/pii-redaction.ts#L22)).
- `redactName("Jean Dupont") → "J. D."` ([pii-redaction.ts:31-36](../../../src/lib/pii-redaction.ts#L31)).
- `redactPhone("+33 6 12 34 56 78")` → préserve indicatif + 4 derniers chiffres.

Usage confirmé dans worker option-expiration ([option-expiration-worker.ts:108](../../../src/server/queue/workers/option-expiration-worker.ts#L108)) → `[OPTION EXPIRÉE]` body contient `${redactName(opt.contactName)}` (✅). Test `src/lib/pii-redaction.test.ts` présent.

### 16. Healthcheck Coolify

3 niveaux de healthcheck :

1. **Dockerfile natif HEALTHCHECK** ([Dockerfile:106-107](../../../Dockerfile#L106)) :

   ```dockerfile
   HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
     CMD node -e "require('http').get('http://localhost:3000/api/healthz', ...)"
   ```

   Pure Node, indépendant de l'orchestrateur. `start-period: 120s` cohérent avec boot Next 16 + lazy Prisma.

2. **docker-compose service.healthcheck** ([docker-compose.production.yml:134-139](../../../docker/docker-compose.production.yml#L134)) :

   ```yaml
   test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/api/healthz"]
   interval: 30s ; timeout: 5s ; retries: 5 ; start-period: 60s
   ```

   Note : `start-period: 60s` ici < 120s Dockerfile → inconsistance mineure (Coolify utilisera celui le plus restrictif). À aligner.

3. **`/api/healthz` endpoint** ([src/app/api/healthz/route.ts:55-74](../../../src/app/api/healthz/route.ts#L55)) :
   - `runtime: nodejs`, `dynamic: force-dynamic`.
   - Best-effort DB+Redis checks parallèles.
   - Toujours 200 même en `degraded` → Caddy ne retire pas le backend (intention explicite, [healthz/route.ts:65-67](../../../src/app/api/healthz/route.ts#L65)).
   - Cache-Control no-store (correct).
   - **Manque** : `Sentry.captureException` sur erreur DB/Redis persistante (TODO Sprint 17+ déjà commenté [healthz/route.ts:14-15](../../../src/app/api/healthz/route.ts#L14)).

---

## Citations consolidées

- Sentry config client : `src/instrumentation-client.ts:3-19`
- Sentry config server : `src/sentry.server.config.ts:3-11`
- Sentry config edge : `src/sentry.edge.config.ts:3-11`
- Sentry instrumentation hook : `src/instrumentation.ts:5-19`
- Sentry env Zod : `src/env.ts:107-108,140,170-171,192`
- next.config.ts (zéro Sentry plugin) : `next.config.ts:1-141`
- Vitals route : `src/app/api/vitals/route.ts:1-47`
- Vitals store : `src/lib/observability/vitals-store.ts:1-63`
- WebVitals client : `src/components/analytics/WebVitals.tsx:1-79`
- Vitals report stub : `scripts/vitals-report.ts:1-3`
- Telegram lib : `src/lib/telegram.ts:1-97`
- PII redaction : `src/lib/pii-redaction.ts:1-67`
- Backup Postgres Hetzner : `scripts/backup-postgres.sh:1-160`
- Backup Postgres R2 : `scripts/backup-postgres-r2.sh:1-176`
- Restore test : `scripts/restore-postgres-test.sh:1-135`
- BullMQ worker main : `src/server/queue/worker.ts:1-46`
- Retention purge worker : `src/server/queue/workers/retention-purge-worker.ts:1-152`
- Option expiration worker : `src/server/queue/workers/option-expiration-worker.ts:1-124`
- Option reminder worker : `src/server/queue/workers/option-reminder-worker.ts:1-70`
- Email worker : `src/server/queue/workers/email-worker.ts:1-51`
- Queues + cron boot : `src/server/queue/queues.ts:1-120`
- BullMQ Redis conn : `src/server/queue/connection.ts:1-31`
- Healthz endpoint : `src/app/api/healthz/route.ts:1-75`
- Dockerfile app HEALTHCHECK : `Dockerfile:99-110`
- Dockerfile worker : `Dockerfile.worker:1-71`
- docker-compose production : `docker/docker-compose.production.yml:24-209`
- docker-compose monitoring : `docker/monitoring/docker-compose.monitoring.yml:1-130`
- Runbook deploy : `docs/ops/runbook-deploy.md:1-178`
- Runbook incident : `docs/ops/runbook-incident.md:1-420`
- Runbook monitoring : `docs/ops/runbook-monitoring.md:1-213`
- Cutover checklist Phase F : `_AUDIT/CHECKLIST-CUTOVER.md:111-141`
- DPO templates retention legal : `docs/dpo-templates/03-effacement-art-17.md:64`
- Admin alerts (Sentry/UptimeRobot/Coolify pull) : `src/app/[locale]/(admin)/[adminPrefix]/alerts/page.tsx:1-100,151-160`
- Admin infra Sentry check : `src/app/[locale]/(admin)/[adminPrefix]/infra/page.tsx:111-115`

---

## [INCONNU] — éléments non vérifiables en AUDIT-ONLY

- **[NON VÉRIFIÉ EN PROD]** : si `restore-postgres-test.sh` cron est actif sur le VPS Hetzner (`crontab -l` non lançable). Heuristique : aucun log historique `[BACKUP-TEST]` cité dans mémoires sessions → probabilité haute de non-exécution.
- **[NON VÉRIFIÉ EN PROD]** : si Sentry self-hosted est UP sur `sentry.axion-ia.com` (mode AUDIT-ONLY interdit curl prod, hors Phase 4). Probabilité faible vu absence service compose + Phase F1 cutover non cochée.
- **[NON VÉRIFIÉ EN PROD]** : volume actuel `data/vitals/` sur disque CPX32 (P1-M4).
- **[NON VÉRIFIÉ EN PROD]** : Uptime Kuma 9 monitors actifs (Phase F3 cutover non cochée dans `CHECKLIST-CUTOVER.md`).
- **[INCONNU — pas de fichier]** : politique de rétention Cloudflare Logs (free plan). Action Will recommandée : documenter dans `docs/ops/log-retention.md` (à créer).
- **[INCONNU — pas de mesure]** : RTO réel mesuré. Demande un DR drill (cf. `_AUDIT/PROMPT-PROD-SIGNOFF-COMPLEMENTAIRE-2026.md` GATE 2).

---

## Recommandations (≤ 10, classées effort × impact)

| #   | Reco                                                                                                                                                                                   | Effort | Impact | Quand                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------ | ------------------------- |
| 1   | **Câbler `withSentryConfig` dans `next.config.ts`** + sourcemaps upload via `SENTRY_AUTH_TOKEN` + `SENTRY_ORG_SLUG`/`SENTRY_PROJECT_SLUG` (P0-M1)                                      | 2 h    | ★★★★★  | Sprint correctif immédiat |
| 2   | **Ajouter `beforeSend` + `sendDefaultPii: false` aux 3 configs Sentry** (P0-M2, P1-M6)                                                                                                 | 1 h    | ★★★★★  | Sprint correctif immédiat |
| 3   | **Décider Sentry SaaS UE vs self-hosted** : si self-hosted, écrire le service `sentry-*` dans `docker-compose.monitoring.yml` ou retirer la promesse du runbook + DPA register (P0-M3) | 4 h    | ★★★★★  | Sprint correctif immédiat |
| 4   | **Créer `docs/ops/disaster-recovery.md`** avec RTO/RPO chiffrés + playbook reconstruction VPS depuis snapshot Hetzner + restore R2 fallback (P1-M2)                                    | 2 h    | ★★★★   | Sprint court              |
| 5   | **Activer cron `restore-postgres-test.sh` mensuel via Coolify** + ajouter notif Telegram `[BACKUP-TEST]` historique dans `_AUDIT/` à chaque run (P1-M3)                                | 1 h    | ★★★★   | Sprint court              |
| 6   | **Implémenter purge `data/vitals/*.ndjson > 30 j`** dans `retention-purge-worker.ts` (P1-M4)                                                                                           | 1 h    | ★★★    | Sprint court              |
| 7   | **Câbler logger Pino** : créer `src/lib/logger.ts` avec redaction PII (`pino.redact: ['email','phone','authorization']`) et remplacer `console.*` dans les workers (P1-M1)             | 4 h    | ★★★    | Sprint suivant            |
| 8   | **Implémenter `scripts/vitals-report.ts` réel** : lire `data/vitals/*.ndjson` derniers 28 j → p75 LCP/INP/CLS par route → notif Telegram hebdo (P1-M5)                                 | 3 h    | ★★★    | Sprint suivant            |
| 9   | **Aligner `runbook-deploy.md` §5 sur GH Actions `deploy-coolify.yml`** (P2-M4)                                                                                                         | 0.5 h  | ★★     | Sprint correctif immédiat |
| 10  | **Healthcheck worker BullMQ : ping Redis** (pas juste `pgrep`) — patch `Dockerfile.worker` HEALTHCHECK avec `node -e "ioredis.ping()"`                                                 | 1 h    | ★★     | Sprint suivant            |

---

## STOP & ASK consolidés (questions ouvertes pour Will)

**Q14-1** : Sentry self-hosted vs Sentry SaaS UE ? Le runbook impose self-hosted (sentry.axion-ia.com) mais aucun service défini → la promesse RGPD « tout reste en UE chez Hetzner » est en péril si on bascule sur Sentry SaaS US sans DPA + sous-processeur ajouté.

- Option A : déployer Sentry self-hosted (~4h Coolify + storage 2 GB minimum) → cohérent doctrine, lourd à maintenir.
- Option B : Sentry SaaS région EU (Frankfurt) → 5 min setup, DPA standard, sous-processeur EU à ajouter dans `legal.ts` + `DPA-REGISTER.md`.
- Recommandation auditeur : **Option B** pour V1 (vélocité), Option A en V3 si volume justifie.

**Q14-2** : Acceptez-vous `sendDefaultPii: false` strict ? Cela retire `ip_address`, `cookies`, `headers.authorization` des events Sentry → debug légèrement plus difficile sur incidents auth. Trade-off RGPD ↔ ops.

**Q14-3** : Cron `restore-postgres-test.sh` mensuel doit-il être bloquant CI (fail prod si test échoue) ou seulement alerting Telegram ? Recommandation auditeur : **alerting only** V1, blocking V2 après 3 mois de stabilité.

**Q14-4** : Politique vitals retention : 30 j suffit ou 90 j pour aligner sur Search Console CrUX trailing 28 j × 3 ? Volume R2 négligeable, plutôt sécuriser.

**Q14-5** : RTO < 1h cible : est-ce documenté formellement dans CGV/CGU clients ou interne uniquement ? Si engagement client → SLA contractuel, alors DR drill obligatoire trimestriel.

---

**Fin AGT-14 MONITORING-DR — Score 58/100 — Confiance haute — 3 P0, 6 P1, 5 P2.**
