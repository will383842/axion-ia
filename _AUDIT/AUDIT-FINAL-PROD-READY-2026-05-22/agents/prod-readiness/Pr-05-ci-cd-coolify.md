# Pr-05 — CI/CD Coolify Pipeline

**HEAD** : 81f6ea0e
**Score** : 22 / 25

## Évidence

### Workflows actifs (24 fichiers `.github/workflows/`)

Pipeline build/deploy core :

- `ci.yml` — Gates A (per-commit) + B (per-PR build/test) + C (Docker smoke) + D (Prisma migrations fresh DB)
- `deploy-coolify.yml` — Build GHCR + deploy + Cloudflare purge + LHCI (cf. AGENTS.md §1 / ADR 0026)
- `nightly.yml` — pnpm audit + dependabot watch
- `staging.yml` — staging env
- `release.yml` — release tracking

Workflows ops/recovery :

- `coolify-zombie-cleanup.yml` (daily cron — cf. ADR 0026 recovery 2026-05-17)
- `coolify-diagnose.yml` (autopilot diagnostic)
- `coolify-bypass-restart.yml` + `coolify-system-restart.yml` + `coolify-force-recreate.yml`
- `disk-cleanup-prod.yml` (VPS disk hygiene)
- `admin-emergency-migrate.yml` (Prisma drift recovery)
- `admin-enable-v2.yml` (toggle)

Workflows business :

- `daily-indexnow-resubmit.yml` + `indexnow-images.yml`
- `gsc-crawl-stats-weekly.yml` + `gsc-submit-image-sitemaps.yml` + `gsc-oauth-refresh-write.yml`
- `cloudflare-purge-weekly.yml`
- `sentry-query.yml` (auto observability query)
- `image-bank-seed.yml` + `content-gen-seed.yml`
- `enable-openai-embeddings.yml`

### Gates CI (`ci.yml`)

- **Gate A (per-commit)** : Prisma generate → typecheck → ESLint → Prettier → Vitest with coverage → i18n parity → anti-siren grep → anti-hex grep → use-client justified → content-gen isolation → Zod schemas have tests → gitleaks. Tout en `ubuntu-latest`, timeout 15min, Node 24.
- **Gate B (per-PR)** : Playwright browsers install → Build → Bundle size + delta (size-limit-action) → Playwright suite → Lighthouse CI. Note : Playwright + Bundle + LHCI sont `continue-on-error: true` actuellement (ligne 156/159/162) — re-activation progressive documentée commentaire ligne 137-143.
- **Gate C (Docker smoke)** : `continue-on-error: true` (ligne 191) — boote production Dockerfile contre Redis ephémère + verifie `/api/healthz` 200 status:ok.
- **Gate D (migrations fresh DB)** : pgvector/pgvector:pg16 service → migrate deploy → FTS raw migrations → vérif `_prisma_migrations` healthy + sanity smoke 6 tables via PrismaClient. **Strict (pas continue-on-error)**.

### Build externalisé GH Actions (ADR 0026)

- `deploy-coolify.yml` — push main → job `build` (~25 min) → push GHCR `ghcr.io/will383842/axion-ia:{sha,main,latest}` → job `deploy` (~30s-28min selon layers) POST Coolify `/api/v1/deploy` → job `purge` (CF cache purge) → job `lhci` (5 URLs prod gate).
- Concurrency group `deploy-coolify` `cancel-in-progress: false` (ligne 79) — anti-cascade cancellations (audit 2026-05-15 P0-01).
- Stubs Prisma/Redis `stub.invalid` documentés (AGENTS.md §2).
- Coolify reconfiguré `dockerfile_location: /Dockerfile.coolify-pull` un-liner `FROM ghcr.io/...:latest`.

### Pre-commit hooks (`.husky/pre-commit`)

1. `pnpm exec lint-staged`
2. `pnpm anti-siren:check`
3. `pnpm anti-hex:check`
4. `pnpm use-client:check`
5. `pnpm typecheck`
6. `gitleaks protect --staged` (if installed)
   → **6 gates locaux**.

### Pre-push hooks (`.husky/pre-push`)

1. `pnpm typecheck`
2. `pnpm i18n:check`
3. `pnpm zod:check`
4. `pnpm test` (Vitest full)
5. `pnpm audit --prod --audit-level high`
   → **5 gates locaux** (mémoire dit "×3" mais c'est en fait 5).

### Smoke tests post-deploy

- LHCI 5 URLs prod live (job `lhci` deploy-coolify.yml).
- Healthcheck Docker `HEALTHCHECK` Dockerfile (cf. ci.yml gate-c ligne 237-246).
- Header `x-axion-build-sha` (`next.config.ts:46-49`) permet assertion `prod SHA === HEAD main` post-deploy via curl smoke 30+ routes (runbook deploy recovery 2026-05-17 §15.3).

### Rollback

- ADR 0026 : image GHCR taggée `sha-XXXXXXX` permet rollback Coolify via reconfig `latest` → `sha-OLD`. Pas de bouton 1-click rollback observé.

## Findings P0 / P1 / P2

- **P0** : aucun.
- **P1 (gate-b continue-on-error)** : Playwright + Bundle delta + LHCI tournent en `continue-on-error: true` actuellement (cf. `ci.yml:156/159/162` + commentaire ligne 137-143). Doctrine de re-activation progressive correcte, mais cible "retirer continue-on-error gate par gate quand stable" pas encore atteinte. Recommandation : ratifier Playwright stable ou bloquer.
- **P1 (gate-c continue-on-error)** : Docker smoke test `continue-on-error: true` (`ci.yml:191`). Commentaire ligne 180-185 explicite : env vars dummies absentes pour Zod env validation. À fixer pour réactiver gate-c bloquant.
- **P2 (rollback automation)** : pas de bouton 1-click rollback observé — procédure manuelle via reconfig Coolify image tag. Recommandation : workflow `rollback-to-sha.yml` pour deploy un-shot un sha précédent.
- **P2 (preview deploys)** : pas d'environnement preview per-PR (vraisemblable single VPS / pas de cluster). Acceptable V1.

## Verdict (paragraphe)

Pipeline CI/CD très mature : 24 workflows GH Actions couvrant build + deploy + ops + business + recovery. Gates A bloquants robustes (12 vérifications dont gitleaks + Zod tests + isolation check content-gen). Gate D Prisma migrations fresh DB strict. Build externalisé GH Actions/GHCR (ADR 0026) résout le problème disque CPX42 historique. Hooks pre-commit ×6 + pre-push ×5 défense-en-profondeur. Smoke tests LHCI 5 URLs + header `x-axion-build-sha` post-deploy. Concurrency anti-cascade cancellations. Les gaps notables sont les 3 `continue-on-error: true` sur Gate B (Playwright/Bundle/LHCI) + Gate C (Docker smoke) — doctrine de re-activation progressive documentée mais cible cible pas atteinte. Score 22/25 — production-ready, polish à clore sur le ratchet vers gates strict.
