# R-09 — MONITORING CHAIN

## Diagramme ASCII

```
Erreur prod (app code / route handler / server action)
        │
        ▼
┌────────────────────────────────────┐
│ Sentry runtime init :              │
│   instrumentation-client.ts        │
│   src/sentry.server.config.ts      │
│   src/sentry.edge.config.ts        │
│ ⚠️ withSentryConfig ABSENT next.cfg│
│ ⚠️ beforeSend absent (PII fuite)   │
│ ⚠️ sourcemaps non upload (minified)│
│ ⚠️ Sentry self-hosted promis mais  │
│    inexistant compose monitoring   │
└────────────────┬───────────────────┘
                 │
                 ▼
┌────────────────────────────────────┐
│ Pino logger installé mais          │
│ 0 import code → tout console.log   │
└────────────────┬───────────────────┘
                 │
                 ▼
┌────────────────────────────────────┐
│ Alertes ? alertOps / alertIncident │
│ → AGT-14 P2 : dead code            │
│ → Telegram alert manual via lib/   │
│   telegram.ts + PII redaction      │
└────────────────────────────────────┘

Web Vitals beacon :
  Browser web-vitals 5.2 → /api/vitals POST
  → store ndjson dans data/vitals/*.ndjson
  ⚠️ AGT-14 P1 : pas de purge (retention 30j annoncée non implémentée)
  ⚠️ scripts/vitals-report.ts = stub 3 lignes

Health :
  /api/healthz GET → {status, db, redis, version}
  Coolify healthcheck interval (à confirmer ON)
```

## Findings clés (AGT-14)

1. **AGT-14 P0-M1** Sourcemaps Sentry jamais uploadées (croisé AGT-12 P0-1) — stacks prod minifiées illisibles.
2. **AGT-14 P0-M2** Aucun PII scrub Sentry → IP, cookies, headers Authorization fuient → conflit RGPD (croisé AGT-09 P1).
3. **AGT-14 P0-M3** Sentry self-hosted promis dans commentaires `docker/monitoring/docker-compose.monitoring.yml` mais inexistant → faux signal documentation.
4. **AGT-14 P1** Pino installé mais 0 import → tout en `console.log`.
5. **AGT-14 P1** RTO/RPO absents `docs/ops/`.
6. **AGT-14 P1** `restore-postgres-test.sh` jamais exécuté (Phase F6 cutover non cochée).
7. **AGT-14 P1** `data/vitals/*.ndjson` sans purge.
8. **AGT-14 P1** `scripts/vitals-report.ts` stub 3 lignes.
9. **AGT-14 P1** `onRequestError` capture err brut sans scrub.

## Cohérence chaîne

✅ /api/healthz fonctionnel et utilisé par Coolify.
✅ Vitals endpoint ingère les beacons (mais sans aval).
✅ Telegram alert manual avec PII redaction.
⚠️ Monitoring = trous noirs : sourcemaps absentes, PII scrub absent, Sentry self-hosted fantôme, Pino non utilisé, vitals sans purge. **C'est le plus faible domaine du E2E (58/100)**.
⚠️ Si incident prod, **investigation très handicapée** (stacks minifiées + breadcrumbs PII).
