# 01 — Diagnostic profond (Phase 1)

Généré : 2026-05-18 ~06:05 UTC
Méthodo : 6 sous-agents Explore/general-purpose en // (D1 disk, D2 memory, D3 logs forensics, D4 SSG, D5 workflow/buildx, D6 Coolify VPS).

## TL;DR — Cause racine identifiée

🎯 **Cause #1 (probabilité ~90%)** : **OOM-kill silencieux runner `ubuntu-latest` 16 GB RAM** pendant la phase `next build` SSG (collecting page data + generating static pages) à T+37min42s–38min10s. Pattern absolument déterministe (variance 28 sec sur 3 runs) → trigger lié à la quantité de travail, pas à l'infrastructure.

🎯 **Cause #2 (contribution ~10%)** : restore d'un blob GHA cache de **6.08 GB** (`buildkit-blob-1-sha256:83ae2…` créé 2026-05-17 17:36) au début du step 8 qui amplifie la pression mémoire/disk temporairement.

🎯 **Disque PAS la cause** : peak ~32-48 GB / 120 GB libre = 27-40% utilisé (D1).

## D1 — Disk profiling

- Disk runner après cleanup : **120 GB free** confirmé sur les 3 runs.
- Peak disque estimé pendant build : 32-48 GB (BuildKit cache + intermediate layers + node_modules + .next).
- **Verdict : 🟢 disque pas le coupable**.
- Quick wins : N/A pour disque, sauf rétablir cache mount `.next/cache` (mais ajoute +5-7 GB peak ce qui peut aggraver OOM).

## D2 — Memory profiling

| Item                                 | Valeur GB                        |
| ------------------------------------ | -------------------------------- |
| Node heap `NODE_OPTIONS=...6144`     | 6.0                              |
| Webpack/SWC RSS overhead (1.5× heap) | 2.0-2.5                          |
| Next SSG collection (~9 535 routes)  | 3.0-4.0                          |
| BuildKit layer export + gzip         | 2.0-2.5                          |
| pnpm install résidu + node_modules   | 0.8-1.2                          |
| OS + Docker daemon                   | 1.5-2.0                          |
| **Total peak estimé**                | **14.8-16.2**                    |
| Disponible runner ubuntu-latest      | **16 GB**                        |
| Marge                                | **~-0.2 à +1.2 GB** (saturation) |

- **Verdict : 🔴 LIKELY OOM** (peak ≥ 13 GB et runner 16 GB → fenêtre saturation 50%+ probable).
- Confirme que **`NEXT_PRIVATE_WORKER_THREADS=1`** ne suffit pas à empêcher l'explosion mémoire SSG.

## D3 — Logs forensics (3 runs failed analysés)

| Run           | Commit    | Runner ID  | Step 8 démarre | Step 8 tué | Durée step 8 |
| ------------- | --------- | ---------- | -------------- | ---------- | ------------ |
| `26008830067` | `f193e2e` | 1000006920 | 01:36:01Z      | 02:14:11Z  | **38m 10s**  |
| `26007749354` | `0bdc46f` | 1000006913 | 00:52:18Z      | 01:30:26Z  | **38m 08s**  |
| `26005748035` | `87f5ff8` | 1000006912 | 00:05:39Z      | 00:43:21Z  | **37m 42s**  |

- **Variance 28 sec sur 3 runs → trigger déterministe**, lié à la quantité de travail accomplie (et non aux conditions runtime aléatoires).
- Runner IDs différents → infrastructure GH NON coupable. Cause = code/config local.
- Step 8 `completed_at: null`, `conclusion: null`, `status: in_progress` → API marque tout incomplet.
- Zip logs téléchargé **NE CONTIENT PAS** `8_Build & push image.txt` (steps 1-7 + `system.txt` seulement). Pattern OOM-killer silencieux confirmé : VM tuée brutalement, buffers stdout/stderr jamais flushés vers Azure Storage.

## D4 — Next.js SSG analysis

- 21 fichiers `generateStaticParams` identifiés.
- **Hot spot** : 3 templates villes (`/audit/par-ville/[ville]`, `/interventions/par-ville/[ville]`, `/implementation/par-ville/[ville]`) ⇒ chacun `export const generateStaticParams = buildStaticParams` (importé depuis `src/components/sections/VilleServicePageTemplate.tsx`) qui retourne **TOUTES** les villes (`VILLES.map(v => ({ ville: v.slug }))`) = **~6 450 pages SSG villes** (3 × ~2 150) au build.
- Total SSG pré-rendu : **~9 535 pages** (villes 67% + blog 4% + faq/help/cases ~3% + autres).
- `dynamicParams = true` actif → on PEUT passer en ISR-only au build sans casser le routing.
- `next.config.ts` : `output: "standalone"`, `experimental.inlineCss: true`, `experimental.optimizePackageImports` actif pour lucide-react + 15 radix-ui. Pas de drapeau pathogène.
- Sharp non utilisé au build SSG (`serverExternalPackages` block).
- Prisma : 2 queries au build (sitemap blog + knowledge-sitemap), stub Proxy court-circuit en GH Actions.

## D5 — Workflow + Buildx config (5+ quick wins)

| ID  | Stratégie                                                               | Effort | Proba            |
| --- | ----------------------------------------------------------------------- | ------ | ---------------- |
| W1  | `runs-on: ubuntu-latest-large` (32 GB RAM)                              | 5 min  | **95%**          |
| W2  | Re-enable `cache-to: type=gha,mode=min`                                 | 2 min  | 70%              |
| W3  | `NODE_OPTIONS=--max-old-space-size=4096 --gc-interval=100`              | 1 min  | 50%              |
| W5  | Re-enable `--mount=type=cache,target=.next/cache,sharing=locked`        | 3 min  | 55%              |
| W6  | Purge GHA caches (`gh cache delete --all`)                              | 10 min | 40%              |
| W7  | `BUILDKIT_PROGRESS=plain` verbose logging                               | 1 min  | 50% (diagnostic) |
| W8  | Splitter `pnpm install` + `pnpm prisma:generate` hors Docker (pre-step) | 15 min | 65%              |

Strats déjà tentées (à ne pas refaire) : `--mount=type=cache,target=/root/.pnpm-store` (retiré 2026-05-16 OOM), heap 10240/8192 (cycles antérieurs), cache-to type=gha mode=max (retiré).

## D6 — Coolify VPS state (signaux indirects)

- 🟢 **Prod sert image `:latest` digest `sha256:584b1ae1…` = `sha-938993e`** (SHA full `938993e6db0c…`).
- 🟢 `/api/healthz` retourne `{status:"ok", db:"ok", redis:"ok"}` → container UP, Prisma + Redis OK.
- 🟢 Coolify webhook + API joignables (workflows `coolify-diagnose` et `coolify-zombie-cleanup` ont passé `success` < 2h ago).
- 🟢 Queue Coolify CLEAN (zombie cleanup 04:56Z : `No zombies found (queue clean)`).
- 🟢 **GHCR probes anonymes** :
  - `:latest` → 200 (digest `sha256:584b…`)
  - `:sha-938993e` → 200 (même digest que `:latest`)
  - `:sha-fea4b2e` → 200 (image green précédente, conservée)
  - `:sha-f193e2e` → **404** (jamais pushée — OOM-kill avant `docker push`)
  - `:sha-223d1f5` → **404** (HEAD actuel, jamais pushée)
- 🟢 **Conclusion D6** : Si une nouvelle image GHCR est pushée maintenant sur `:latest`, **Coolify va automatiquement pull + restart + healthcheck**. Le SEUL point cassé du pipeline est en amont (OOM-kill GH Actions runner).

### Risques deploy à anticiper

- ⚠️ Env vars manquantes runtime (PR 7-12 ont peut-être ajouté des secrets requis). Mitigation : `SKIP_ENV_VALIDATION` build, mais `env.ts` Zod actif au boot runtime — crash startup si manque.
- ⚠️ Vérifier `dockerfile_location` Coolify reste `/Dockerfile.coolify-pull` (sinon re-saturation disque CPX42).
- ⚠️ Si entrypoint `prisma migrate deploy` crash sur une migration foireuse → healthcheck fail → Coolify rollback automatique.
- 🟢 Image `:sha-938993e` reste disponible sur GHCR → rollback Level 1 facile (`docker tag` + redeploy en ~2 min).

## Hypothèses ranked

| #   | Hypothèse                                                                             | Probabilité |
| --- | ------------------------------------------------------------------------------------- | ----------- |
| 1   | OOM-kill silencieux sur runner 16 GB pendant `next build` SSG (cause #1)              | **85%**     |
| 2   | Cache blob GHA 6.08 GB amplifie la pression au début de step 8                        | 10%         |
| 3   | Bug `docker/build-push-action@v6` + `cache-from` corrupted                            | 3%          |
| 4   | Throttle GHCR push (peu probable, layers en partie cachés, pas d'erreur HTTP visible) | 2%          |

## Conclusion Phase 1

**Cause root quasi-certaine** = saturation RAM 16 GB runner par `next build` SSG 9 535 routes. La séquence type :

1. Step 8 démarre, cache-from restore ~6 GB blob (RAM/disk pression initiale).
2. `pnpm install` + `pnpm prisma:generate` : ~5 GB cumulés.
3. `pnpm build` lance webpack + SSG collection + RSS/sitemap/Prisma → peak heap atteint ~6 GB Node + ~3 GB SSG + 2 GB BuildKit.
4. À T+38 min, atteinte du seuil 15.5+ GB → swap → OOM-killer cible buildkitd → kill -9 silencieux → runner agent perd contact → job marqué `failure`.

**Stratégies prioritisées pour Phase 2** :

- **Stratégie #1 = S1 (ubuntu-latest-large 32 GB) + S10 (instrumentation memory monitor)** → proba combinée ~95%.
- Stratégie #2 fallback = S8 (ubuntu-latest-large-4xl 64 GB).
- Stratégie #3 fallback = D4 quick win 1 (réduire SSG villes à `getIndexableVilles()` only, pages restantes en ISR).
- Stratégie #4 fallback = W6 (purge GHA cache) + W3 (heap 4096) combo.
- Si tout fail → S9 (self-hosted runner Hetzner) = STOP & ASK Will (§28-3, requiert SSH creds).
