# B-09 — Observabilité

**Score : 19/25**
**Verdict : CONDITIONAL — Sentry câblé propre, correlationId acquis core, logs structurés inégaux**

## Sentry config

### Server (`src/sentry.server.config.ts`)

- DSN via `process.env.SENTRY_DSN` `:4` (init opt-in si absent)
- `tracesSampleRate: 0.02` prod (P6 V-04 Sprint Correctif), `1.0` dev `:15` — alignement budget audit V-04
- `environment` via `NEXT_PUBLIC_APP_ENV` `:16`
- `release` priorité `SENTRY_RELEASE → npm_package_version` `:20` (méta-cert 2026-05-15)
- **`sendDefaultPii: false`** `:22` ✅ (RGPD art. 32)
- `beforeSend: piiScrubBeforeSend` `:23` (scrub PII custom)

### Edge (`src/sentry.edge.config.ts`)

- Cohérent server config
- `tracesSampleRate: 0.1` prod (pas 0.02 — divergence avec server, à harmoniser)

### Client (`src/instrumentation-client.ts`)

- **Lazy-load** `:30` via `initSentryLazy()` (init différée `requestIdleCallback` + 3s fallback `:84-101`)
- `defaultIntegrations: false` `:47` + 6 integrations slim selectionnées `:48-55` (économie ~80-100 KB raw)
- `tracesSampleRate: 0` `:56` — RUM client OFF (cohérent : RUM Web Vitals via `src/lib/observability/web-vitals.ts` côté maison)
- `replaysSessionSampleRate: 0`, `replaysOnErrorSampleRate: 0` `:65-66` — Replay OFF (build bundle)
- `sendDefaultPii: false`, `beforeSend: piiScrubBeforeSend` `:67-68`

**Trade-off documenté `:13-14`** : erreurs durant 3 s pré-init perdues — acceptable V1 vs gain LCP.

## Helper sentry-worker

`src/server/queue/lib/sentry-worker.ts:83` `captureWorkerError(workerName, queueName, job, err)` :

- Tags `worker`, `queue`, `jobId`, `jobName`
- Extras PII-safe via `sanitizeJobData(job.data)` `:110`
- **Fingerprint déterministe** `[workerName, errName, errMsg.slice(0,100)]` `:116` → groupage dashboard
- **Fail-soft** `:118-126` : crash interne Sentry ne cascade pas

Couverture : 12/33 workers (cf. B-01 finding P1 #1).

## correlationId propagation

Champ DB `ContentGenJob.correlationId` (P6 acquis) — UUID v4 généré par orchestrator.

Workers loggant correlationId :

- `content-orchestrator-worker.ts:140` `correlationId = crypto.randomUUID()`
- `content-gen-worker.ts:177-178` `console.log("[gen] correlationId=", ...)`
- `content-publish-worker.ts:317-318` `console.log("[publish] correlationId=", ...)`

Test : `src/server/queue/workers/__tests__/correlation-id.test.ts` présent ✅.

→ End-to-end traçabilité orchestrator→gen→publish acquise (Sprint Correctif P6 Item 3).

## tokensInput non-hardcodé 0

**Mémoire P2 P1-4 mentionne `tokensInput non-hardcodé 0`** ; vérification :

- `content-gen-worker.ts:538` : `tokensInput: 0, // détaillé via CostLedger` — **HARDCODÉ 0** dans ContentGenJob.update
- CostLedger reçoit bien la vraie valeur via `trackCost()` (`cost-tracker.ts:258`)

→ **Divergence avec mémoire** : sur `ContentGenJob`, `tokensInput` reste 0 (les vrais comptes vivent dans CostLedger). UI admin doit jointer CostLedger pour afficher input. Pas un blocant mais source de confusion (P1-4 partiellement adressé).

## Logs structurés

`src/server/content-gen/shared/generation-log.ts` (vu indirectement via `logStep()`, `logStepError()`) — table DB `ContentGenLog` (présumée) avec step + message + JSON context. Excellent pour audit trail.

Workers utilisent largement `logStep(jobId, step, message, ctx)` (content-gen-worker `:179`, `:236`, `:268`, `:328`, …).

**Mais** : `console.log/warn/error` aussi présents (`content-publish-worker.ts:141-152`, `:701`, `content-orchestrator-worker.ts:223-226`, `:285-287`). Pas de pino/winston JSON structured logger.

## console.log debug prod

Grep `console\.log` dans workers : présence importante mais **majorité = log opérationnel structuré JSON** (ex `content-publish-worker.ts:142-149` `JSON.stringify({event: "publish_throttled", ...})`).

Cas problématiques (debug oublié) : aucun trouvé dans l'échantillon parcouru ; cleanup P2 P1-3 (mémoire) appliqué.

## Findings

### P0

Aucun.

### P1

1. **`tokensInput` hardcodé 0 sur ContentGenJob** (`content-gen-worker.ts:538`) — l'audit P2 P1-4 acquis est partiel : la donnée vit dans CostLedger mais l'UI/queries Job direct ne le voient pas. À affecter `output.totalTokens * 0.7` ou similaire si exactement aligné avec provenance-logger `:484`.
2. **Edge tracesSampleRate divergent 0.1 vs server 0.02** (`sentry.edge.config.ts:9`) — incohérence budget Sentry.
3. **Sentry coverage workers 12/33** (cf. B-01) — gap critique sur fact-check, image-bank-\*, monitoring.

### P2

4. **Pas de logger structuré dédié** (pino/winston) ; mix `console.log` + `logStep()` DB. Acceptable mais Coolify logs/Loki ingestion serait plus propre.
5. **3 s gap d'erreurs client pré-init Sentry** documenté trade-off — petit (~5 % nav initiale impactée).
6. **`SENTRY_DSN` non-throw si absent** (`sentry.server.config.ts:6` `if (dsn)`) — OK mais env prod doit valoir vrai DSN, sinon obs silencieuse.

## Verdict paragraphe

**Sentry bien configuré côté server/edge/client** : DSN gated, PII scrub, sample rate aligné budget V-04, lazy-load client. **correlationId end-to-end acquis** via UUID v4 orchestrator → gen → publish. **Bémols sérieux** : worker coverage Sentry 12/33 (cf. B-01), `tokensInput` hardcodé 0 (P1 partiel), pas de logger structuré JSON. **19/25** — perte 6 points sur les 3 P1 + logger structuré absent.
