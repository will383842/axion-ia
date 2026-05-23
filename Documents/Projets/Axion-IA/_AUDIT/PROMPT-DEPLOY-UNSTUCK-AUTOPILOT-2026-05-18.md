# PROMPT — Déploiement Axion-IA · diagnostic profond + fix + push + déploiement 100 % réussi (AUTOPILOT BOUT-EN-BOUT)

> **Type** : autopilot complet end-to-end **dédié exclusivement au déblocage du pipeline de déploiement**.
> **Mode** : **NE JAMAIS S'ARRÊTER** sauf 4 cas catastrophiques §28. Tout autre échec = diagnostique, fix, retry, escalation.
> **Autorisation Will** : « JE DONNE L'AUTORISATION DE TOUT FAIRE POUR FAIRE FONCTIONNER LE DÉPLOIEMENT » (2026-05-18).
> **Cible finale** : déploiement prod **100 % réussi**, image GHCR pushée + Coolify déployée + LHCI vert + smoke prod live image V2 effective.
> **Date prompt** : 2026-05-18.
> **Modèle recommandé** : Claude Opus 4.7 (1M context).
> **Best practices 2026** : cite-don't-guess, escalation matrix multi-strategy, instrumentation runtime, anti-hallucination strict, rollback safety nets.

---

## 0. INVOCATION PHRASE (à copier-coller)

```
Exécute en autopilot complet bout-en-bout le prompt
_AUDIT/PROMPT-DEPLOY-UNSTUCK-AUTOPILOT-2026-05-18.md.
Mission unique : faire passer le déploiement Coolify prod en SUCCESS,
diagnostiquer en profondeur, vérifier disque + RAM + GHCR + Coolify + VPS,
appliquer toutes les fixes nécessaires y compris ubuntu-latest-large /
multi-stage / cache strategy / runner self-hosted si besoin, retry jusqu'à
succès. Autorisation Will déjà donnée. NE PAS S'ARRÊTER sauf 4 cas
catastrophiques §28. Confirme par « GO autopilot deploy » et démarre Phase 0.
```

---

## 1. CONTEXTE PRÉ-EXISTANT (lis intégralement, self-contained)

### 1.1 Streak d'échecs documenté

Depuis `fea4b2e` (last green deploy 2026-05-17 13:40 UTC, build & push image step = 44 min 17 sec, durée totale ~49 min), **8+ runs consécutifs `Build & Deploy · GHCR + Coolify (axion-ia.com)` ont échoué**.

État au moment de cette rédaction (HEAD `223d1f5`) :

| Run                  | Commit                 | Step 8 durée | Statut    | Notes                                        |
| -------------------- | ---------------------- | ------------ | --------- | -------------------------------------------- |
| `25992457839`        | `fea4b2e`              | 44m 17s      | ✅ SUCCESS | last green 2026-05-17 13:40 UTC              |
| `26001143605`        | `59edcb9` (PR 7)        | ~38 min      | ❌ FAIL    | post-refonte content-gen 48 routes V2        |
| `26002780898`        | `1cacf11` (PR 8)        | ~37 min      | ❌ CANCEL  | image-bank 15 routes V2                      |
| `26003287480`        | `576beff` (PR 9)        | ~39 min      | ❌ FAIL    | content 22 routes V2                         |
| `26003551440`        | `43594b2` (PR 12)       | ~41 min      | ❌ FAIL    | polish UX helpers                            |
| `26005748035` #1 #2  | `87f5ff8` (audit fixes) | ~38 min × 2  | ❌ FAIL    | audit verif-fix-deploy 2026-05-18 commits    |
| `26007749354`        | `0bdc46f` (deploy fix #1)| ~40 min      | ❌ FAIL    | disable cache-to GHA                         |
| `26008830067`        | `f193e2e` (deploy fix #2)| ~41 min      | ❌ FAIL    | reduce NODE_OPTIONS heap 8192→6144           |

**Pattern systématique observé** :
- Step 8 "Build & push image" démarre, tourne ~37-41 min.
- Job se termine en `conclusion: failure`.
- Step 8 reste avec `completed_at: null` dans l'API GH Actions (jamais flushé).
- Zip log téléchargé via `gh api .../logs` **ne contient pas** le fichier `8_Build & push image.txt` (les fichiers 1-7 sont présents).
- Aucun message d'erreur dans le UI GH Actions web.
- Steps suivants "Print image ref", "Post Build & push image", "Post Login to GHCR", "Post Set up Docker Buildx", "Post Checkout" tous en status `pending` (jamais démarrés).

**Diagnostic actuel** : ✅ Disque OK (`df -h` post-cleanup → 25 GB used / 145 GB total / 120 GB free). ❌ RAM 16 GB suspect (ubuntu-latest standard, 4 cores). Hypothèse principale : **OOM-kill OS-level silencieux** pendant la phase `next build` SSG 17629+ routes ou pendant le `docker push` final.

### 1.2 Stack technique du build

- **Runner** : `ubuntu-latest` (GH Actions), 4 cores / 16 GB RAM / ~84 GB SSD utilisable (avant cleanup, ~120 GB après).
- **Build orchestration** : `.github/workflows/deploy-coolify.yml` :
  - `runs-on: ubuntu-latest` ligne 91.
  - `timeout-minutes: 60` ligne 92.
  - Step "Free disk space (max headroom)" — cleanup agressif ~120 GB free.
  - Step "Build & push image" via `docker/build-push-action@v6`.
  - `cache-from: type=gha` (cache-to désactivé depuis `0bdc46f`).
- **Dockerfile** : multi-stage (`deps` → `builder` → `runner`).
  - `node:22-alpine` images.
  - Builder stage env vars :
    - `NODE_OPTIONS=--max-old-space-size=6144` (réduit de 8192, commit `f193e2e`).
    - `NEXT_PRIVATE_WORKER_THREADS=1`.
    - `BULLMQ_DISABLED=true`.
    - `SKIP_ENV_VALIDATION=true`.
  - Build args injectés :
    - `DATABASE_URL=postgresql://stub:stub@stub.invalid:5432/stub`
    - `REDIS_URL=redis://stub.invalid:6379`
  - `pnpm prisma:generate` + `pnpm build` (Next 16 standalone).
- **Magic string `stub.invalid`** : intercepté par `src/lib/prisma.ts` + `src/lib/redis.ts` (Proxy stub-aware). **Ne PAS toucher** sans propager dans 5 fichiers (cf. CLAUDE.md / AGENTS.md).
- **GHCR push** : `ghcr.io/will383842/axion-ia:{latest,sha-XXXXXXX,main}`. Image PUBLIQUE.
- **Coolify** : pull `ghcr.io/will383842/axion-ia:latest` via `Dockerfile.coolify-pull` (un-liner). VPS Hetzner CPX42 `178.105.55.15` (8c/16GB/320GB).

### 1.3 Contexte refonte (cause probable de l'augmentation taille build)

Entre `fea4b2e` (last green) et HEAD `223d1f5` :
- 34 commits, +24 919 insertions / -159 deletions.
- 318 fichiers touchés.
- Refonte admin V2 (PRs 0-12) : 116 routes V2, 32 primitives, ~16 100 LOC.
- Image-bank V1 + content-gen V2 finalisés.
- SSG ~17 629 routes (next standalone) → probablement >18 000 maintenant.

### 1.4 Ce qui a déjà été tenté (Phase 10 audit verif-fix-deploy 2026-05-18)

1. **Cycle 1** : `gh run rerun --failed` attempt #2 → fail identique.
2. **Cycle 3** : Commit `0bdc46f` désactive `cache-to: type=gha,mode=min` → fail identique.
3. **Cycle 4** : Commit `f193e2e` réduit `NODE_OPTIONS=--max-old-space-size 8192→6144` → fail identique.

**Toutes les tentatives ont échoué avec le même pattern** : step 8 dies at ~38-41 min, no log flush, conclusion failure.

---

## 2. MISSION & MODE OPÉRATOIRE

### 2.1 Objectif final UNIQUE

🟢 **DÉPLOIEMENT PROD COMPLET 100 % RÉUSSI** :
- ✅ `Build & push image to GHCR` job → **success**.
- ✅ `Trigger Coolify deploy` job → **success** (image pulled + container restart + healthcheck pass).
- ✅ `Lighthouse CI post-deploy gate` job → **success** sur 5 URLs prod.
- ✅ Smoke prod confirme nouvelle image servie (header `x-axion-build-sha` = HEAD SHA actuel).
- ✅ Cookie `admin_v2=1` → V2 components rendus (au moins 1 spot-check route admin).

### 2.2 Mode opératoire

- **TOUT AUTOPILOT.** Aucun STOP & ASK sauf 4 cas catastrophiques §28.
- **Diagnostic profond AVANT chaque fix** : cite chaque preuve (commande + output réel + SHA / ligne).
- **Multi-strategy escalation** : appliquer dans l'ordre les stratégies §14 jusqu'à succès.
- **Pas de bypass** (`--no-verify`, `--force` destructif sauf §28).
- **Tag à chaque cycle majeur** pour rollback rapide.
- **Anti-hallucination** : ne JAMAIS prétendre un succès sans output `gh run view` joint.

### 2.3 Outils autorisés

- **Lecture massive** : `Read`, `Glob`, `Grep`.
- **Écriture code/config** : `Edit`, `Write` sur `.github/workflows/**`, `Dockerfile*`, `next.config.ts`, `vitest.config.ts`, fichiers d'instrumentation build.
- **Écriture docs** : `Write` sur `axionia/_AUDIT/DEPLOY-UNSTUCK-2026-05-18/**`.
- **Bash** : `git`, `gh` (run list/view/watch/rerun/cancel/workflow run), `curl`, `ssh` (si clé Hetzner disponible), `docker` (local optionnel).
- **Agent (sous-agent)** : `Explore` ou `general-purpose` pour fouille parallèle (max 6 sous-agents en //).
- **Monitor** : pour suivre runs longs.

### 2.4 Outils interdits (sauf §28)

- ❌ `git push --force` / `git push -f` sur main.
- ❌ `git reset --hard` sur main.
- ❌ `--no-verify` sur commits.
- ❌ Toucher `prisma/schema.prisma` (interdit cf. master prompt refonte).
- ❌ Modifier `stub.invalid` sans propager dans 5 fichiers.
- ❌ Push d'un fix sans validation locale (typecheck + tests minimaux).
- ❌ Couper la prod actuelle (image baseline qui tourne) sans rollback préparé.

---

## 3. ARCHITECTURE DES PHASES

```
Phase 0 — Reality check + état git + état runs GH Actions + état prod baseline
Phase 1 — Diagnostic ULTRA-PROFOND (6 sous-agents // si possible)
Phase 2 — Synthèse + sélection stratégie #1 + plan d'escalation
Phase 3 — Application stratégie #1 + commit + push + monitor
Phase 4 — Self-healing : escalation #2 → #3 → #N jusqu'à succès
Phase 5 — Vérification deploy effective (Coolify pull + container restart + healthcheck)
Phase 6 — Smoke prod live image (header build-sha, V2 cookie spot-check, LHCI URLs)
Phase 7 — Verdict final + livrables + mise à jour mémoire
```

**Durée plafond** : 12 h cumulé.

---

## 4. PHASE 0 — REALITY CHECK INITIAL (BLOQUANT, ~30 min)

Produit `axionia/_AUDIT/DEPLOY-UNSTUCK-2026-05-18/00-REALITY-CHECK.md`.

### 4.1 État git

```bash
cd C:/Users/willi/Documents/Projets/Axion-IA/axionia
git rev-parse HEAD                                                # attendu: hash récent post audit
git status --short                                                # working tree
git log --oneline -n 15
git rev-list --count origin/main..HEAD                            # 0 (sync)
git rev-list --count HEAD..origin/main                            # 0 (sync)
git remote -v                                                     # will383842/axion-ia
```

### 4.2 État runs GH Actions récents

```bash
HEAD_SHA=$(git rev-parse HEAD)
# Last 20 runs all workflows
gh api repos/will383842/axion-ia/actions/runs?per_page=20 \
  --jq '.workflow_runs[] | {id, name, status, conclusion, created_at, head_sha: .head_sha[0:7]}' > /tmp/recent-runs.json

# Last 10 Build & Deploy runs
gh api repos/will383842/axion-ia/actions/runs?per_page=50 \
  --jq '.workflow_runs[] | select(.name == "Build & Deploy · GHCR + Coolify (axion-ia.com)") | {id, conclusion, created_at, head_sha: .head_sha[0:7]}' \
  | head -10

# Last successful Build & Deploy
gh api "repos/will383842/axion-ia/actions/runs?per_page=100&status=success" \
  --jq '.workflow_runs[] | select(.name == "Build & Deploy · GHCR + Coolify (axion-ia.com)") | {id, created_at, head_sha: .head_sha[0:7]}' \
  | head -3

# Currently in_progress runs
gh api "repos/will383842/axion-ia/actions/runs?per_page=20&status=in_progress" \
  --jq '.workflow_runs[] | {id, name, head_sha: .head_sha[0:7], created_at}'
```

### 4.3 État prod baseline (smoke pré-fix)

```bash
# Health endpoint
curl -s -o /dev/null -w "HTTP=%{http_code} TIME=%{time_total}s\n" https://axion-ia.com/api/healthz

# Build SHA actuel servi en prod (header injecté par next.config.ts)
curl -sI https://axion-ia.com/ | grep -i "x-axion-build-sha"
curl -sI https://axion-ia.com/fr | grep -iE "(x-axion-build|x-build-time|x-build)"

# 5 URLs LHCI pilotes
for url in /fr /fr/interventions /fr/methodologie /fr/reserver /fr/stack-ia; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://axion-ia.com$url")
  echo "$url → $code"
done
```

Si TOUT 200 → prod baseline OK, on peut casser-réparer côté pipeline sans risque.
Si 500 / 502 / 503 → 🟡 documente, **continue quand même** (le but est de débloquer).

### 4.4 Connectivité Coolify + Hetzner

```bash
# Coolify API (si COOLIFY_API_TOKEN + COOLIFY_URL disponibles via env local)
echo "COOLIFY_URL=${COOLIFY_URL:-not_set}"
echo "COOLIFY_APP_UUID=${COOLIFY_APP_UUID:-not_set}"

# SSH Hetzner (si clé disponible)
ssh -o BatchMode=yes -o ConnectTimeout=8 root@178.105.55.15 'echo OK; uptime; df -h /' 2>&1 | head -10 || echo "SSH unavailable"
```

Si SSH disponible → on peut diagnostiquer Coolify + container côté VPS directement.

### 4.5 GHCR auth + image

```bash
# Verify GHCR image exists / is accessible
curl -sI https://ghcr.io/v2/will383842/axion-ia/manifests/latest \
  -H "Authorization: Bearer $(echo -n $GITHUB_TOKEN | base64)" 2>&1 | head -5 || echo "(GHCR auth failed)"

# Image tags via API
gh api /users/will383842/packages/container/axion-ia/versions 2>&1 \
  | head -50 || echo "(packages API unavailable)"
```

### 4.6 État env vars critiques Coolify (lecture seule si possible)

Sans accès API Coolify direct, lister ce qui est attendu :
- `DATABASE_URL` (Postgres prod).
- `REDIS_URL` (Redis prod).
- `AUTH_SECRET` (Auth.js v5).
- `NEXT_PUBLIC_SITE_URL` (= `https://axion-ia.com`).
- `ADMIN_URL_PREFIX` (secret admin path).
- `ADMIN_V2_ENABLED` (= `false` ou non set par défaut).
- `EN_LOCALE_ENABLED` (= `false`).
- `IP_HASH_SALT`.
- `INDEXNOW_INTERNAL_HMAC_SECRET`.
- `DOCUSEAL_STRICT_HMAC`.
- Etc.

Si on ne peut pas vérifier → 🟡 UNVERIFIED.

### 4.7 STOP & ASK Phase 0

Si :
- Working tree dirty avec fichiers que je ne reconnais pas → flag, continue.
- HEAD pas sync origin/main → diagnostiquer, fix (pull --rebase si non-FF).
- Plus de 3 runs `in_progress` zombies > 60 min → cancel them first (cf. coolify-diagnose.yml + coolify-zombie-cleanup.yml).

Sinon → **continue Phase 1 automatiquement**.

---

## 5. PHASE 1 — DIAGNOSTIC ULTRA-PROFOND (~1.5 h, multi-agent)

Objectif : identifier la **cause exacte** de l'échec du step 8 avant de fixer.

### 5.1 Sous-agents parallèles (max 6 //)

Spawne en parallèle (single message) :

#### D1 — Disk profiling pendant le build

Brief :
- Étudier le step "Free disk space" output exact (df -h avant/après).
- Estimer la taille de l'image Docker finale (via package GHCR ou layer count).
- Vérifier si `cache-from: type=gha` fait un disk write lourd au début (~10-30 GB).
- Investiguer si BuildKit a un `--mount=type=cache` qui consomme disque.
- Conclusion : peak disque estimé pendant build, pourcentage utilisé.

#### D2 — Memory profiling pendant le build

Brief :
- Lire `Dockerfile` ligne par ligne.
- Calculer le budget mémoire attendu : node heap (6144 MB) + buildkit RSS + npm install peak + webpack peak.
- Vérifier si `NEXT_PRIVATE_WORKER_THREADS=1` est respecté (vs Next 16 auto-detection cores).
- Identifier si `next build` lance des sub-processes (sharp, terser, postcss, swc).
- Conclusion : peak RAM estimé en GB, marge vs 16 GB.

#### D3 — Logs forensics (logs partiels, attempts, timing)

Brief :
- Télécharger via `gh api .../logs` zips des 3 derniers runs failed.
- Lister TOUS les fichiers présents et leurs tailles.
- Confirmer absence du fichier `8_Build & push image.txt` dans les 3 runs.
- Lire `system.txt` de chaque step pour Job runtime ID + timing.
- Comparer Job runtime ID (hosted runner instance) entre runs successifs (même runner ? OS image hash ?).
- Investiguer si la 3min30 step 1 ("Set up job") montre une latence anormale.
- Conclusion : confirmer / infirmer hypothèse OOM silencieux.

#### D4 — Next.js / SSG analysis

Brief :
- Lire `next.config.ts`, `next.config.mjs` complet.
- Compter les routes SSG potentielles : `find src/app -name "page.tsx" | wc -l`, glob `app/[locale]/...`, calculer si combinaisons générées (villes ~2150, régions ~13, langues 1 EN désactivé = 2150 × 1 × N_templates).
- Identifier les pages avec `generateStaticParams` et leur count.
- Identifier les sub-sitemaps générés au build.
- Estimer le total de routes SSG : si > 25 000 routes, c'est un signal.
- Vérifier si Sprint Web Vitals a ajouté du build-time work (sharp, image-bank, image-utils).
- Vérifier la stratégie `output: "standalone"` dans next.config.
- Conclusion : nombre estimé de routes SSG, taille standalone attendue.

#### D5 — Workflow + Buildx config analysis

Brief :
- Lire `.github/workflows/deploy-coolify.yml` complet.
- Lister tous les inputs/outputs/env vars.
- Vérifier `docker/build-push-action@v6` config exacte (provenance, sbom, cache, push, platforms).
- Identifier si BuildKit a `--memory` ou `--memory-swap` limits.
- Tester si on peut utiliser `docker/setup-buildx-action@v3` avec `driver-opts` pour augmenter resources.
- Comparer avec workflows similaires de gros projets Next.js publics (Vercel, ShadCN, etc.).
- Conclusion : 3-5 quick wins config workflow possibles.

#### D6 — Coolify + Hetzner VPS state

Brief :
- Si SSH disponible : `ssh root@178.105.55.15 'df -h; docker ps; docker images; coolify --version'`.
- Vérifier état du container axion-ia actuel : uptime, logs des 100 dernières lignes, image utilisée.
- Vérifier connectivité GHCR pull depuis le VPS (docker pull manuel).
- Identifier si Coolify a un setting bloquant (e.g. healthcheck timeout, restart policy).
- Vérifier disque VPS : `/var/lib/docker` usage, `/tmp` usage.
- Lire `Dockerfile.coolify-pull` (un-liner).
- Conclusion : si Coolify est OK pour redéployer dès qu'une nouvelle image est sur GHCR.

### 5.2 Récupération + synthèse

Attendre les 6 notifications. Récupérer leurs livrables. Vérifier qu'aucun n'est 🟡 UNVERIFIED sur un point critique.

### 5.3 Produit `01-DIAGNOSTIC-PROFOND.md`

Format :

```markdown
# Diagnostic profond pipeline deploy

## D1 — Disk profiling
- Peak estimé: XX GB
- Disponible runner: XX GB
- Marge: XX GB
- Verdict: 🟢 / 🟡 / 🔴

## D2 — Memory profiling
- Peak estimé: XX GB
- Disponible runner: 16 GB
- Marge: XX GB
- Verdict: 🟢 / 🟡 / 🔴

## D3 — Logs forensics
- ...

## D4 — Next.js SSG
- Routes SSG estimées: XX
- Standalone size estimée: XX MB
- Verdict: 🟢 / 🟡 / 🔴

## D5 — Workflow config
- 5 quick wins:
  1. ...

## D6 — Coolify VPS state
- État: 🟢 / 🟡 / 🔴

## Hypothèse principale cause root
- Hypothèse #1 (probabilité X%): ...
- Hypothèse #2 (probabilité Y%): ...
- Hypothèse #3 (probabilité Z%): ...

## Stratégies de fix (par ordre de pragmatisme)
1. **S1** — ... (effort 5 min, coût 0)
2. **S2** — ... (effort 15 min, coût ~$3/build)
3. **S3** — ... (effort 1h, coût 0)
4. **S4** — ... (effort 3h, coût 0)
...
```

---

## 6. PHASE 2 — SÉLECTION STRATÉGIE + PLAN ESCALATION (~15 min)

### 6.1 Matrice escalation 2026 (par ordre d'application)

| # | Stratégie                                                        | Effort | Coût | Risque | Probabilité succès |
|---|------------------------------------------------------------------|--------|------|--------|--------------------|
| **S1** | **`runs-on: ubuntu-latest-large` (32 GB RAM)**          | 5 min  | ~$3/build (paid runners) | LOW    | **80 %** |
| S2 | Disable `cache-from: type=gha` (force fresh build)               | 5 min  | 0    | LOW    | 30 %               |
| S3 | Switch cache strategy → `cache-from/to: type=registry,ref=...`   | 15 min | 0    | LOW    | 50 %               |
| S4 | Split build : `pnpm install` → `prisma generate` → `pnpm build` en 3 jobs distincts | 1 h | 0 | MED | 70 % |
| S5 | Skip SSG of `villes`/`regions` au build (use ISR avec `revalidate=3600`) | 2 h | 0 | MED | 75 % |
| S6 | Add explicit `--memory=12g --memory-swap=16g` à BuildKit build  | 30 min | 0    | MED    | 60 %               |
| S7 | Pre-build standalone offline (local docker) + push manuel        | 1 h    | 0    | HIGH   | 90 % (mais one-off) |
| S8 | Switch `ubuntu-latest-large-4xl` (64 GB RAM)                     | 5 min  | ~$10/build | LOW | **95 %** |
| S9 | Self-hosted runner sur Hetzner CPX42 (16 GB) ou CCX23 (32 GB)    | 3 h    | $0-30/mo | HIGH | 90 %        |
| S10| Add instrumentation : `docker build --progress=plain` + logs verbose pour identifier l'étape exacte qui meurt | 15 min | 0 | LOW | 0 % (diagnostic, pas fix) |
| S11| Réduire build : `next.config.experimental.cpus = 1`, `experimental.workerThreads = false` | 30 min | 0 | LOW | 40 % |
| S12| Simplifier le SSG : déléguer rendering aux ISR runtime au lieu du build (next config) | 2 h | 0 | MED | 80 % |

### 6.2 Plan d'application escalation

**Priorité absolue : essayer en parallèle S10 (instrumentation) + S1 (runner upgrade)** :
- S10 nous donne enfin le log d'erreur réel pour identifier la cause exacte.
- S1 est le fix le plus rapide et probable.

Si S1 + S10 :
- ✅ S1 succès → continue Phase 5.
- 🔴 S1 fail mais S10 a un log clair → identifier la cause réelle et appliquer S2-S12 ciblé.
- 🔴 S1 fail + S10 toujours pas de log → S8 (`ubuntu-latest-large-4xl` 64 GB) en fallback brute.

Si S8 fail aussi → S7 (build local + push manuel) comme bypass exceptionnel.

Si tout échoue → Phase 7 documente + STOP & ASK §28 cas 5 (nouveau cas : pipeline irréparable cloud, requiert décision Will sur self-hosted runner ou rewrite).

### 6.3 Produit `02-PLAN-ESCALATION.md`

Format :
```markdown
# Plan escalation déploiement

## Stratégie #1 sélectionnée
- ID: S1 + S10 (paralllèle)
- Justification: ...
- Commit attendu: ...

## Si fail → Stratégie #2
- ID: ...

## Si fail → Stratégie #3
- ID: ...

## Timeline estimée
- S1+S10: ~1h (commit + push + monitor 45 min)
- S2/S3 fallback: ~1h chacun
- S7 (one-off): ~2h
- Total worst case: ~6h
```

---

## 7. PHASE 3 — APPLICATION STRATÉGIE #1 + PUSH (~10 min)

### 7.1 Pré-flight

```bash
git tag deploy-unstuck-2026-05-18-start HEAD
```

### 7.2 Edit fichiers

Selon stratégie sélectionnée Phase 2 :

**Si S1** : `.github/workflows/deploy-coolify.yml` ligne 91 :
```yaml
runs-on: ubuntu-latest-large
```

**Si S10** : ajouter à `docker/build-push-action@v6` :
```yaml
- name: Build & push image
  uses: docker/build-push-action@v6
  with:
    ...
    # S10 instrumentation : verbose progress + buildx outputs
  env:
    BUILDKIT_PROGRESS: plain
    DOCKER_BUILDKIT: 1
```

OU ajouter step avant build :
```yaml
- name: Free disk space + verbose monitoring
  run: |
    df -h /
    free -h
    cat /proc/cpuinfo | grep -c processor
    echo "Memory available before build:"
    free -m
    # Background script to log memory every 30s during build
    (while true; do
      echo "[$(date -u +%H:%M:%SZ)] $(free -m | grep Mem | awk '{print "RAM used="$3"MB free="$4"MB"}') $(df -h / | tail -1 | awk '{print "Disk used="$3" free="$4}')"
      sleep 30
    done) &
    echo "MONITOR_PID=$!" >> $GITHUB_ENV
```

Et après build :
```yaml
- name: Stop monitor
  if: always()
  run: kill $MONITOR_PID 2>/dev/null || true
```

### 7.3 Validation locale (avant push)

```bash
cd C:/Users/willi/Documents/Projets/Axion-IA/axionia
# YAML syntax check
yamllint .github/workflows/deploy-coolify.yml 2>&1 || actionlint .github/workflows/deploy-coolify.yml 2>&1 || echo "(yamllint/actionlint not available, manual review)"

# Workflow syntax via gh CLI
gh workflow view deploy-coolify.yml 2>&1 | head -20
```

### 7.4 Commit + push

Format commit :
```
fix(deploy): <stratégie> (cycle <N> unstuck deploy 2026-05-18)

Cycle <N> Phase 10 self-healing deploy.
Streak <K>+ deploys ratés depuis fea4b2e.

Stratégie appliquée :
- <stratégie nom + détails>

Diagnostic Phase 1 :
- D1 disk: ...
- D2 RAM: ...
- D3 logs: ...
- D4 SSG: ...
- D5 workflow: ...
- D6 Coolify: ...

Si fail → escalation cycle <N+1> stratégie <S_next>.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

```bash
git add <fichiers>
git commit -m "..."
git push origin main
```

### 7.5 Identifier le nouveau run

```bash
sleep 20
HEAD_SHA=$(git rev-parse HEAD)
gh api repos/will383842/axion-ia/actions/runs?per_page=10 \
  --jq ".workflow_runs[] | select(.head_sha == \"$HEAD_SHA\" and .name == \"Build & Deploy · GHCR + Coolify (axion-ia.com)\") | {id, status}"
# Capturer le RUN_ID
```

---

## 8. PHASE 4 — MONITOR + SELF-HEALING ESCALATION (~variable, max 6 h)

### 8.1 Monitor armé

Utiliser `Monitor` (background) avec timeout 60 min pour le run :

```bash
# Pseudo-code Monitor
prev=""
while true; do
  s=$(gh api repos/will383842/axion-ia/actions/runs/$RUN_ID --jq '.status + "/" + (.conclusion // "null")')
  step=$(gh api repos/will383842/axion-ia/actions/runs/$RUN_ID/jobs --jq '[.jobs[] | select(.conclusion==null) | .steps[] | select(.status=="in_progress") | .name] | first // "—"')
  cur="STATE: $s | STEP: $step"
  if [ "$cur" != "$prev" ]; then
    echo "$(date -u +%H:%M:%SZ) $cur"
    prev="$cur"
  fi
  if echo "$s" | grep -q "completed"; then
    echo "DONE: $cur"
    break
  fi
  sleep 60
done
```

### 8.2 Boucle escalation

```python
# Pseudo-code
STRATEGIES_TRIED = ["S1+S10"]
CYCLE = 1
MAX_CYCLES = 12  # plafond strict
MAX_DURATION = 6 * 3600  # 6h cumulé Phase 4
start_time = now()

while now() - start_time < MAX_DURATION:
    CYCLE += 1
    result = monitor_run(RUN_ID)
    
    if result == "success":
        return "DEPLOYED"
    
    if result == "failure":
        # Diagnose new run logs (might have instrumentation output)
        new_log = download_logs(RUN_ID)
        memory_logs = grep_memory_pattern(new_log)
        if memory_logs:
            print("Memory profile during build:", memory_logs)
            # Use this to inform next strategy
        
        # Select next strategy
        next_strategy = select_next_strategy(STRATEGIES_TRIED, new_log)
        STRATEGIES_TRIED.append(next_strategy)
        
        # Apply
        apply_strategy(next_strategy)
        commit_push()
        RUN_ID = wait_for_new_run()
        # Loop back to monitor
    
    if CYCLE > MAX_CYCLES:
        break

if result != "success":
    document_failure_phase_7()
    stop_and_ask_will()
```

### 8.3 Stratégies à enchaîner (typique)

1. **Cycle 1** : S1 + S10 (ubuntu-latest-large + instrumentation memory/disk).
2. **Cycle 2 (si fail)** : Analyser logs S10. Si OOM → S8 (ubuntu-latest-large-4xl 64 GB). Si autre → S11 ou S4.
3. **Cycle 3** : S4 (split build multi-job).
4. **Cycle 4** : S3 (registry cache).
5. **Cycle 5** : S5 (skip SSG villes/régions).
6. **Cycle 6** : S12 (rewrite next.config experimental).
7. **Cycle 7** : S6 (BuildKit memory limits).
8. **Cycle 8** : S7 (build local + push manuel).
9. **Cycle 9** : S9 (self-hosted runner Hetzner).

### 8.4 Action: cancel zombie runs

Si pendant Phase 4, des runs `in_progress` zombies > 60 min apparaissent :

```bash
gh workflow run coolify-zombie-cleanup.yml --ref main
sleep 30
gh workflow run coolify-diagnose.yml --ref main
```

### 8.5 Cas spécial : GHCR rate limit / auth

Si logs montrent `403` ou `429` sur le push GHCR :
- Vérifier `secrets.GITHUB_TOKEN` (auto-injected, normalement OK).
- Vérifier package visibility GHCR (doit rester PUBLIC, cf. AGENTS.md).
- Wait + retry après 15 min si rate limit.

### 8.6 Cas spécial : Coolify deploy failure (build OK mais Coolify échoue)

Si `Build & push image` succès mais `Trigger Coolify deploy` fail :
- Vérifier Coolify webhook : `curl -X POST $COOLIFY_URL/api/v1/deploy?uuid=$COOLIFY_APP_UUID -H "Authorization: Bearer $COOLIFY_API_TOKEN"`.
- Vérifier état Coolify côté VPS via SSH si possible.
- Diagnostic `coolify-diagnose.yml`.

### 8.7 Cas spécial : LHCI fail (build + deploy OK mais Lighthouse échoue)

Si tout passe sauf LHCI :
- Identifier route + métrique échouée dans rapport LHCI.
- Si CLS > 0 sur une route : c'est P2 documenté, peut accepter le fail LHCI **temporairement** sans bloquer deploy.
- Marquer LHCI fail comme P2, continuer Phase 5 (image est sur GHCR + déployée, ce qui est l'objectif).

### 8.8 Produit `03-CYCLES-LOG.md`

Pour chaque cycle :
```markdown
## Cycle N (HEAD <SHA>)
- Stratégie: ...
- Commit: ...
- Push: ...
- Run ID: ...
- Durée: ...
- Résultat: 🟢 SUCCESS / 🔴 FAILURE
- Logs forensics: ...
- Si fail → Cycle N+1 stratégie: ...
```

---

## 9. PHASE 5 — VÉRIFICATION DEPLOY EFFECTIVE (~10 min)

### 9.1 Post-build job (Trigger Coolify deploy)

```bash
gh api repos/will383842/axion-ia/actions/runs/$RUN_ID/jobs \
  --jq '.jobs[] | select(.name == "Trigger Coolify deploy") | {name, status, conclusion, started_at, completed_at}'

# Logs complets job deploy
gh api repos/will383842/axion-ia/actions/runs/$RUN_ID/logs > /tmp/logs.zip
unzip -o /tmp/logs.zip -d /tmp/run-logs/
cat "/tmp/run-logs/Trigger Coolify deploy/"*.txt | tail -100
```

### 9.2 Coolify deployment status

```bash
# Si COOLIFY_API_TOKEN disponible
curl -s -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$COOLIFY_URL/api/v1/applications/$COOLIFY_APP_UUID" \
  | jq '{status, last_deployed, build_logs_url}'

# Via SSH si disponible
ssh root@178.105.55.15 'docker ps -a --format "{{.Names}} {{.Image}} {{.Status}}" | grep -i axion'
ssh root@178.105.55.15 'docker logs --tail 50 $(docker ps --format "{{.Names}}" | grep -i axion | head -1)'
```

### 9.3 Image GHCR confirmation

```bash
# Verify the new image tag is up
SHORT_SHA=$(echo $HEAD_SHA | cut -c1-7)
curl -sI "https://ghcr.io/v2/will383842/axion-ia/manifests/sha-$SHORT_SHA" \
  -H "Accept: application/vnd.docker.distribution.manifest.v2+json" 2>&1 | head -5

# OR
gh api /users/will383842/packages/container/axion-ia/versions 2>&1 \
  | jq '.[0:3] | .[] | {name, created_at, metadata: .metadata.container.tags}'
```

### 9.4 Container restart confirmation

```bash
# Via SSH
ssh root@178.105.55.15 'docker inspect $(docker ps --format "{{.Names}}" | grep -i axion | head -1) | jq ".[0] | {State, Image, Created}"'
```

### 9.5 Smoke headers

```bash
# Build SHA header doit refléter le nouveau HEAD
curl -sI https://axion-ia.com/ 2>&1 | grep -i "x-axion-build-sha"
# Attendu: x-axion-build-sha: <HEAD_SHA premier 7 chars>
```

### 9.6 Produit `04-DEPLOY-VERIFICATION.md`

```markdown
# Vérification déploiement effective

## Build & push job
- Conclusion: success ✅
- Duration: X min
- Image pushed: ghcr.io/will383842/axion-ia:sha-XXXXXXX ✅

## Coolify deploy job
- Conclusion: success ✅
- Webhook response: 200
- New container image: ghcr.io/will383842/axion-ia:latest digest <SHA256>
- Container restart: <timestamp>
- Healthcheck: passing ✅

## Build SHA en prod
- HEAD git: <SHA>
- x-axion-build-sha header: <SHA> ✅ MATCH

## LHCI gate
- Status: <success/skipped/fail>
- 5 URLs: <list>
```

---

## 10. PHASE 6 — SMOKE PROD LIVE IMAGE (~15 min)

### 10.1 Smoke V1 (flag default off)

```bash
SITE_URL="https://axion-ia.com"

# Public routes
for url in /fr /fr/interventions /fr/methodologie /fr/reserver /fr/stack-ia; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL$url")
  build_sha=$(curl -sI "$SITE_URL$url" | grep -i "x-axion-build-sha" | head -1 | cut -d: -f2 | tr -d ' \r')
  echo "$url → $code (build: $build_sha)"
done

# Health
curl -s "$SITE_URL/api/healthz" | jq '.' || echo "(non-JSON)"
curl -s -o /dev/null -w "%{http_code}\n" "$SITE_URL/api/healthz"

# Sitemap
curl -s -o /dev/null -w "%{http_code}\n" "$SITE_URL/sitemap.xml"
curl -s -o /dev/null -w "%{http_code}\n" "$SITE_URL/sitemap-index.xml"
```

### 10.2 Smoke V2 (cookie admin_v2=1)

Si possible (nécessite `ADMIN_URL_PREFIX` connu) :

```bash
ADMIN_PREFIX="<récupérer depuis env Coolify ou interactif>"
curl -s -o /dev/null -w "%{http_code}\n" \
  -b "admin_v2=1" "$SITE_URL/fr/$ADMIN_PREFIX/login"
```

### 10.3 Smoke routes admin V2 (sur HEAD)

Vérifier que les composants V2 sont effectivement servis :

```bash
# Si on a cookie auth admin + admin_v2=1
curl -sb "auth.session-token=...; admin_v2=1" "$SITE_URL/fr/$ADMIN_PREFIX" \
  | grep -E "(DashboardV2|UsersV2|SettingsV2)" | head -3
```

### 10.4 Smoke LHCI pilotes

```bash
# Re-run LHCI manuel si dispo
gh workflow run lhci.yml --ref main 2>&1 || echo "(LHCI workflow non listé séparément)"
```

### 10.5 Produit `05-SMOKE-PROD-LIVE.md`

```markdown
# Smoke prod final (HEAD <SHA>)

## V1 (default flag off)
- /fr → 200 (build <SHA>) ✅
- /fr/interventions → 200 (build <SHA>) ✅
- /fr/methodologie → 200 (build <SHA>) ✅
- /fr/reserver → 200 (build <SHA>) ✅
- /fr/stack-ia → 200 (build <SHA>) ✅
- /api/healthz → 200 ✅
- /sitemap.xml → 200 ✅

## V2 (cookie admin_v2=1)
- /fr/<admin>/login → 200 ✅
- /fr/<admin> (auth + cookie) → DashboardV2 rendu ✅

## Verdict smoke
🟢 100 % vert. Déploiement effectif confirmé.
```

---

## 11. PHASE 7 — VERDICT FINAL + LIVRABLES (~15 min)

### 11.1 Tags

```bash
git tag deploy-unstuck-2026-05-18-success HEAD
git push origin --tags
```

### 11.2 Produit `VERDICT-FINAL-DEPLOY.md`

```markdown
# VERDICT FINAL — Déploiement débloqué (2026-05-18)

## TL;DR
🟢 **Déploiement prod 100 % RÉUSSI** sur HEAD <SHA>.

## Cycles autopilot
- Stratégie finale utilisée: <S>
- Cycles total: <N>
- Durée totale: <X> h
- Coût additionnel runner: ~$<Y>

## Cause racine identifiée
<diagnostic complet>

## Recommandations long-terme
1. <reco>
2. <reco>

## Smoke prod
- 5/5 LHCI URLs: 200 ✅
- V1 + V2 confirmed: ✅
- Build SHA header match: ✅

## Tags
- deploy-unstuck-2026-05-18-start: <SHA>
- deploy-unstuck-2026-05-18-success: <SHA>
```

### 11.3 Produit `EXEC-SUMMARY-WILL.md`

≤ 100 lignes pour Will (non-tech) :
- TL;DR succès.
- Durée totale.
- Coût additionnel ($).
- 3 actions Will (typiquement : activer V2 cookie / monitorer 24h / approuver coûts runner long-terme).
- URL prod confirmée.

### 11.4 Mise à jour mémoire

Créer `axionia_deploy_unstuck_2026-05-18.md` + ajouter ligne MEMORY.md ≤ 200 chars.

Marquer `axionia_audit_verif_fix_deploy_2026-05-18.md` comme "deploy enfin résolu via [...]".

### 11.5 Cleanup branches/tags zombies

```bash
# Cancel les runs zombies restants
gh run list --status in_progress --limit 10 --json databaseId,name,createdAt | jq -r '.[] | select(((now - (.createdAt | fromdateiso8601)) > 3600)) | .databaseId' | xargs -I {} gh run cancel {}
```

---

## 12. STRUCTURE DES LIVRABLES

```
axionia/_AUDIT/DEPLOY-UNSTUCK-2026-05-18/
├── 00-REALITY-CHECK.md
├── 01-DIAGNOSTIC-PROFOND.md       (Phase 1, 6 sous-agents)
├── 02-PLAN-ESCALATION.md          (Phase 2)
├── 03-CYCLES-LOG.md               (Phase 4, par cycle)
├── 04-DEPLOY-VERIFICATION.md      (Phase 5)
├── 05-SMOKE-PROD-LIVE.md          (Phase 6)
├── VERDICT-FINAL-DEPLOY.md
├── EXEC-SUMMARY-WILL.md
└── MANIFEST.md
```

**Total** : 9 fichiers minimum. Volume 2000-5000 lignes.

---

## 13. CADRE TEMPOREL

| Phase                          | Effort typique | Plafond |
| ------------------------------ | -------------- | ------- |
| Phase 0 reality check          | 30 min         | 1 h     |
| Phase 1 diagnostic profond (6 //)| 45 min       | 2 h     |
| Phase 2 plan escalation        | 15 min         | 30 min  |
| Phase 3 application S#1        | 10 min         | 30 min  |
| Phase 4 self-healing cycles    | 1-5 h          | 6 h     |
| Phase 5 verification           | 10 min         | 30 min  |
| Phase 6 smoke prod             | 15 min         | 30 min  |
| Phase 7 verdict + livrables    | 15 min         | 30 min  |
| **TOTAL TYPIQUE**              | **3-7 h**      |         |
| **TOTAL PLAFOND**              | **12 h**       |         |

Si > 12 h cumulé → §28.

---

## 14. ESCALATION MATRIX DÉTAILLÉE (les 12 stratégies)

### S1 — `runs-on: ubuntu-latest-large` (32 GB RAM, $0.16/min)

Edit `.github/workflows/deploy-coolify.yml` :
```yaml
build:
  name: Build & push image to GHCR
  runs-on: ubuntu-latest-large   # was: ubuntu-latest
  timeout-minutes: 60
```

**Pré-requis** : paid runners activés sur le repo. Vérifier `Settings → Actions → Runners → Larger runners`.

Si non-activé : commit + push → run échoue avec "runner not available" → fallback S2.

### S2 — Disable `cache-from` (fresh build)

```yaml
- name: Build & push image
  uses: docker/build-push-action@v6
  with:
    ...
    # cache-from: type=gha   # disabled cycle <N> S2
```

### S3 — Cache strategy → registry

```yaml
- name: Build & push image
  uses: docker/build-push-action@v6
  with:
    ...
    cache-from: type=registry,ref=ghcr.io/will383842/axion-ia:buildcache
    cache-to: type=registry,ref=ghcr.io/will383842/axion-ia:buildcache,mode=max
```

### S4 — Split build multi-job

Decompose `build` job en 3 jobs :
1. **install-deps** : `pnpm install --frozen-lockfile` → upload cache.
2. **prisma-gen** : download install cache → `pnpm prisma:generate` → upload.
3. **next-build** : download prisma cache → `pnpm build` → docker build + push.

Implementation complexe (1-3h).

### S5 — Skip SSG villes/régions au build

Edit `next.config.ts` :
```typescript
export default {
  ...
  experimental: {
    ...
    // Skip pages dynamiques au build, fallback ISR
  },
  // Override per-route
  // Dans la page villes/régions :
  // export const dynamicParams = true;
  // export const revalidate = 3600;
  // export async function generateStaticParams() { return []; } // Empty au build
};
```

**Risque** : pages villes/régions seront générées au runtime (first hit slow).

### S6 — BuildKit memory limits

Add to workflow :
```yaml
- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v3
  with:
    driver-opts: |
      env.BUILDKIT_MAX_BUILD_PARALLELISM=2
      network=host
```

Et dans build-push-action :
```yaml
  with:
    ...
    build-args: |
      ...
    # docker/build-push-action doesn't directly expose --memory
    # Use shell-exec workaround if needed
```

### S7 — Build local + push manuel (bypass exceptionnel)

```bash
# Sur machine puissante (laptop 32+ GB RAM)
cd C:/Users/willi/Documents/Projets/Axion-IA/axionia
docker login ghcr.io -u will383842 -p $GITHUB_TOKEN
HEAD_SHA=$(git rev-parse HEAD)
SHORT_SHA=${HEAD_SHA:0:7}

docker buildx build \
  --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_SITE_URL=https://axion-ia.com \
  --build-arg NEXT_PUBLIC_APP_ENV=production \
  --build-arg BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --build-arg BUILD_SHA=$HEAD_SHA \
  --build-arg SKIP_ENV_VALIDATION=true \
  --build-arg DATABASE_URL=postgresql://stub:stub@stub.invalid:5432/stub \
  --build-arg REDIS_URL=redis://stub.invalid:6379 \
  -t ghcr.io/will383842/axion-ia:latest \
  -t ghcr.io/will383842/axion-ia:sha-$SHORT_SHA \
  -t ghcr.io/will383842/axion-ia:main \
  --push \
  .

# Then trigger Coolify deploy manually
curl -X POST "$COOLIFY_URL/api/v1/deploy?uuid=$COOLIFY_APP_UUID&force=false" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json"
```

**Risque** : nécessite docker local + creds GHCR + machine puissante.

### S8 — `runs-on: ubuntu-latest-large-4xl` (64 GB RAM, $0.64/min)

Comme S1 mais 4xl. Coût ~$10/build.

### S9 — Self-hosted runner Hetzner

Installer runner GH Actions sur VPS Hetzner CPX42 (16 GB) ou CCX23 (32 GB) dédié.

```bash
# Sur Hetzner
ssh root@178.105.55.15
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-x64-2.319.1.tar.gz -L https://github.com/actions/runner/releases/download/v2.319.1/actions-runner-linux-x64-2.319.1.tar.gz
tar xzf ./actions-runner-linux-x64-2.319.1.tar.gz
./config.sh --url https://github.com/will383842/axion-ia --token <REGISTRATION_TOKEN>
sudo ./svc.sh install && sudo ./svc.sh start
```

Puis edit workflow :
```yaml
build:
  runs-on: [self-hosted, hetzner-cpx42]
```

**Risque** : sécurité (runner = full repo access), maintenance (updates manuels).

### S10 — Instrumentation verbose

Ajouter au début du job build :
```yaml
- name: Background memory + disk monitor
  run: |
    (while true; do
      ts=$(date -u +%H:%M:%SZ)
      mem=$(free -m | grep Mem | awk '{printf "RAM used=%dMB free=%dMB", $3, $4}')
      disk=$(df -m / | tail -1 | awk '{printf "Disk used=%dMB free=%dMB", $3, $4}')
      load=$(uptime | sed 's/.*load average: //')
      echo "[$ts] $mem | $disk | load=$load"
      sleep 30
    done) > /tmp/build-monitor.log 2>&1 &
    echo "MONITOR_PID=$!" >> $GITHUB_ENV

- name: Build & push image
  ...

- name: Print monitor log on failure
  if: failure()
  run: |
    kill $MONITOR_PID 2>/dev/null || true
    echo "=== BUILD MONITOR LOG ==="
    cat /tmp/build-monitor.log || echo "(no log)"
    echo "=== FREE ==="
    free -h
    echo "=== DF ==="
    df -h
    echo "=== TOP ==="
    top -bn1 | head -20

- name: Print monitor log on success
  if: success()
  run: |
    kill $MONITOR_PID 2>/dev/null || true
    tail -50 /tmp/build-monitor.log || true
```

Et set ENV avant build :
```yaml
env:
  BUILDKIT_PROGRESS: plain
  DOCKER_BUILDKIT: 1
```

### S11 — Next.js experimental flags

Edit `next.config.ts` :
```typescript
experimental: {
  ...
  workerThreads: false,
  cpus: 1,
  webpackBuildWorker: false,
}
```

### S12 — SSG → ISR migration

Pour les villes/régions (~17 000 routes) :
- `export const dynamicParams = true;`
- `export const revalidate = 86400;`
- `generateStaticParams()` → retourner empty array `[]` au build.
- Pages servies via ISR runtime (first hit slow, ensuite cached).

---

## 15. ANTI-HALLUCINATION GUARDRAILS

### 15.1 Forbidden statements

❌ « Le déploiement a réussi » sans `gh run view <RUN_ID> --json conclusion` montrant `success`.
❌ « Le container redémarre » sans `ssh ... docker inspect` ou `curl Coolify API`.
❌ « Build SHA en prod = X » sans `curl -sI ... | grep x-axion-build-sha` output réel.
❌ « V2 servi » sans inspection du HTML response (DashboardV2 component class présent).
❌ « LHCI vert » sans gh run view du job LHCI.

### 15.2 Required citations

✅ Cite Run ID GH Actions (`26008830067`) chaque fois.
✅ Cite SHA git (`f193e2e`) chaque fois.
✅ Cite Coolify deployment UUID si dispo.
✅ Cite Container ID Docker si dispo.
✅ Cite digest SHA256 de l'image GHCR.
✅ Cite commande exacte + output réel.

### 15.3 Marquage 🟡 UNVERIFIED

Si tu ne peux pas vérifier (pas d'accès SSH, pas de token Coolify) → 🟡 UNVERIFIED avec raison.

Tente toujours une voie alternative (`curl` public, header `x-axion-build-sha`).

---

## 16. RÈGLES DE COMMITS

- ✅ Conventional Commits : `fix(deploy):`, `chore(deploy):`, `docs(deploy):`.
- ✅ Header ≤ 100 chars.
- ✅ Body : root cause + fix + cycle + escalation next.
- ✅ Co-Authored-By: Claude Opus 4.7.
- ✅ Pre-commit hooks DOIVENT passer.
- ❌ `--no-verify` JAMAIS.
- ❌ `--amend` sur commit pushed.

---

## 17. RÈGLES DE PUSH

- ✅ `git push origin main` (rebase si non-FF).
- ✅ `git push origin --tags` (jamais `--force`).
- ❌ `git push --force` jamais.
- ❌ Push d'un fix non-validé localement (typecheck minimum).

---

## 18. ROLLBACK SAFETY NETS

Niveaux disponibles :
1. **Niveau 1 (instant)** : `git revert <SHA>` du commit problématique + push. Pipeline redéploie le revert.
2. **Niveau 2 (rapide)** : Si nouvelle image catastrophique, Coolify Settings → Tag → ancien SHA → redeploy.
3. **Niveau 3 (radical)** : Coolify Settings → Rollback to previous → image baseline.
4. **Niveau 4 (catastrophe)** : Restore from backup SQL + Hetzner snapshot.

Niveau 1 est toujours le premier réflexe.

---

## 19. PLAFONDS DE SÉCURITÉ

- ⏱️ Temps total : ≤ 12 h.
- 🔁 Cycles Phase 4 : ≤ 12.
- 💸 Coût additionnel runners : ≤ $50 cumulé (notifier Will au-delà).
- 🔧 Commits fix Phase 3+4 : ≤ 20.
- 🌐 Si SSH Hetzner indispo + Coolify API indispo + déploiement nécessaire → S7 (build local) en fallback.

Si plafond dépassé → §28.

---

## 20. STOP & ASK CONDITIONS (4 cas catastrophiques)

🛑 **STOP & ASK uniquement si** :

### Cas 1 — Plafonds dépassés
- Temps > 12 h.
- Cycle > 12 sans succès.
- Coût runner > $50.

### Cas 2 — Risque prod
- Action nécessaire qui mettrait la prod hors-ligne > 5 min.
- Découverte d'une fuite de secret dans un commit existant.
- Demande de `git push --force` sur main.

### Cas 3 — Dépendances majeures
- Activation paid runners requiert l'accord billing Will.
- Self-hosted runner requiert SSH + sudo Hetzner → nécessite Will pour les creds.
- Modification env vars Coolify avec impact prod (DATABASE_URL, AUTH_SECRET).

### Cas 4 — Pipeline irréparable cloud
- 12 cycles épuisés, toutes les stratégies S1-S12 tentées.
- Décision Will requise sur : (a) self-hosted, (b) migration Vercel/Render, (c) split repo.

**Dans tout autre cas** → diagnostique + fix + continue.

---

## 21. ANTI-PATTERNS À ÉVITER

❌ Lancer `pnpm build` local pour valider (ADR 0026 délègue à GH Actions).
❌ Modifier `prisma/schema.prisma`.
❌ Modifier la magic string `stub.invalid` sans propager.
❌ Toucher `axionia/CLAUDE.md` / `AGENTS.md`.
❌ Force push main.
❌ Commit `--no-verify`.
❌ Hijacker des secrets (DATABASE_URL prod, etc.).
❌ Spawner > 6 sous-agents en parallèle.
❌ Sleep busy-loop (utiliser Monitor).
❌ Re-run successifs sans changer la stratégie (gaspillage).
❌ Ignorer les logs Coolify côté VPS si SSH dispo.

---

## 22. CHECKLIST DE FIN D'AUTOPILOT

```
[ ] Phase 0 reality check produit + état git/runs/prod documenté
[ ] Phase 1 diagnostic 6 sous-agents // → cause racine identifiée
[ ] Phase 2 plan escalation établi avec S1-S12 prioritisé
[ ] Phase 3 stratégie #1 appliquée + commit + push
[ ] Phase 4 cycles self-healing jusqu'à success (ou §28)
[ ] Phase 5 deploy effective vérifié (Coolify pull + container restart + healthcheck)
[ ] Phase 6 smoke prod V1 + V2 + LHCI ✅
[ ] Phase 7 verdict final + livrables + mémoire
[ ] Tag `deploy-unstuck-2026-05-18-success` posé + pushé
[ ] Tous les runs zombies cancellés
[ ] Build SHA header en prod = HEAD SHA ✅
[ ] V2 component spotcheck réussi (cookie admin_v2=1)
[ ] LHCI 5/5 URLs ≥ 90 ✅
[ ] Coût cumulé documenté pour Will
```

---

## 23. RESSOURCES

- Master prompt précédent audit verif-fix-deploy : `Axion-IA/_AUDIT/PROMPT-ADMIN-REFONTE-VERIFY-FIX-DEPLOY-AUTOPILOT-2026-05-18.md`
- Audit verif-fix-deploy livrables : `axionia/_AUDIT/ADMIN-REFONTE-VERIF-FIX-DEPLOY-2026-05-18/**`
- Phase 10 self-healing log précédent : `axionia/_AUDIT/ADMIN-REFONTE-VERIF-FIX-DEPLOY-2026-05-18/PHASE-10-SELF-HEALING-LOG.md`
- ADR 0026 (build externalisé) : `axionia/docs/adr/0026-build-externalise-gh-actions.md`
- Doctrine sub-repo : `axionia/CLAUDE.md` + `axionia/AGENTS.md`
- Workflow `deploy-coolify.yml` : `axionia/.github/workflows/deploy-coolify.yml`
- Workflow `coolify-diagnose.yml` + `coolify-zombie-cleanup.yml`
- Dockerfile : `axionia/Dockerfile`
- Dockerfile pull : `axionia/Dockerfile.coolify-pull`

---

## 24. PHRASE D'INVOCATION (rappel)

Dans une **nouvelle conversation Claude Code** :

```
Exécute en autopilot complet bout-en-bout le prompt
_AUDIT/PROMPT-DEPLOY-UNSTUCK-AUTOPILOT-2026-05-18.md.
Mission unique : faire passer le déploiement Coolify prod en SUCCESS,
diagnostiquer en profondeur, vérifier disque + RAM + GHCR + Coolify + VPS,
appliquer toutes les fixes nécessaires y compris ubuntu-latest-large /
multi-stage / cache strategy / runner self-hosted si besoin, retry jusqu'à
succès. Autorisation Will déjà donnée. NE PAS S'ARRÊTER sauf 4 cas
catastrophiques §28. Confirme par « GO autopilot deploy » et démarre Phase 0.
```

L'agent doit répondre par « GO autopilot deploy » et démarrer Phase 0 immédiatement.

---

**Fin du prompt.** Toute déviation = STOP & ASK §28 ou addendum dans `00-REALITY-CHECK.md`.

---

## ANNEXE A — Best practices 2026 pour deploy autopilot

### A.1 Méthodologie diagnostic

- **Cite-don't-guess** : chaque assertion = preuve commande + output réel.
- **Multi-agent parallel** : 6 angles en // > 1 séquentiel (gain 5×).
- **Instrumentation avant fix** : ajouter logs/metrics AVANT de modifier la config (S10 toujours en parallèle de S1).
- **Hypothèse + falsification** : énoncer 3 hypothèses ranked par probabilité, prouver/réfuter chacune.

### A.2 Méthodologie escalation

- **Matrice effort × probabilité succès** : commencer par effort min / proba max.
- **Coût croissant** : free → paid runner → self-hosted → bypass manuel.
- **Reversibilité** : préférer fixes facilement reversibles (config workflow > Dockerfile structurel).
- **Documenter chaque cycle** : permet d'arrêter au bon moment.

### A.3 Méthodologie verification

- **Multi-niveau** : GH Actions run → GHCR image push → Coolify webhook → Container running → Healthcheck → Smoke routes → Header build-sha.
- **End-to-end** : pas juste « le build a réussi » mais « la nouvelle image est servie à l'utilisateur final ».
- **Smoke différentiel** : avant/après build SHA header pour confirmer.

### A.4 Anti-patterns 2026

- ❌ Re-run sans changer la stratégie (Einstein : insanity).
- ❌ Trop changer en une fois (impossible de bisecter).
- ❌ Ignorer les logs partiels (souvent contiennent un indice).
- ❌ Spawner > N agents (overhead synchro).
- ❌ Polling busy-loop (utiliser Monitor / webhook).
- ❌ Fix « cargo-culte » (copier sans comprendre).
- ❌ Skip smoke prod final (déploiement ≠ servi à user).

### A.5 Communication Will

- TL;DR 5 lignes en haut de chaque doc.
- Actions Will ≤ 3, prioritisées.
- Coût cumulé documenté.
- Lien direct vers les preuves (Run ID, logs).
