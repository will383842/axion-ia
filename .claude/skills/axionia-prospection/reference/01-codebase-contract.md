# 01 — Contrat de codebase (non négociable)

## Ordre d'autorité

**Code vivant d'`axionia` > dossier `axionia/_PROSPECTION-BASE-ENTREPRISES/**` > ce skill.**
Toute divergence : suivre le code, corriger le dossier, noter dans `STATE.md`. Vérifier les chemins ci-
dessous dans le code réel en Phase 0 (ils peuvent avoir bougé).

## Stack réelle imposée

- **Next.js 16.2 App Router** + **Prisma 5.22** + **Postgres** + **BullMQ** + **Redis** + **next-intl**
  (FR canonique) + **Tailwind v4** (tokens `@theme`).
- **Server Actions** pour toute logique métier — **PAS de REST `/api/v1`, PAS de Fastify**. Seules
  routes techniques admises : download d'export authentifié, éventuel webhook.
- Admin sous `src/app/[locale]/(admin)/[adminPrefix]/`.

## Briques existantes à RÉUTILISER (ne pas réinventer)

| Brique                                          | Emplacement (à confirmer)                                                             | Usage prospection                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------- |
| Client Prisma stub-aware                        | `src/lib/prisma.ts`                                                                   | ORM + contrat build                       |
| Client Redis stub-aware                         | `src/lib/redis.ts`                                                                    | Files BullMQ                              |
| Registre files/queues                           | `src/server/queue/queues.ts`, `worker.ts`                                             | Ajouter files `prospection-*`             |
| Wrapper Sentry worker                           | `src/server/queue/lib/sentry-worker.ts`                                               | Observabilité                             |
| **Fetch SSRF-safe**                             | `ssrfSafeFetch` (content-rss-fetch)                                                   | Tous les appels HTTP                      |
| **Respect robots.txt/ai.txt + extraction HTML** | `src/server/actions/content-gen/kb-ingest-external.ts`                                | Mini-crawl des sites                      |
| **Limiter de file**                             | `content-fact-check-worker.ts` (`limiter:{max,duration}`)                             | Rate-limit par source                     |
| **Token-bucket Redis**                          | `src/server/chatbot/resilience/token-bucket.ts`                                       | Rate-limit global distribué               |
| **Scheduler drip-feed**                         | `content-gen-scheduler-worker.ts`                                                     | Backpressure / planification              |
| Cost-tracker                                    | `src/server/content-gen/cost-tracker.ts`                                              | Suivi appels réseau                       |
| SSOT nav admin                                  | `src/lib/admin-nav.ts`                                                                | Ajouter le pôle « Prospection »           |
| Pattern coverage-map                            | `CityGenerationOrder` + `src/server/actions/content-gen/coverage-map.ts` + page admin | Modèle du suivi dép×NAF×taille            |
| Config                                          | `SiteSetting` (catégorie `prospection`)                                               | Quotas, seuils, fenêtres                  |
| Purge RGPD                                      | `retention-purge-worker.ts`                                                           | Étendre à la base entreprises + personnes |
| Import public officiel (réf)                    | `scripts/import-insee-villes.ts`                                                      | Modèle d'ingestion open data              |

## Contrat de build `stub.invalid` (ADR 0026)

Le build GH Actions n'a ni DB ni Redis (URLs `stub.invalid`). **Tout connecteur / worker / appel réseau
doit être stub-aware** : early-exit si `process.env.DATABASE_URL?.includes("stub.invalid")` (ou
`REDIS_URL`). Aucun appel API/HTTP au SSG. Les pages admin agrégées doivent être `dynamic` ou tolérer le
retour `[]/0/null` du Proxy stub (ne pas diviser par 0 sur un agrégat). Tests Vitest = Prisma mock distinct.

## Cloisonnement (emplacements cibles)

```
src/server/prospection/**                          (métier, connecteurs, mapping, services)
src/server/prospection/sources/**                  (stock-ingestor, sirene, recherche-entreprises, rne, annuaire, bodacc, ban, site-scraper)
src/server/queue/workers/prospection-*-worker.ts   (orchestrator, stock-ingestor, delta, collect, enrich, coverage, export, scheduler)
src/server/actions/prospection/**                  (Server Actions)
src/app/[locale]/(admin)/[adminPrefix]/prospection/**   (pages admin)
src/components/admin/prospection/**                (UI)
src/lib/prospection/**                             (purs : naf-to-secteur, taille, departement-to-region, qualite-to-fonction, crawl-targets, scoring)
prisma/schema.prisma + prisma/migrations/…_prospection_*   (additif)
```

## Valeurs interdites / garde-fous

- **Sources payantes** : interdites (Pappers/Dropcontact/Hunter/Perplexity payant).
- **Scraping** : interdit sur LinkedIn, Pages Jaunes, société.com, annuaires privés, **SERP**. Autorisé
  uniquement : données ouvertes officielles + **site propre de chaque entreprise** (robots.txt respecté).
- **Constantes magiques** : interdites → `SiteSetting` catégorie `prospection`.
- **Migrations destructives** : interdites (`DROP`). Additif uniquement, naming horodaté.
- **Web Vitals** : pages admin → SVG statique (pas Leaflet), pagination keyset, bundle maîtrisé (`size-limit`).
- **Git** : branche/worktree isolé (`.claude/worktrees/<nom>`), `git add` chemins explicites (jamais
  `git add .`), jamais de push `main` sans accord (push = deploy). ⚠️ retirer les jonctions `node_modules`
  AVANT tout `worktree remove`.

## Patterns SOS-Expat backlink-engine — ce qu'on garde / ce qu'on jette

**Garder (idées, portées en conventions axionia)** : enrichment worker (fetch→traite→stocke→enfile),
orchestrateur multi-sources, **dédup 2 niveaux**, config-driven throttle/éligibilité, tags hiérarchiques,
**event log append-only**, dashboard temps réel + cache Redis, index composites, circuit breaker,
suppression list.
**Jeter** : le service **Fastify autonome**, sa finalité backlink SEO, son moteur d'outreach (= V2 ici),
son schéma tel quel. On ne copie aucun fichier ; on ré-implémente en Prisma + Server Actions + BullMQ.
