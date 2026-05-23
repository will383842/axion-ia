# BOTTLENECKS DÉTECTÉS — Audit E2E Campaign Flows

**Date passe 1 (code)** : 2026-05-22
**Date passe 2 (runtime)** : 2026-05-23 — **mesures partielles ajoutées en §RUNTIME**

---

## RUNTIME OBSERVATIONS 2026-05-23

Cette deuxième passe a démarré Docker + Postgres + Redis + Next.js dev. Quelques bottlenecks **mesurés** (curl, prisma queries) :

| #   | Étape mesurée                                  | Latence observée             | Latence inférée code-level | Statut       |
| --- | ---------------------------------------------- | ---------------------------- | -------------------------- | ------------ |
| R1  | Cold compile Turbopack page                    | 17-31 s (cold), 1-3 s (warm) | non documenté              | 🟡 cold path |
| R2  | Prisma query `\d` schema introspection         | < 100 ms                     | < 100 ms                   | 🟢 conforme  |
| R3  | Redis `PONG` ping                              | < 5 ms                       | non mesuré                 | 🟢 conforme  |
| R4  | HTTP `/sitemap-news.xml` (route handler)       | < 100 ms                     | non mesuré                 | 🟢 conforme  |
| R5  | HTTP `/fr/audits/paris` (warm)                 | 1.7 s                        | non documenté              | 🟢 conforme  |
| R6  | HTTP `/fr/audit/par-ville/paris` (cold)        | 31 s                         | non documenté              | ⚠️ cold path |
| R7  | DB connection pool startup                     | < 1 s                        | non mesuré                 | 🟢 conforme  |
| R8  | `pnpm db:up` (containers start)                | ~5 s (idempotent)            | N/A                        | 🟢 conforme  |
| R9  | `pnpm prisma migrate deploy` (no pending)      | ~2 s                         | N/A                        | 🟢 conforme  |
| R10 | `pnpm tsx seed-campaign-templates` (8 upserts) | ~3 s                         | N/A                        | 🟢 conforme  |

### Limites de la passe runtime

Les latences LLM (génération article, fact-check, embeddings) **n'ont pas été mesurées** car aucune campagne TEST*E2E* n'a été déclenchée live (budget tokens ~$0.50/article, ~$15 pour 30 articles, non engagé sans validation Will explicite — le worker BullMQ a aussi crashé au boot tsx sous Windows).

Pour mesurer les latences LLM réelles : exécuter SC-01 (1 campagne TEST_E2E avec `totalTargetCount=1`) sur WSL2 (esbuild stable) ou résoudre crash tsx sous Windows.

### Cold path Turbopack — implication runtime prod

Les latences cold 17-31 s observées sont liées à Turbopack compile-on-demand en dev. En prod (Next.js build SSG + ISR), ces routes sont pré-rendues et la latence cold est inexistante. **Pas un bottleneck prod**.

---

## ARCHIVE PASSE 1 (analyse statique)

**Mode initial** : analyse statique (latences réelles non mesurées)

## Mode

Cet audit n'ayant **pas pu exécuter les scénarios en runtime** (Docker daemon absent, dev server absent, clés LLM absentes en `.env.local`), les bottlenecks ci-dessous sont **inférés du code** (paramètres de timeout, lockDuration, retries, concurrence) et de la documentation interne (mémoires, ADRs).

Pour une mesure réelle, exécuter le pipeline runtime en monitoring Sentry / OpenTelemetry pendant 24h prod.

## Bottlenecks inférés (latence)

| #   | Étape                                      | Latence inférée (code)  | Cible saine | Source                                               | Impact                                   |
| --- | ------------------------------------------ | ----------------------- | ----------- | ---------------------------------------------------- | ---------------------------------------- |
| 1   | Génération article LLM (Claude Sonnet 4.6) | 15-45s par appel        | < 30s       | Anthropic API typical, `lockDuration: 120s` réservé  | Cost direct + UX wizard                  |
| 2   | LLM-judge review                           | 10-30s par review       | < 20s       | rubric 7 dims, Claude Sonnet                         | Boucle qualité × 2-3 iter (cumul 30-90s) |
| 3   | Fact-check Perplexity                      | 10-30s par claims batch | < 10s       | extractClaims + Perplexity API, `lockDuration: 120s` | Bloque publish gate                      |
| 4   | OpenAI embeddings (3-large)                | 1-3s par article        | < 2s        | Embeddings sync pour dedup                           | Faible                                   |
| 5   | IndexNow ping (HTTP POST)                  | 100-500ms par URL       | < 1s        | api.indexnow.org direct                              | Faible                                   |
| 6   | revalidateContent POST                     | 200-1000ms par batch    | < 1s        | `/api/internal/revalidate` interne                   | Multi-targets cascade                    |
| 7   | BullMQ enqueue latency                     | < 10ms                  | < 50ms      | Redis local                                          | Négligeable                              |
| 8   | Sitemap-blog DB read SSG                   | 1-5s par build          | < 5s        | findMany Article tier-1                              | Build seulement                          |
| 9   | Prisma queries hot path                    | < 50ms typiques         | < 100ms     | Connection pool Coolify                              | Faible                                   |
| 10  | Telegram alert fire-and-forget             | < 100ms (catch swallow) | < 500ms     | sendTelegram lib                                     | Non bloquant                             |

## Goulots architecturaux

### G1 — Boucle qualité × iter

- D2 : 3 iter pour `guide_pilier`+`landing_ville`, 2 iter autres
- Chaque iter = nouvelle génération Claude (15-45s) + nouvelle review (10-30s) = ~45s
- **3 iter = ~135s par article quality_improving**
- Impact : cap journalier 30 articles → ~70 min cumul pure-quality si tous improvers triggered
- Mitigation : seuil acceptation 60/100 (D-P5-2) limite déclenchement boucle

### G2 — Drip window throttling

- Window 8h-22h CET (14h actives)
- Cap 30/jour → 1 publish toutes les ~28 min (uniforme)
- À mesure rampe ≥ 600 art → 500/jour = 1 toutes 1.7 min
- **Risque** : si Redis INCR rate-limited (édge case), publish queued
- Code : `axionia/src/server/queue/workers/content-publish-worker.ts:138-154`

### G3 — Multi-targets revalidate cascade (V-01)

- 1 article × jusqu'à 20 villes mentionnées × 5 routes hubs = **100 paths revalidate** max
- POST batch unique, mais size payload croît linéairement
- Latence cumulée 200ms-2s selon Coolify load
- Mitigation : max 20 mentionedCities ; lazy import getVille()
- Code : `axionia/src/server/queue/workers/content-publish-worker.ts:623-696`

### G4 — Sequential mode latence

- 3 villes × 2 articles × ~3 min/article (génération + qualité + publish) = **~18 min séquentiel**
- Orchestrator tick toutes N minutes (cf. SC-11 cycle)
- Compromis : prédictibilité ordre vs débit total

### G5 — External-links monthly cron HEAD checks

- Worker `external-links-monitor-worker.ts:219-354`
- 11 sources × 1 HEAD/source ≈ instantané
- Mais : extension catalogue 94→2400 (cible Perplexity) → **2400 HEAD requests = ~5-15 min**
- Acceptable car cron mensuel hors heures de pointe

### G6 — Sitemap chunkage

- Auto-chunk 1000 URLs/fichier
- Au-delà 100 000 URLs → sitemap-index avec 100+ sub-sitemaps
- Build SSG impact : DB reads cumulés
- Stub Proxy build-time (ADR 0026) atténue (returns empty arrays)

## Économie cost-cap

| Provider                      | Coût marginal/article | Cap typique mois (P50) | Articles théoriques/mois |
| ----------------------------- | --------------------- | ---------------------- | ------------------------ |
| Anthropic (Claude Sonnet 4.6) | $0.02-0.05            | $200                   | ~5 000                   |
| Perplexity (factcheck)        | $0.005                | $50                    | ~10 000                  |
| OpenAI (embeddings 3-large)   | $0.0002               | $20                    | ~100 000                 |
| Unsplash                      | $0                    | gratuit                | ∞                        |

**Bottleneck cost** : Claude Sonnet (× 2-3 iter qualité) — risk d'épuisement cap en 5-10j sous rampe agressive 500/jour. Acquis SC-29 kill-switch en cascade.

## Recommandations runtime

1. **Activer Sentry monitoring perf** sur 5 chemins critiques (gen-worker, judge, factcheck, publish, indexnow) — déjà câblé S+4 P1 commit `dbac155`
2. **Tester runtime** : `pnpm db:up` + dev server + LLM keys → exécuter SC-01 d'abord → mesurer T0..T(publish) — comparer à inférence ci-dessus
3. **OpenTelemetry traces** distribué chemin complet wizard → publish ; sample 2% prod (ADR existant)
4. **Bench cap journalier** : Redis-benchmark INCR à 100 req/s vs production load
