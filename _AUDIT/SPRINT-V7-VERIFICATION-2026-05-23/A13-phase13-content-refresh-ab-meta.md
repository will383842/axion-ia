# A13 Phase 13 — content-refresh worker + A/B meta scaffold

## Statut : STUB-OK (worker env-gated non bootstrapé) + PROD (A/B meta helpers stateless)

Commit cible : `7950826d` "feat(content-gen+seo): phase 13 — content refresh worker + a/b meta scaffold" (Manon, 2026-05-23 21:47).
HEAD audit : `98e7626a`. Branche : `main`.

## Files claimed vs found

Commit `7950826d` (`git show --stat`) annonce 4 fichiers, +215 / -1 :

| Path claimed (commit)                                      | Found sur disque | LOC |
| ---------------------------------------------------------- | ---------------- | --- |
| `src/server/queue/workers/content-refresh-worker.ts`       | OUI              | 91  |
| `src/lib/seo/ab-test-meta.ts`                              | OUI              | 71  |
| `src/lib/seo/__tests__/ab-test-meta.spec.ts`               | OUI              | 48  |
| `src/server/queue/lib/sentry-worker.ts` (ajout WorkerName) | OUI (ligne 98)   | +5  |

Aucun fichier annoncé manquant. Aucun fichier supplémentaire hors-scope.

## Env-gated fallback safe : oui

`content-refresh-worker.ts` :

- Ligne 35 : `const ENABLED_ENV = process.env.CONTENT_REFRESH_ENABLED === "true";`
- Ligne 38-46 : `runRefreshJob` early-return `{scannedCount:0, flaggedCount:0, refreshedCount:0, checkedAt}` si `ENABLED_ENV` false. Log `[content-refresh] disabled (env CONTENT_REFRESH_ENABLED!=true) — skip`.
- Ligne 65-67 : `startContentRefreshWorker()` throw `Error("CONTENT_REFRESH_ENABLED!=true — worker NOT started (env-gated)")` si flag absent → empêche démarrage involontaire en prod.
- Ligne 69-70 : guard `REDIS_URL not set` → cohérent avec contrat stub.invalid build-time (l'erreur ne sera levée qu'au boot worker runtime, pas au build SSG).
- Ligne 73 : `concurrency: 1` + `lockDuration: 1_800_000` (30 min) cohérent cron mensuel long-running.

Fallback safe confirmé : aucun appel Prisma/Redis exécuté tant que le flag est désactivé. Le corps du job est explicitement un stub (commentaires lignes 47-53) avec roadmap Sessions 10+ documentée.

## A/B déterministe (hash-based, pas random) : oui

`ab-test-meta.ts` :

- Ligne 18 : `import crypto from "node:crypto"` (stdlib, pas de dépendance externe).
- Ligne 47-49 : `crypto.createHash("sha256").update(url).digest()` puis `hash[0]! % 2 === 0` → split A/B sur le 1er octet du SHA-256. Pas de `Math.random`, pas de `Date.now`, pas de `Buffer.randomBytes`.
- Test `AB1` ligne 8-13 : assertion explicite "même URL retourne toujours le même variant cross-request".
- Test `AB2` ligne 15-22 : 50 URLs distinctes → set de labels contient bien 2 valeurs (distribution effective).
- Test `AB3` ligne 24-27 : retour appartient strictement à `[VARIANT_A, VARIANT_B]` (pas de troisième objet).

Pattern conforme au commentaire ligne 38-40 : "Googlebot peut crawler la même URL plusieurs fois sur des serveurs différents. Un user qui partage la SERP voit toujours le même variant (cohérent reporting GSC)".

`isUrlEligible` (ligne 59-71) : matching exact + wildcard suffixe `/*` + string vide = global. Tests AB4-AB7 couvrent les 4 chemins.

## Cross-checks

- Worker enregistré dans queue index (`src/server/queue/worker.ts`) : NON. Aucun import de `startContentRefreshWorker` dans `worker.ts`. La liste `workers = [...]` (lignes 55-99) ne le contient pas. Comportement attendu pour un worker env-gated non encore activé, mais à noter : même si `CONTENT_REFRESH_ENABLED=true` est posé en Coolify, le worker ne démarrera pas tant que `worker.ts` n'est pas modifié pour l'inclure. Précédent identique : `gsc-hcu-monitor-worker.ts` (Phase 9) également absent de `worker.ts` selon grep.
- Cron schedule défini : NON. Aucune mention dans `src/server/queue/queues.ts` (`bootRepeatableJobs`). Le commentaire ligne 15 du worker dit "Cron mensuel suggéré : 1er du mois 04h00 UTC" — c'est une intention, pas un câblage. Cohérent avec statut "V1 squelette".
- Queue producer (Queue BullMQ instance pour `content-refresh`) : NON déclaré dans `queues.ts` (grep `content-refresh` zero match).
- WorkerName Sentry (`sentry-worker.ts` ligne 98) : OUI, ajouté. `captureWorkerError("content-refresh", QUEUE_NAME, job, err)` au ligne 78 du worker compile contre le type union.
- Tests vitest : 7 cas AB1-AB7 présents (3 sur `selectMetaVariant` + 4 sur `isUrlEligible`). Aucun test du worker stub lui-même (cohérent avec V1 squelette, pas de logique métier à tester).
- Caller A/B meta (`selectMetaVariant`/`isUrlEligible`) en runtime : NON. Grep `selectMetaVariant|ab-test-meta|isUrlEligible|MetaABTestState|getActiveMetaABTest` dans `src` retourne uniquement les 2 fichiers du commit. Aucune page ni `generateMetadata` ne consomme encore ces helpers. La fonction `getActiveMetaABTest` annoncée dans le JSDoc (ligne 9-10) est ABSENTE du code (jamais exportée).
- Magic string `stub.invalid` : non pertinent ici (worker ne touche pas Prisma/Redis au build).

## Verdict / écarts trouvés

Verdict : **STUB-OK** côté worker (intentionnel, déclaré V1 squelette dans la docstring et le commit message) + **PROD** côté A/B meta helpers stateless (testés, déterministes, utilisables tels quels).

Écarts à signaler :

1. JSDoc du fichier `ab-test-meta.ts` (lignes 9-10) annonce `getActiveMetaABTest(url) → lit ContentGenConfig key="meta_ab_test"`. Cette fonction n'existe pas dans le code livré. À retirer du JSDoc ou implémenter en Session 10+.
2. `startContentRefreshWorker` non câblé dans `worker.ts` même en tant que candidat conditionnel — quand le flag sera passé à `true` en Coolify, il faudra aussi modifier `worker.ts`. Précédent identique avec `gsc-hcu-monitor-worker` (Phase 9). Documenter dans les "Actions Will" futures.
3. Aucun consommateur des helpers A/B meta dans la base. Le scaffold est utilisable mais inerte tant qu'aucune `generateMetadata` ne l'appelle. Cohérent avec scope "scaffold" annoncé dans le titre du commit.

Aucun écart bloquant. Conformité commit message ↔ code livré : haute. Conformité scope sprint v7 Phase 13 ("env-gated stub" attendu) : haute.
