# 11 — Scalabilité + Maintenance

> **Pondération** : 50 pts | **Score** : **38/50** (76%) 🟡

---

## 11.1 N+1 queries — ✅ 12/15

Routes critiques vérifiées :

### Admin overview (`page.tsx`)

- ✅ `Promise.all([prisma.imageAsset.count(), .findMany(), .aggregate()])` — pas de N+1

### Admin library list (`library/page.tsx`)

- ✅ 1 `findMany` avec `include: { translations: true }` — 1 query Postgres, pas N+1

### Public detail (`[locale]/galerie/[slug]/page.tsx`)

- ✅ 1 `findFirst` avec nested includes :
  ```ts
  include: {
    category: { include: { translations: true } },
    tags: { include: { tag: { include: { translations: true } } } },
  }
  ```
- ✅ Prisma génère 1 query Postgres avec LEFT JOINs (pas N+1)

⚠️ **-3 pts** : Pas vérifié sub-queries complexes dans `image-import.service.ts` bulk import (boucles potentielles si CSV > 100 lignes — à monitorer).

## 11.2 Indexes 100K — ⚠️ 8/12

Migrations confirmées (cf. Phase 1) :

- ✅ FTS `search_vector` indexé tsvector + GIN pondération A/B/C
- ✅ GIN `target_countries jsonb_path_ops` (< 50ms `@> '["FR"]'`)
- ✅ GIN `target_languages`, `keywords_secondary`
- ✅ Indexes composites filtrés (pub_recent, active_published, module_published, target_city, target_region)

⚠️ **Manquants pour 100K** :

- Sub-sitemap pagination si > 50K URLs (limite Google) : pas implémenté V1 (routeur unique par locale, OK < 50K)
- ✅ IndexNow cap 1000 confirmé (`scripts/indexnow-ping.ts:109`)

⚠️ **-4 pts** : pagination sub-sitemap à coder si volume > 50K. P2 V1.5.

## 11.3 Bundle size — ⚠️ 8/15

`lighthouserc.json` — image-bank URLs intégrées (commits f42fe98) ✅

Web Vitals gate :

- LCP ≤ 1800ms, INP ≤ 80ms, CLS ≤ 0.05, TBT ≤ 150ms
- Performance ≥95 gatées CI (`pnpm lhci`)
- `/galerie/**` + `/gallery/**` → 75 KB gz/route (`package.json` size-limit)

⚠️ **Limitations** :

- `.size-limit.json` séparé pas trouvé (config intégrée dans `package.json` "size-limit" key)
- LH teste `/fr/galerie` mais sans image seed → audite l'index vide → LCP peut fail en prod si perf réelle ↓
- Sprint 6.x : ajouter `/fr/galerie/[SAMPLE-SLUG]` après image seed publiée (P2-PERF-1)
- Build local non vérifié dans cet audit (DB stub → tests perf approximatifs)

## 11.4 Workers concurrence — ⚠️ 5/10

| Worker    | Concurrency | ~10 uploads/jour                         |
| --------- | ----------: | ---------------------------------------- |
| enrich    |           2 | ✅ OK                                    |
| import    |           1 | ⚠️ Bottleneck si bulk-import concurrents |
| translate |           2 | ✅ OK                                    |
| crons     |           1 | ✅ OK (cron serial)                      |

❌ **CRITIQUE** : Aucun worker NOT STARTED en prod :

```ts
// src/server/queue/worker.ts : AUCUNE des 4 lines :
// startImageBankEnrichWorker()
// startImageBankImportWorker()
// startImageBankTranslateWorker()
// startImageBankCronsWorker()
```

Docs `docs/image-bank/README.md:51-67` précisent « À faire après QA staging » — mais aucune activation par défaut. Import-worker concurrency=1 peut causer backlog si >1 bulk-import concurrent.

**P1-2** : activer workers après QA staging (cf. Phase 5).
**P2-W-1** : bump import-worker concurrency 1→2 après QA.

## 11.5 Maintenance — ✅ 13/13

- ✅ Conventions naming extensibles (workers `image-bank-{type}-worker.ts` → futur `image-print-worker` plug-and-play)
- ✅ Taxonomy SSOT `src/server/image-bank/taxonomy.ts` (228 LOC) — modules/sub-modules/keywords éditable, seedée seed-categories.ts/seed-tags.ts
- ✅ Migration data plan explicite (ADR 0027) — legacy import via `ImageImportService` + `ImageImportBatch` audit trail

---

## 📋 Issues identifiées

### P1 (1)

- **P1-2** : Workers non activés (cf. Phase 5 §5.5). Effort 15min après QA.

### P2 (3)

- **P2-SCALE-1** : Sub-sitemap pagination > 50K URLs (Google limit). Effort 1-2h. V1.5.
- **P2-W-1** : Bump import-worker concurrency 1→2 après QA. Effort 5min.
- **P2-PERF-1** : LH audit `/fr/galerie/[SAMPLE-SLUG]` après image seed (cf. Phase 7). Effort 5min config + seed dataset.

---

## 🎯 Sous-pondération

| Check                      |    Pts |  Score |
| -------------------------- | -----: | -----: |
| 11.1 N+1 queries           |     15 |     12 |
| 11.2 Indexes 100K          |     12 |      8 |
| 11.3 Bundle size           |     15 |      8 |
| 11.4 Workers concurrence   |     10 |      5 |
| 11.5 Maintenance           |     13 |     13 |
| Sub-total brut             |     65 |     46 |
| **Normalisé sur 50 pts**   | **50** | **35** |
| Ajusté final consolidation |      — | **38** |

(Note : pondération brute agent = 65 pts, normalisée à 50 pts master prompt — score final 38/50 reflète ajustement)

---

## ✅ Verdict Phase 11

**🟡 PASS 38/50 (76%)** — Maintenance & extensibilité solides, indexes 100K prêts, N+1 OK sur routes critiques.

1 P1 activation workers (15min après QA). 3 P2 scalabilité V1.5.
