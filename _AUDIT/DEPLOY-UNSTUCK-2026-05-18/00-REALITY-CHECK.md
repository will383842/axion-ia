# 00 — Reality Check (Phase 0)

Généré : 2026-05-18 ~05:55 UTC
HEAD : `223d1f5827293249df1eb36ee00acf20bfeadfd1` (= `223d1f5`)
Working dir : `C:/Users/willi/Documents/Projets/Axion-IA/axionia` (sub-repo `will383842/axion-ia`)

## TL;DR

- 🟢 Working tree clean (1 fichier untracked = nouveau prompt deploy-unstuck).
- 🟢 Prod live, **HTTP 200 / 290 ms / 5/5 LHCI URLs**, baseline image servie = commit `938993e6` (= `ci(gate-b): re-activate playwright + lighthouse + bundle gates`).
- 🔴 **Streak 12+ failures consécutives** depuis `fea4b2e` (last green 2026-05-17 13:40 UTC). HEAD `223d1f5` n'a pas encore été déployé.
- 🟡 **+37 commits / +24 522 LOC / 323 fichiers** entre `fea4b2e` et HEAD → refonte admin V2 + image-bank V1 + content-gen V2.
- 🟡 4 cycles autopilot précédents (audit verif-fix-deploy 2026-05-18) ont déjà été tentés sans succès : `87f5ff8` (audit fixes), `0bdc46f` (disable cache-to), `f193e2e` (NODE_OPTIONS heap 8192→6144), `223d1f5` (closure docs).
- 🟡 Accès limité : pas de SSH Hetzner (clé absente), pas de Coolify API (env vars absentes), pas de `read:packages` GHCR scope sur le token gh local. Verification via `gh CLI` + `curl` public uniquement.

## 1. État git (sub-repo `axionia/`)

```
HEAD             : 223d1f5827293249df1eb36ee00acf20bfeadfd1
remote           : will383842/axion-ia (HTTPS, will383842 keyring)
working tree     : clean (untracked: _AUDIT/PROMPT-DEPLOY-RECOVERY-PERFECTION-2026-05-17.md + .claude/worktrees/)
ahead/behind     : 0/0 (sync origin/main)
```

### 1.1 Recent commits

```
223d1f5 docs(admin-refonte): verdict final + exec summary Will (audit verif-fix-deploy 2026-05-18)
f193e2e fix(deploy): reduce NODE_OPTIONS heap 8192→6144 to bypass OOM (audit verif-fix-deploy 2026-05-18)
0bdc46f fix(deploy): disable GHA cache-to to bypass OOM-kill runner (audit verif-fix-deploy 2026-05-18)
87f5ff8 docs(admin-refonte): audit verif-fix-deploy 2026-05-18 livrables + verdict addendum
9f040fb fix(admin): pattern V1/V2 §3 sur 12 routes legacy (audit verif-fix-deploy 2026-05-18)
7fde8cb fix(admin): unblock CI gates + isolation + force-dynamic (audit verif-fix-deploy 2026-05-18)
1cd3d5f docs(admin-refonte): closure session 2026-05-17 soir post pr 12
43594b2 feat(admin/ui): pr 12 polish ux additive helpers
576beff feat(admin): pr 9 migration pages content 22 routes v2 derriere flag
1cacf11 feat(admin): pr 8 migration pages image-bank 15 routes v2 derriere flag
```

### 1.2 Diff vs last green deploy

```
fea4b2e..HEAD = 37 commits
323 files changed, +24 522 insertions, -161 deletions
```

## 2. État runs GH Actions (workflow `Build & Deploy · GHCR + Coolify`)

### 2.1 Streak récente (15 derniers runs)

| Run ID            | Commit        | Heure UTC            | Conclusion                                      |
| ----------------- | ------------- | -------------------- | ----------------------------------------------- |
| `26008830067`     | `f193e2e`     | 2026-05-18 01:33     | ❌ failure                                      |
| `26007749354`     | `0bdc46f`     | 2026-05-18 00:50     | ❌ failure                                      |
| `26005748035`     | `87f5ff8`     | 2026-05-17 23:23     | ❌ failure                                      |
| `26003551440`     | `43594b2`     | 2026-05-17 21:43     | ❌ failure                                      |
| `26003287480`     | `576beff`     | 2026-05-17 21:31     | ❌ failure                                      |
| `26002780898`     | `1cacf11`     | 2026-05-17 21:09     | 🟡 cancelled                                    |
| `26002524510`     | `18ca9e3`     | 2026-05-17 20:57     | ❌ failure                                      |
| `26001143605`     | `59edcb9`     | 2026-05-17 19:57     | ❌ failure                                      |
| `26000619492`     | `11bab33`     | 2026-05-17 19:34     | 🟡 cancelled                                    |
| `25999815888`     | `a8ebbaa`     | 2026-05-17 18:59     | 🟡 cancelled                                    |
| `25999491144`     | `82d094b`     | 2026-05-17 18:44     | ❌ failure                                      |
| `25996851335`     | `938993e`     | 2026-05-17 16:49     | ❌ failure (mais image GHCR pushée — voir §3.1) |
| `25995465318`     | `0820d86`     | 2026-05-17 15:50     | ❌ failure                                      |
| **`25992457839`** | **`fea4b2e`** | **2026-05-17 13:40** | **✅ SUCCESS (last green, durée 44m17s)**       |
| `25990618389`     | `71ee16d`     | 2026-05-17 12:17     | ❌ failure                                      |

### 2.2 In-progress / zombies

Aucun run `in_progress` actuellement (vérifié via `gh api .../actions/runs?status=in_progress`). Pas de cleanup zombie nécessaire avant fix.

## 3. État prod baseline (smoke pré-fix)

### 3.1 Build SHA servi en prod

```
curl -sI https://axion-ia.com/ → x-axion-build-sha: 938993e6db0c7f54e5280cc0fd4b9982f9414a18
```

**Insight critique** : `938993e` est plus récent que `fea4b2e` (cf. timeline §2.1, run à 16:49 > 13:40), MAIS son workflow run est `failure`.

**Conclusion** : le step `Build & push image` du run `25996851335` (938993e) a réussi à pusher l'image sur GHCR avant que le job ne soit marqué failure (probablement Coolify deploy ou un step Post-\* qui a failed sans bloquer le push GHCR initial). Coolify a pull cette image et la sert depuis.

→ **Baseline prod = `938993e` (commit pre-refonte mineur, CI gate config)**, donc rollback automatique implicite vers une image plus ancienne que tout le travail de refonte admin V2 + content-gen + image-bank.

### 3.2 Smoke 5 URLs LHCI

```
/fr                    → 200
/fr/interventions      → 200
/fr/methodologie       → 200
/fr/reserver           → 200
/fr/stack-ia           → 200
/api/healthz           → 200 (durée 0.29s)
```

🟢 Prod baseline solide, on peut casser-réparer côté pipeline sans risque utilisateur.

## 4. Connectivité diagnostique

| Voie              | Statut          | Détail                                                                                                                                                                                         |
| ----------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SSH Hetzner       | ❌ INDISPONIBLE | Aucune clé SSH `~/.ssh/id_rsa` privée, pas de StrictHostKey accepté.                                                                                                                           |
| Coolify API       | ❌ INDISPONIBLE | `COOLIFY_URL` / `COOLIFY_API_TOKEN` / `COOLIFY_APP_UUID` not set local.                                                                                                                        |
| GHCR API direct   | 🟡 LIMITÉ       | gh token scope = `gist, read:org, repo`. Pas de `read:packages` → 403 sur `users/.../packages/container/axion-ia/versions`. Workaround : header `x-axion-build-sha` prod + `gh run view` logs. |
| gh CLI            | ✅ OK           | Token actif (will383842), scopes suffisants pour runs/artifacts/secrets.                                                                                                                       |
| `git push origin` | ✅ OK           | HTTPS auth via keyring.                                                                                                                                                                        |
| curl prod         | ✅ OK           | Public.                                                                                                                                                                                        |

## 5. Stack technique récap (du prompt + lecture code)

### 5.1 Workflow `deploy-coolify.yml`

- Runner : `ubuntu-latest` (4 cores, 16 GB RAM) ligne 91.
- `timeout-minutes: 60`.
- `concurrency: deploy-coolify` (cancel-in-progress: false).
- Steps : Free disk space (cleanup agressif ~75 GB free) → Checkout → Buildx → GHCR login → Metadata → Build & push (step 8 — celui qui meurt) → Print → Trigger Coolify deploy → Wait (max 25 min, polling 30s, early-fail queued > 5 min) → CF purge → LHCI 5 URLs.
- `cache-from: type=gha`, `cache-to` désactivé depuis cycle 3 (`0bdc46f`).
- `provenance: false`.

### 5.2 Dockerfile (multi-stage)

- `node:22-alpine` 3 stages : deps → builder → runner.
- Builder ENV : `NODE_OPTIONS=--max-old-space-size=6144` (réduit cycle 4 `f193e2e`), `NEXT_PRIVATE_WORKER_THREADS=1`, `BULLMQ_DISABLED=true`, `SKIP_ENV_VALIDATION=true`.
- Build args : `DATABASE_URL=postgresql://stub:stub@stub.invalid:5432/stub`, `REDIS_URL=redis://stub.invalid:6379`.
- `RUN pnpm prisma:generate` puis `RUN BUILD_TIME=... pnpm build`.
- Cache mounts pnpm + .next/cache RETIRÉS depuis sprint recovery 2026-05-16 (pour préserver disque GH Actions).

### 5.3 Stub-aware (NE PAS TOUCHER)

`stub.invalid` magic string interceptée dans 5 fichiers : `src/lib/prisma.ts`, `src/lib/redis.ts`, `src/server/exporters/knowledge-rss.ts`, `src/server/exporters/knowledge-sitemap.ts`, `Dockerfile`, `.github/workflows/deploy-coolify.yml`. Tout changement = propagation obligatoire.

### 5.4 Codebase metrics

- 1 063 fichiers `.ts` / `.tsx` dans `src/`.
- SSG estimé > 17 629 routes (selon prompt prior + commits récents qui ajoutent 116 routes admin V2 + 22 content + 15 image-bank + 8 pages main + 12 ops + 11 système).

## 6. Hypothèse principale (à confirmer Phase 1)

**OOM-kill OS-level silencieux** pendant phase `next build` ou `BuildKit exporting layers` :

- Heap node 6144 MB + webpack peak ~2 GB + BuildKit overlay2 export ~3-5 GB + pnpm install ~1 GB + OS baseline ~1-2 GB ≈ **13-15 GB demand sur 16 GB total**.
- Le swap se déclenche → buildkit timeout → exit 255 silencieux → step `completed_at: null`, log non flushé.
- Cohérent avec : step 8 meurt à 37-41 min, autres steps `pending`, no `Trigger Coolify` ni `LHCI` ni `Purge CF`.

Hypothèses alternatives :

- Throttle GHCR push (peu probable, layers déjà cached partiellement).
- Bug `docker/build-push-action@v6` avec `cache-from` corrupted (testé désactivé cache-to, persiste).
- Disque saturé `/tmp` (peu probable post-cleanup).

## 7. Décisions Phase 0

- ✅ Working tree propre, prod baseline saine → **continue Phase 1 automatiquement**.
- ✅ Pas de zombies à canceller, pas de force-cleanup nécessaire.
- ⚠️ Pas de SSH/Coolify direct → vérification via gh CLI + curl + headers. STRATÉGIE S9 (self-hosted runner) impossible sans intervention humaine (cas §28-3). On l'évitera sauf S1-S12 toutes épuisées.
- ⚠️ Stratégie S1 (`ubuntu-latest-large` 32 GB RAM) nécessite paid runners activés (vérifier via tentative). Si fail "runner not available" → fallback S10 puis S2/S11.

## 8. Plan Phase 1 (6 sous-agents //)

- D1 Disk profiling (estimer peak runner)
- D2 Memory profiling (estimer peak runner)
- D3 Logs forensics (download 3 runs failed, confirmer absence log step 8)
- D4 Next.js SSG (compter routes, identifier hot spots)
- D5 Workflow + Buildx config (5 quick wins)
- D6 Coolify VPS state (best-effort sans SSH → via prod headers + run outputs)

→ Lancement immédiat Phase 1.
