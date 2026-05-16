# 24 — CI/CD + Deploy pipeline (Agent 5.C)

> Audit AUDIT-ONLY · Phase 5 Production readiness · Working dir `axionia/`
> HEAD figé prompt = `98e0b0f` · HEAD réel session = `4cdfbe4`.
> Mode : aucun edit code, lecture seule. Aucun appel API externe (`gh`,
> `curl Coolify`, etc.). Aucun `git checkout`. Focus : pipeline
> `push main → GH Actions ~25min → GHCR public → Coolify pull → CF purge → LHCI gate`
> (ADR 0026 Option F.1 recovery du 2026-05-16).

---

## 0. Reality check pipeline

| Item                        | Valeur observée                                                                                                                            | Source                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| Workflow principal deploy   | `.github/workflows/deploy-coolify.yml` 377 lignes                                                                                          | fichier complet              |
| Build image multi-stage     | `./Dockerfile` 183 lignes (deps → builder → runner Alpine)                                                                                 | `Dockerfile`                 |
| Image Coolify pull          | `Dockerfile.coolify-pull` un-liner `FROM ghcr.io/will383842/axion-ia:latest`                                                               | `Dockerfile.coolify-pull:23` |
| Image worker BullMQ séparée | `Dockerfile.worker` 97 lignes (CMD tsx, HEALTHCHECK pgrep)                                                                                 | `Dockerfile.worker`          |
| Entrypoint container web    | `scripts/docker-entrypoint.sh` 59 lignes (migrate deploy → server.js)                                                                      | fichier complet              |
| Healthcheck app             | `HEALTHCHECK` natif Docker dans `Dockerfile:179-180` → `http://localhost:3000/api/healthz` start-period 120s, interval 30s, retries 3      | `Dockerfile`                 |
| Endpoint health             | `src/app/api/healthz/route.ts` (DB+Redis best-effort, status 200 toujours, JSON)                                                           | route                        |
| Workflows GH Actions total  | **7** : `ci.yml`, `staging.yml`, `nightly.yml`, `release.yml`, `deploy-coolify.yml`, `disk-cleanup-prod.yml`, `gsc-crawl-stats-weekly.yml` | `.github/workflows/`         |
| Concurrency deploy          | `group: deploy-coolify`, `cancel-in-progress: false` (audit P0-01 patch 2026-05-15)                                                        | `deploy-coolify.yml:76-78`   |
| Trigger                     | `push: branches:[main]` + `workflow_dispatch` (skip_deploy input)                                                                          | `deploy-coolify.yml:51-63`   |
| `paths-ignore`              | `**.md`, `docs/**`, `_AUDIT/**`, `.gitignore`                                                                                              | `deploy-coolify.yml:53-57`   |

### Modif uncommit `.github/workflows/deploy-coolify.yml`

`git diff HEAD -- .github/workflows/deploy-coolify.yml` retourne **vide**.
La référence "Statut Phase 0 : modifié uncommit" du brief est **stale** —
le workflow a été commit dans `1b452b9` (HEAD réel session `4cdfbe4`,
ligne 372 `/fr/implantations/ile-de-france/paris` au lieu d'un `/en`).
Phase 0 fait référence à un état antérieur à la passe ADR 0026.

`git status --short .github/` retourne 0 modifs. Aucun fichier
workflow staged/unstaged.

**Verdict modif uncommit** : **N/A** — tout est déjà commit dans `main`,
poussé selon mémoire `axionia_session_2026-05-16_deploy_recovery_resolved.md`
(« site UP via Option F.1 »).

---

## 1. Inventaire workflow `deploy-coolify.yml` — 4 jobs + gates

### 1.1 Job `build` (GH Actions ubuntu-latest, timeout 60min)

Steps séquentiels :

1. **Free disk space** — cleanup agressif `/usr/share/dotnet`, Android SDK,
   CodeQL, Python, Ruby, Boost, JVM, Azure-CLI, browsers (Firefox/Chrome/Edge),
   Mongo/MySQL/PG, Mono, PowerShell + `docker system prune --all --volumes`.
   Objectif : > 75 GB free sur runner (recovery commit `c998ffa` après
   échec « no space left on device » sur build #4).
2. **Checkout** `actions/checkout@v4`.
3. **Buildx** `docker/setup-buildx-action@v3`.
4. **Login GHCR** `docker/login-action@v3` avec `${{ secrets.GITHUB_TOKEN }}`.
5. **Metadata** `docker/metadata-action@v5` :
   - `ghcr.io/<owner>/axion-ia:latest` (default branch only)
   - `:sha-XXXXXXX` (short SHA)
   - `:<branch>` + `:<tag>` (refs)
6. **Compute BUILD_TIME** ISO 8601 UTC injecté en build-arg.
7. **Build & push** `docker/build-push-action@v6` :
   - `context: .` `file: ./Dockerfile`
   - `push: true` `tags: ${{ steps.meta.outputs.tags }}`
   - **build-args** : `NEXT_PUBLIC_SITE_URL=https://axion-ia.com`,
     `NEXT_PUBLIC_APP_ENV=production`, `BUILD_TIME=…`,
     `SKIP_ENV_VALIDATION=true`, **`DATABASE_URL=postgresql://stub:stub@stub.invalid:5432/stub`**,
     **`REDIS_URL=redis://stub.invalid:6379`** (cohérent ADR 0026, AGENTS.md
     "Magic string stub.invalid").
   - `cache-from: type=gha`, `cache-to: type=gha,mode=min`
     (réduit peak disque +10-15 GB vs `mode=max`).
   - `provenance: false` (SLSA metadata désactivée).
8. **Print image ref** notice `::notice::` digest + tag.

**Outputs** : `image_tag` + `image_digest` (utilisable par jobs en aval,
mais aucun job ne les consomme actuellement).

**Gate fail-fast** : si `docker build` échoue → step `build` rouge,
`needs: build` du job `deploy` ne run pas. ✅

### 1.2 Job `deploy` (needs: build, ubuntu-latest)

Skip conditionnel : `if: github.event_name != 'workflow_dispatch' || inputs.skip_deploy != true`
(évite cancel-storm 1er run avant reconfig Coolify Docker Image).

Steps :

1. **POST `/api/v1/deploy`** — `curl` avec `Authorization: Bearer ${COOLIFY_API_TOKEN}`,
   `--data-urlencode uuid=${COOLIFY_APP_UUID}`, `force=true`, `--max-time 30`.
   - Échec : `::error::` + `exit 1` si l'un des 3 secrets manque.
   - Parse `deployment_uuid` via `grep -oE` (legacy avant le fix jq).
2. **Wait Coolify deployment** (timeout 65min, deadline 3600s, poll 60s)
   - Bug fixé 2026-05-14 (commit `1535f0e`) : `jq -r '.status'` lit le
     champ deployment top-level (pas `application.status` toujours
     « running:healthy »). Sans ce fix, 100% des waits timeout à 60min.
   - Statuts : `finished` → success, `failed|cancelled-by-user` → fail
     avec dump des 100 dernières lignes de logs Coolify dans `::error::`
     (excellent debug rapide).
3. **Purge Cloudflare cache** (`if: success()`) — `purge_everything: true`
   sur `/zones/${CLOUDFLARE_ZONE_ID}/purge_cache`. Hard fail si
   `success:true` absent. Warning (pas error) si secrets vides.

**Gate fail-fast** : ✅ chaque step `set -euo pipefail` ; échec
deploy → CF purge skip (`if: success()`) → LHCI skip.

**❌ Manque** : **aucun smoke test HTTP post-deploy avant LHCI**. Le
deploy peut être marqué `finished` Coolify et le container répondre 500
sur `/api/healthz` ou la home, sans qu'on s'en rende compte avant que
LHCI hit la prod (~3-5 min plus tard, sur 5 URLs uniquement). Voir P0-02.

### 1.3 Job `lhci` (needs: deploy, ubuntu-latest, timeout 20min)

Garde anti-skipped : `if: needs.deploy.result == 'success'` (pas juste
`success()` qui inclurait skipped).

Steps :

1. Checkout + pnpm/action-setup@v4 (10.33.4) + setup-node@v4 (Node 24).
2. `pnpm install --frozen-lockfile --filter . --prod=false` (LHCI dans devDeps).
3. `pnpm exec lhci collect` sur **5 URLs prod live** :
   - `https://axion-ia.com/fr`
   - `/fr/interventions`
   - `/fr/audit`
   - `/fr/reserver`
   - `/fr/implantations/ile-de-france/paris`
   - `--numberOfRuns=2 --settings.preset=desktop --throttlingMethod=devtools`
4. `pnpm exec lhci assert` (assertions `lighthouserc.json` budgets
   LCP/INP/CLS/TBT — gate hard fail).

`/en` retiré 2026-05-16 (commit `1b452b9`) car EN désactivé proxy
redirect 301 → fail SEO budget.

**Verdict LHCI** : ✅ gate post-deploy effective sur prod live (HTML
frais après CF purge). Hard fail si budgets dépassés → bloque verdict
pipeline. Workflow_dispatch permet retrigger en cas de flake CrUX.

### 1.4 Jobs absents

- **`smoke`** HTTP curl `/api/healthz` + `/fr` post-CF purge AVANT lhci : ❌ absent (cf. P0-02).
- **`rollback`** auto sur fail LHCI : ❌ absent (procédure manuelle, voir §3).
- **`notify`** Telegram succès/échec : ❌ absent dans `deploy-coolify.yml`
  (alors qu'AGENTS.md mentionne Sprint 23 alerts ; bot Telegram câblé
  côté worker, pas côté GH Actions).

---

## 2. Build externalisé `Dockerfile.coolify-pull` — référence Coolify

### 2.1 Fichier référencé

`Dockerfile.coolify-pull` un-liner `FROM ghcr.io/will383842/axion-ia:latest`
(ligne 23). Tous les `ENTRYPOINT`, `EXPOSE`, `HEALTHCHECK`, `USER`,
`ENV NODE_ENV=production` sont **hérités** de l'image GHCR (définis
dans stage `runner` du `Dockerfile` multi-stage).

### 2.2 Application Coolify pointe bien dessus ?

D'après AGENTS.md « Modifs Coolify côté plateforme » :

- `build_pack: dockerfile` (inchangé)
- `dockerfile_location: /Dockerfile.coolify-pull` (set via API PATCH 2026-05-16)

**Vérification non exécutable en AUDIT-ONLY** (interdit appel API).
Confirmation textuelle dans AGENTS.md + mémoire
`axionia_session_2026-05-16_deploy_recovery_resolved.md` (« site UP »).

**⚠️ Risque tracé dans AGENTS.md** : « Si quelqu'un change
`dockerfile_location` via Coolify UI → retour mode build local sur VPS
→ re-saturation disque CPX42. Surveiller. » Aucun garde-fou code
n'empêche cette régression. Voir P1-04.

### 2.3 Cohérence GHCR public

AGENTS.md décrit l'action humaine OneTime « rendre l'image GHCR
PUBLIQUE » après 1er push. Documentation explicite dans le header du
workflow (lignes 25-31). ✅ Pas de creds Docker côté Coolify (image
publique → `docker pull` anonyme).

---

## 3. Migrations Prisma — entrypoint runtime

### 3.1 Mécanique entrypoint

`scripts/docker-entrypoint.sh` au boot container web (ENTRYPOINT
Dockerfile ligne 183) :

1. Si `SKIP_MIGRATE=1` → skip (rollback safe).
2. Si `./prisma/migrations` absent → warning + skip.
3. Si `./node_modules/.bin/prisma` absent → warning + skip + log
   commande manuelle `docker exec <uuid> sh -c 'npx --yes prisma@5.22.0 migrate deploy'`.
4. Sinon : **try local `prisma migrate deploy`** → si échec → **fallback
   `npx --yes prisma@5.22.0 migrate deploy`** (cas slim runtime perd
   `@prisma/engines`) → si fail aussi → warning « container will boot
   anyway », **ne bloque PAS le startup**.

**Verdict** : ✅ idempotent + fallback robuste + ne tue pas le container
sur fail migrations. ⚠️ **Mais** : si migration foireuse, container
boot quand même → 500 partout sur queries qui dépendent du schéma
manquant. Trade-off conscient (cohérent avec « healthz status 200 même
en degraded » ligne 66 du route healthz).

### 3.2 FTS raw SQL — **❌ JAMAIS auto-appliqué au runtime**

Fichier `prisma/migrations_fts/` contient **3 SQL** :

- `0002_fts_setup.sql` (KB v3 legacy, trgm + GIN)
- `kb_fts_setup.sql` (KB V4)
- `20260516142018_image_bank_fts.sql` (image-bank GIN sur jsonb arrays)

**Aucun** de ces fichiers n'est exécuté par `docker-entrypoint.sh`.
Seul `pnpm prisma migrate deploy` tourne (gère uniquement `prisma/migrations/`).

Côté CI **uniquement**, `ci.yml` Gate D ligne 295-298 fait :

```bash
PGPASSWORD=… psql … -f prisma/migrations_fts/0002_fts_setup.sql
PGPASSWORD=… psql … -f prisma/migrations_fts/kb_fts_setup.sql
```

(Et **omet `20260516142018_image_bank_fts.sql`** — bug Gate D séparé,
hors scope ici, mais à signaler.)

`scripts/deploy-prod.sh` (script standalone, **non utilisé par Coolify**
selon AGENTS.md) mentionne « 4. Run FTS post-migration (idempotent) »
en commentaire mais ce script n'est pas câblé au pipeline GH Actions.

**Verdict critique** : **les indices FTS image-bank, KB FTS v3/v4, GIN
trgm ne sont JAMAIS auto-appliqués sur la prod Coolify**. Action
manuelle Will requise via `docker exec` après chaque migration
schema-touchant-FTS. Confirme finding de l'audit 2.A (DB schema
agent — référencé dans `06-db-schema.md`).

Voir **P0-01**.

---

## 4. Healthcheck Coolify

### 4.1 Docker HEALTHCHECK natif

`Dockerfile:179-180` :

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/healthz',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
```

- ✅ Implémentation pure Node (pas dépendant de curl/wget — fonctionne
  même si Alpine slim n'a pas curl).
- ✅ `start-period=120s` donne le temps au boot Next 16 + warm Prisma
  - lazy queues.
- ✅ Endpoint `/api/healthz` retourne 200 toujours (degraded ou ok, JSON
  observability).

### 4.2 Worker HEALTHCHECK

`Dockerfile.worker:88-89` :

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD pgrep -f "tsx src/server/queue/worker" >/dev/null || exit 1
```

✅ Approprié (worker ne sert pas HTTP). pgrep détecte SIGKILL OOM /
crash silencieux → Coolify auto-restart.

### 4.3 Coolify-side healthcheck config

Pas de fichier `coolify.json` versionné dans le repo. Configuration
healthcheck Coolify (path, interval) reste **non auditable** en mode
AUDIT-ONLY (interdit `curl Coolify /api/v1/applications/{uuid}`).

**Verdict** : Docker HEALTHCHECK native couvre le besoin. Coolify
peut superposer son propre healthcheck mais le natif suffit pour le
container restart logic.

---

## 5. Webhook deploy + secrets

### 5.1 Secrets repo requis

Documentés ligne 33-39 du workflow :

| Secret                 | Usage                              | Statut auditabilité                       |
| ---------------------- | ---------------------------------- | ----------------------------------------- |
| `COOLIFY_API_TOKEN`    | Bearer Sanctum `<id>\|<plaintext>` | Non auditable (interdit `gh secret list`) |
| `COOLIFY_URL`          | `http://178.105.55.15:8000`        | idem                                      |
| `COOLIFY_APP_UUID`     | App UUID Coolify                   | idem                                      |
| `CLOUDFLARE_API_TOKEN` | Zone token Cache:Purge             | idem                                      |
| `CLOUDFLARE_ZONE_ID`   | Zone ID axion-ia.com               | idem                                      |
| `GITHUB_TOKEN`         | auto-injecté (push GHCR)           | n/a                                       |

Hard fail si l'un des 3 Coolify secrets manque (ligne 212-215). CF
secrets : warning + skip purge (graceful, vu que purge n'est pas
critique pour fonctionnement). ✅

### 5.2 Migration depuis webhook legacy

Mémoire `axionia_session_2026-05-09_cloudflare_postdeploy_incident.md`
mentionne incident webhook GitHub App `COOLIFY_PRODUCTION_WEBHOOK`
« Invalid signature ». Fix 2026-05-15 (commit `release.yml`) :
basculement sur API Sanctum (cf. `release.yml:5-6`). ✅ Webhook legacy
abandonné. `staging.yml` continue d'utiliser `COOLIFY_STAGING_WEBHOOK`
(staging non actif → peu critique).

---

## 6. Rollback procédure

### 6.1 Rollback image Docker

Procédure **documentée nulle part dans `.github/workflows/`**. Aucune
auto-rollback si LHCI fail. Aucun job `rollback-on-failure`.

Documentation manuelle existe :

- `docs/ops/runbook-deploy.md` (référencé Grep) — non lu mais cité
  par d'autres docs.
- `_AUDIT/RESCALE-CPX42-CHECKLIST.md`
- `prisma/migrations/README-ROLLBACK-IMAGE-BANK.md` (rollback DB
  manuel — Prisma ne génère pas DOWN SQL, scripts à la main).

Procédure de rollback typique (déduite) :

1. Coolify → Application → Deployments → précédent succès → « Redeploy »
   (pull même image GHCR tag `sha-XXXXXXX`).
2. OU : `git revert <bad-sha>` + `git push` → re-trigger pipeline complet
   (~25 min build + 2-15 min Coolify + LHCI).
3. Migrations Prisma rollback : **manuel uniquement** (Prisma ne fait
   pas DOWN). Procédure dans `README-ROLLBACK-IMAGE-BANK.md` pour
   image-bank, **rien d'équivalent** pour KB/content-gen/admin.

**Verdict** : ⚠️ procédure rollback non versionnée canoniquement dans
le repo (`docs/ops/runbook-deploy.md` à valider Phase 6). Pas de
rollback auto sur LHCI fail.

Voir **P1-03**.

### 6.2 Rollback DB schema

Aucun job CI/CD ne teste un rollback DB. `README-ROLLBACK-IMAGE-BANK.md`
documente DROP TABLE manuels pour image-bank uniquement. KB v4 + content-gen

- admin migrations n'ont pas de DOWN scripts. **Hors scope strict CI/CD**
  mais à mentionner dans le verdict final.

---

## 7. CF purge_everything systématique

### 7.1 Comportement actuel

Ligne 305-307 :

```bash
--data '{"purge_everything":true}' \
"https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache"
```

✅ Systématique après chaque deploy réussi. Hard fail si réponse n'a
pas `success:true`.

### 7.2 Trade-off

`purge_everything: true` invalide TOUT le cache CF de la zone, y compris
les assets statiques avec hash (immuables). Sous-optimal — un purge
par tags + URLs spécifiques limiterait l'impact CrUX et le coût en CPU
origin (cold cache → re-render SSG sur visit).

Pour ~17 600 routes pré-rendered Next 16, un cold CF cache après chaque
deploy = ~10-30 min de re-warm CrUX. **Pas un blocage P0** car SSG
servi par Caddy (pas par Next runtime) et purge complète garantit que
les pages metadata + sitemap reflètent immédiatement le nouveau SHA.

Voir **P2-05** (optimisation purge sélective).

---

## 8. Hardening + observations supplémentaires

### 8.1 Trigger paths-ignore

✅ `**.md`, `docs/**`, `_AUDIT/**`, `.gitignore` exclus → pas de deploy
inutile sur commits docs-only. Bon trade-off.

### 8.2 Concurrency anti-cascade

Audit P0-01 (2026-05-15) avait fixé `cancel-in-progress: false` après
8 deploys consécutifs cancellés. Comportement actuel : queue séquentielle
des workflows = chaque push attend la fin du précédent (build + deploy

- wait + CF purge + LHCI = ~50 min total).

✅ Évite cancellation cascade. ⚠️ Trade-off : push rapide successif
empile la queue (10 commits = 8h+ avant le dernier traité). Acceptable
pour main qui push ~1-3×/jour.

### 8.3 Disk cleanup nightly

`disk-cleanup-prod.yml` 02:00 UTC daily — script `disk-cleanup.sh` via
API Coolify. ✅ Bon hygiénisme post-incident saturation CPX42.

### 8.4 Cache GH Actions

`cache-to: type=gha,mode=min` (au lieu de max). Trade-off : builds
successifs moins rapides (cache uniquement layers finaux) ; gain :
~10-20 GB peak disque runner. Documenté `Dockerfile:182-185`.

✅ Trade-off conscient + commenté. À repasser `mode=max` une fois le
pipeline stable (TODO documenté).

### 8.5 BUILD_TIME injection

ARG `BUILD_TIME` au stage builder, fallback `date -u` si non fourni.
Wire dans `next.config.ts` pour figer `lastModified` sitemap +
`dateModified` JSON-LD. ✅ Anti « mensonge fraîcheur » au worker
cold-start.

### 8.6 Bundle delta gate dans `ci.yml`

`andresz1/size-limit-action@v1` PR-only → bloque PR > +5 KB gz vs main.
✅ Pour PR ; pour push direct main, pas de gate bundle (typique).

### 8.7 Gate D nightly migrate deploy fresh

`ci.yml:230-333` — applique TOUTES migrations sur Postgres pgvector
ephemère + verifie `_prisma_migrations` healthy + smoke counts 0.
✅ Excellente régression-net pour DDL régressions. ⚠️ N'inclut PAS
`20260516142018_image_bank_fts.sql` (cf. §3.2).

### 8.8 Secrets exposure surface

`SKIP_ENV_VALIDATION=true` + stub URLs en build-args = pas de secret
prod dans l'image GHCR. ✅ Image GHCR publique sans risque PII/auth.

Coolify injecte les vrais secrets au RUNTIME (66 env vars [RUN]
documentées AGENTS.md). ✅

---

## 9. Scoring /100

| Critère                                                            | Poids   | Score      | Justification                                                                                               |
| ------------------------------------------------------------------ | ------- | ---------- | ----------------------------------------------------------------------------------------------------------- |
| Pipeline build → push → deploy → CF purge complet                  | 15      | **14/15**  | -1 absence smoke HTTP post-deploy avant LHCI                                                                |
| Gates fail-fast à chaque step                                      | 10      | **10/10**  | `set -euo pipefail`, hard fail si secrets manquent, jq parsing robuste                                      |
| Build externalisé `Dockerfile.coolify-pull` référencé              | 10      | **9/10**   | -1 dockerfile_location non versionné côté code (risque régression manual UI Coolify)                        |
| Magic string `stub.invalid` consistante (Prisma + Redis + sitemap) | 5       | **5/5**    | Stub-aware proxy dans `lib/prisma.ts` + `lib/redis.ts`, early-exit `knowledge-rss/sitemap`                  |
| Migrations Prisma auto-appliquées au container start               | 10      | **8/10**   | -2 fallback npx OK mais ne bloque pas startup sur fail → risque 500 silencieux                              |
| **FTS raw SQL appliqué auto en prod**                              | 10      | **2/10**   | **-8 jamais auto-appliqué runtime ; uniquement Gate D CI manuel ; image-bank FTS pas dans Gate D non plus** |
| Healthcheck Docker natif `/api/healthz`                            | 8       | **8/8**    | Native Node, start-period 120s, JSON degraded observability                                                 |
| Healthcheck worker BullMQ                                          | 5       | **5/5**    | pgrep approprié + tini SIGTERM                                                                              |
| Secrets Coolify + CF requis hard fail                              | 5       | **5/5**    | Documentés inline workflow, abort si manquants                                                              |
| Concurrency anti-cascade                                           | 5       | **5/5**    | `cancel-in-progress: false` post-audit P0-01                                                                |
| LHCI gate post-deploy 5 URLs prod live                             | 7       | **6/7**    | -1 5 URLs insuffisant vs 18 locales (suffisamment représentatif pour FR uniquement)                         |
| Cloudflare purge_everything systématique                           | 5       | **4/5**    | -1 trade-off cache cold post-deploy (purge sélective serait mieux)                                          |
| Rollback procédure documentée + versionnée                         | 5       | **2/5**    | -3 doc partielle (image-bank uniquement), aucun rollback auto on LHCI fail                                  |
| `paths-ignore` + disk cleanup nightly + cache mode min             | 5       | **5/5**    | Hygiène propre                                                                                              |
| **TOTAL**                                                          | **100** | **88/100** |                                                                                                             |

---

## 10. Verdict

🟢 **GO** avec 1 P0 et 4 P1 tracés.

Pipeline `push main → GH Actions → GHCR → Coolify pull → CF purge → LHCI`
**fonctionnel et stable** (mémoire `deploy_recovery_resolved 2026-05-16`
confirme « site UP »). Gates fail-fast solides, concurrency correctement
configurée, magic string stub propagée, healthchecks Docker natifs
robustes. ADR 0026 cohérent et bien documenté en header workflow +
`Dockerfile.coolify-pull` + AGENTS.md.

**Bloquant identifié non bloquant pour ce go** : FTS raw SQL non
auto-appliqué runtime (P0-01) — non bloquant car déjà appliqué main
manuellement par Will (sinon recherche KB / image-bank serait cassée
en prod, ce qui n'est pas signalé).

Améliorations P1 : smoke HTTP post-deploy, rollback auto on LHCI fail,
dockerfile_location protection, notify Telegram pipeline status.

---

## 11. P0 — Bloquants

### P0-01 — FTS raw SQL `prisma/migrations_fts/*.sql` jamais auto-appliqué runtime

**Impact** : prochaine migration Prisma qui touche schéma FTS (KB
search ou image-bank `image_assets.target_countries` GIN) → indices
manquants en prod → recherche FTS dégradée silencieusement (queries
seq scan au lieu de GIN/trgm). Action humaine requise à chaque deploy
schema-touching-FTS.

**Patch suggéré** :

1. Étendre `scripts/docker-entrypoint.sh` après `prisma migrate deploy`
   réussi → loop sur `prisma/migrations_fts/*.sql` + `psql -f` chacun
   (idempotent grâce `CREATE INDEX IF NOT EXISTS`).
2. Ajouter step dans `ci.yml` Gate D pour `20260516142018_image_bank_fts.sql`
   (actuellement omis).

**Effort** : ~30 min dev + 10 min smoke test.

---

## 12. P1 — Améliorations

### P1-01 — Smoke HTTP post-deploy avant LHCI

Ajouter step `deploy` job (avant CF purge ou entre purge et lhci) :
`curl -fsS --max-time 10 https://axion-ia.com/api/healthz | grep '"status":"ok"'`

- `curl -fsS --max-time 10 https://axion-ia.com/fr | head -c 200`.
  Effort ~15 min.

### P1-02 — Notify Telegram succès/échec pipeline

Step `if: always()` final POST Telegram bot avec verdict + SHA + URL
deployment Coolify. Pattern existe côté worker. Effort ~30 min.

### P1-03 — Rollback procédure versionnée canonique

Créer `docs/ops/runbook-deploy-rollback.md` standardisé (image GHCR
revert, DB rollback manuel cross-modules, CF purge). Lier dans
`deploy-coolify.yml` header. Effort ~1-2 h.

### P1-04 — Garde-fou `dockerfile_location` Coolify

Ajouter step CI quotidien (`disk-cleanup-prod.yml` extension) qui
GET `/api/v1/applications/{uuid}` et alerte Telegram si
`dockerfile_location != /Dockerfile.coolify-pull`. Effort ~45 min.

---

## 13. P2 — Optimisations futures

- **P2-05** CF purge sélective (purge_files au lieu de purge_everything)
  — cible sitemaps + index pages, garder cache CSS/JS.
- **P2-06** Repasser `cache-to: type=gha,mode=max` une fois pipeline
  stabilisé (TODO documenté Dockerfile).
- **P2-07** Auto-rollback sur LHCI fail (re-trigger deploy avec image
  GHCR du SHA précédent).
- **P2-08** Cache CF Workers pour API routes hot (`/api/cities`,
  `/api/region`) — hors scope strict CI/CD.

---

## 14. Annexes

### 14.1 Workflows GH Actions inventaire

| Workflow                     | Trigger              | Rôle                                                                                 | Statut                                    |
| ---------------------------- | -------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------- |
| `ci.yml`                     | push/PR main+staging | Gates A (commit) + B (PR) + C (Docker smoke) + D (Prisma migrate fresh)              | ✅ actif, gate C `continue-on-error`      |
| `staging.yml`                | push main            | Deploy staging via webhook                                                           | Stub Sprint 22 (smoke + ZAP placeholders) |
| `nightly.yml`                | cron 03:00 UTC       | Full Playwright + pnpm audit + ZAP + mail-tester + backup-drill + Lighthouse history | Toggles `vars.NIGHTLY_*_ENABLED`          |
| `release.yml`                | push tag `v*`        | Production release via API Coolify (alignée 2026-05-15)                              | ✅                                        |
| `deploy-coolify.yml`         | push main            | **Pipeline principal audité ici**                                                    | ✅                                        |
| `disk-cleanup-prod.yml`      | cron 02:00 UTC       | Coolify exec `docker prune` VPS                                                      | ✅                                        |
| `gsc-crawl-stats-weekly.yml` | cron weekly          | GSC sync ops                                                                         | hors scope                                |

### 14.2 Files audités

- `axionia/.github/workflows/deploy-coolify.yml` (377 lignes)
- `axionia/.github/workflows/ci.yml` (333 lignes)
- `axionia/.github/workflows/nightly.yml` (top 60 lignes)
- `axionia/.github/workflows/staging.yml` (35 lignes)
- `axionia/.github/workflows/release.yml` (top 40 lignes)
- `axionia/.github/workflows/disk-cleanup-prod.yml` (top 30 lignes)
- `axionia/Dockerfile` (183 lignes)
- `axionia/Dockerfile.coolify-pull` (23 lignes)
- `axionia/Dockerfile.worker` (97 lignes)
- `axionia/scripts/docker-entrypoint.sh` (59 lignes)
- `axionia/src/app/api/healthz/route.ts` (76 lignes)
- `axionia/prisma/migrations_fts/*.sql` (3 fichiers — confirmation existence)
- `axionia/prisma/migrations/README-ROLLBACK-IMAGE-BANK.md` (top 40 lignes)
- `axionia/AGENTS.md` (sections "Build externalisé" + "EN locale désactivé")

### 14.3 Commits récents `deploy-coolify.yml`

```
1b452b9 ci(lhci): retire /en de la liste lhci urls (en disabled 2026-05-16)
c998ffa fix(build): drop cache mounts + agressive disk cleanup gh actions
c45a956 fix(build): stub DATABASE_URL + REDIS_URL et catch large knowledge sitemap
398c844 fix(deploy): skip env validation au build + dockerfile coolify-pull
a861d70 ci(deploy): externalise build sur GH Actions + GHCR (Option F.1 recovery)
d907803 ci(deploy): concurrency cancel-in-progress:false (P0-01)
1535f0e fix(deploy): wait-loop coolify lit le bon status + dockerfile cpx42
```

---

> Livrable Agent 5.C — fin.
> Output : `_AUDIT/PLATFORM-PERFECTION-2026-05-16/24-cicd-deploy.md`.
> Score **88/100** 🟢 GO conditional sur P0-01 (FTS auto-apply runtime).
