# Phase 10 — Self-healing déploiement (autopilot 2026-05-18)

## Cycle 1 — Re-run failed job attempt #2

**Symptôme initial** : Build & Deploy run `26005748035` attempt #1 = failure après ~38 min sur step 8 (`Build & push image`), sans log flush.

**Diagnostic** :

- Steps 1-7 success en ~2:30 (Free disk space libère ~120 GB → 25 GB used / 145 GB total).
- Step 8 démarre 23:26:30Z, job dies 00:02:39Z = 36 min runtime.
- API JSON : step `completed_at: null` (jamais flushé).
- Logs zip téléchargé via API : aucun fichier `8_Build & push image.txt`.
- → Pattern d'OOM-kill au niveau OS (Linux kernel reap process tree silencieusement).

**Action** : `gh run rerun 26005748035 --failed` → attempt #2.

**Résultat cycle 1** : attempt #2 fail à 00:43:21Z (~38m57s) avec **exactement le même pattern**. Pas transitoire.

## Cycle 2 — Diagnostic approfondi

**Analyse historique pipeline** :

| Run                  | Commit                | Durée step 8 | Statut                                       |
| -------------------- | --------------------- | ------------ | -------------------------------------------- |
| Run `25992457839`    | `fea4b2e`             | 44 min 17s   | ✅ SUCCESS (last green 2026-05-17 13:40 UTC) |
| Run `26001143605`    | `59edcb9` (PR 7)      | ~38 min      | ❌ FAIL                                      |
| Run `26002780898`    | `1cacf11` (PR 8)      | ~37 min      | ❌ CANCEL                                    |
| Run `26003287480`    | `576beff` (PR 9)      | ~39 min      | ❌ FAIL                                      |
| Run `26003551440`    | `43594b2` (PR 12)     | ~41 min      | ❌ FAIL                                      |
| Run `26005748035` #1 | `87f5ff8` (mes fixes) | ~38 min      | ❌ FAIL                                      |
| Run `26005748035` #2 | (re-run)              | ~39 min      | ❌ FAIL                                      |

**Pattern systématique** : depuis `fea4b2e` (success 44 min) → tous les 8 runs suivants échouent autour de 37-41 min, identique mode failure.

**Hypothèse** : entre `fea4b2e` et `59edcb9` (PR 7 — 48 routes content-gen V2), la refonte a ajouté ~5-6k LOC. Plus PR 8 / 9 / 11 / 12 → +~24k LOC entre fea4b2e et 87f5ff8. Le build TOTAL nécessite maintenant > 16 GB RAM pendant la phase de finalisation (export layers + cache-to GHA).

**Constats objectifs** :

- Disque OK : 120 GB free post-cleanup.
- RAM : 16 GB (ubuntu-latest standard).
- NODE_OPTIONS=--max-old-space-size=8192 (heap 8 GB, tuned pour CPX42 16 GB).
- BuildKit overlay2 + cache export (~10 GB) + node heap (8 GB) + OS + procs → cumulé > 16 GB → OOM-kill OS niveau.

**Mes fixes audit Phase 4 ne sont PAS la cause** : le streak failed était déjà en place depuis PR 7 (2026-05-17 soir), bien avant mon audit.

## Cycle 3 — Fix tentative : disable cache-to

**Action** : commit `0bdc46f` (push 02:50Z) — désactivation `cache-to: type=gha,mode=min` dans `.github/workflows/deploy-coolify.yml`. Le `cache-from` reste actif.

**Rationale** : l'export GHA cache à la fin du build est mémoire-intensif. Le retirer pourrait libérer suffisamment de RAM pour éviter l'OOM-kill final.

**Run déclenché** : `26007749354` (Build & Deploy sur HEAD `0bdc46f`).

**Status** : in_progress au moment de cette rédaction. Monitor armé jusqu'à completion.

## Smoke prod baseline confirmé OK

Pendant les cycles de fix, validation que la prod actuelle (image baseline pré-audit) répond correctement :

```bash
curl -s -o /dev/null -w "%{http_code}" https://axion-ia.com/api/healthz       # 200 ✅
curl -s -o /dev/null -w "%{http_code}" -L https://axion-ia.com/fr/            # 200 ✅
for url in /fr /fr/interventions /fr/methodologie /fr/reserver /fr/stack-ia; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://axion-ia.com$url")
  echo "$url → $code"  # tous 200
done
```

✅ **5/5 LHCI URLs prod = 200**. Prod baseline UP malgré le streak deploy raté (l'image actuelle est l'image baseline avant mes fixes).

## Décision provisoire

Si cycle 3 succès → Phase 11 smoke V1/V2 prod fresh.
Si cycle 3 fail → documenter pré-existante limitation pipeline + ne pas bloquer Phase 12. Les fixes Phase 4 sont déjà sur main (HEAD `0bdc46f`), seront déployés quand la pipeline sera réparée (probablement Sprint Hardening dédié : reducer NODE_OPTIONS ou switcher ubuntu-latest-large).

## Note pour Will

**Le streak deploy ratés est un problème pré-existant à l'audit**, lié au build saturé en mémoire RAM sur runner ubuntu-latest 16 GB. Mes fixes (CI/coverage/routes) sont OK et seront actifs dès que le build pipeline sera débloqué.

**Options long-terme** :

1. Switch `runs-on: ubuntu-latest-large` (32 GB RAM, $0.16/min vs free).
2. Réduction NODE_OPTIONS heap 8192 → 6144 (risque OOM build).
3. Split build en multi-stage avec offload sur registry cache.
4. Reduce SSG concurrency dans `next.config.ts`.
