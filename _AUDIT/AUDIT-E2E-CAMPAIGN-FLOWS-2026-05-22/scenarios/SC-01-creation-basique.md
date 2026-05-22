# SC-01 — Création campagne basique sans preset

**Date** : 2026-05-22
**HEAD** : `e7c40004`
**Mode** : Audit code-level (runtime non disponible — voir VERDICT §Mode)
**Verdict** : 🟢 OK (code)

## Préconditions

- Admin connecté sur `/[adminPrefix]/content-gen/coverage/new`
- DB axion_ia_dev disponible (en runtime)
- Aucune campagne `TEST_E2E_01_basic` préexistante

## Étapes prévues

1. Wizard étape 1 : `name='TEST_E2E_01_basic'`, verticale `audits`, scope `national`
2. Étape 2 : `typeDistribution = { blog_from_keywords: 100 }`, `audienceMix = { pme: 100 }`
3. Étape 3 : `totalTargetCount = 1`
4. Étape 4 : submit
5. Attente ~5 min

## Cartographie code

| Étape                        | Fichier                                                           | Lignes  | Comportement                                                                           |
| ---------------------------- | ----------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------- |
| Server Action createCampaign | `axionia/src/server/actions/content-gen/coverage.ts`              | 232-320 | Validation Zod + `prisma.coverageCampaign.create()` + `revalidatePath` + `logActivity` |
| Worker orchestrator          | `axionia/src/server/queue/workers/content-orchestrator-worker.ts` | 1-180   | Lit campagnes `running` + enqueue `content-gen-jobs` BullMQ                            |
| Worker generator             | `axionia/src/server/queue/workers/content-gen-worker.ts`          | —       | Génère article via `getGenerator(contentType)`                                         |
| Worker publish               | `axionia/src/server/queue/workers/content-publish-worker.ts`      | 77-696  | INCR Redis daily cap + publish + revalidate cascade                                    |

## Invariants vérifiés (statique)

- ✅ Validation Zod stricte (`coverageCampaignSchema`)
- ✅ Status initial = `draft` ou `scheduled` selon `startDate`
- ✅ Status passe à `running` au launch
- ✅ Audit log SOC2 `logActivity` à chaque transition
- ✅ Rate-limit chokepoint sur createCampaign Server Action

## Résultat attendu (runtime, NON exécuté)

- DB row `coverage_campaigns` status=`running`, `total_target_count=1`
- BullMQ : 1 job enqueued sur `content-gen-jobs`
- Article généré → quality_check → published
- URL `/fr/blog/<slug>` retourne 200

## Tests vitest existants

- `axionia/src/server/actions/content-gen/__tests__/coverage-controls.spec.ts:131-207` (cityProcessingMode defaults, status draft, validation Zod)
- `axionia/src/server/queue/workers/__tests__/content-publish-worker-throttle.spec.ts` (drip + cap)

## Verdict 🟢 OK (code)

Câblage complet du déclenchement (wizard) à la publication. Aucun gap critique. Couverture vitest présente sur le chemin admin → DB. **Non exécuté en runtime** (Docker daemon absent, dev server absent, clés LLM absentes en `.env.local`).
