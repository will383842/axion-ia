# Contributing to Axion-IA

> Documentation contributeurs pour le repo `will383842/axion-ia`.
> Cible : développeurs humains + agents Claude.

## Stack

Voir `AGENTS.md` pour la stack runtime complète (Next.js 16 + Postgres
managé Coolify + Redis + BullMQ + Sharp + Tailwind 4). Voir `docs/adr/`
pour les décisions architecturales.

## Setup local

```bash
git clone git@github.com:will383842/axion-ia.git
cd axion-ia
pnpm install
cp .env.dev.example .env.local
# (renseigner les variables manquantes)
pnpm prisma:generate
pnpm dev
```

## Workflow PR

1. Branche feature depuis `main` : `feat/<short-scope>` ou `fix/<scope>`.
2. Commits Conventional (`feat:`, `fix:`, `docs:`, `chore:`, `ci:`, `test:`).
3. Pre-commit hook (`.husky/pre-commit`) lance : lint-staged, anti-siren,
   anti-hex, use-client, typecheck, gitleaks.
4. Pre-push hook (`.husky/pre-push`) lance : test:coverage, audit prod.
5. PR vers `main` → CI Gates A + B doivent passer (voir
   `.github/workflows/ci.yml`).
6. Merge squash recommandé (sauf décision explicite Will inverse).

## Push direct sur `main`

Réservé aux commits **doc/ops/audits** non risqués + commit Conventional
avec `[skip ci]` si pas besoin de re-déploiement.

## Working with multiple Claude sessions

> Voir `.claude/coordination.md` pour le détail.

Si vous lancez une session Claude (CLI, IDE, ou autre) sur ce repo
**alors qu'une autre session est déjà active** (un collègue, un cron,
une fenêtre ouverte ailleurs) :

1. **Lire `.claude/active-sessions.md`** avant tout `git checkout` /
   `git switch`. Si une session travaille déjà sur la branche cible,
   choisir une autre branche OU coordonner par chat.
2. **Inscrire votre session** dans `.claude/active-sessions.md` au format
   `- session-<uuid> | branch=<name> | started=<ISO8601> | scope=<one-line> | owner=<conv-id>`.
3. **Désinscrire** à la fin (ou si crash) — pas de session orpheline > 24h.

Le sprint image-bank V1 (2026-05-16) a connu une collision de 2 sessions
qui a écrasé des patches d'audit. Le présent garde-fou évite la récidive.

## Doctrine immuable

- ✅ `Axion-IA` partout (avec tiret) — naming projet + marque
- ✅ Stack figée : Hetzner CPX42 + Coolify + Caddy + Cloudflare Free
  (voir ADR 0009 + 0026)
- ✅ Build externalisé GitHub Actions — pas de retour au build Coolify
  in-place
- ✅ Pricing dérivé de `src/content/pricing.ts` SSOT (jamais hardcodé)
- ❌ Pas de `--no-verify` sur commits (sauf Will explicite)
- ❌ Pas de `git push --force` sur main
- ❌ Pas de hex codes en dur (anti-hex gate) — utiliser tokens Tailwind

## Doctrine code = SSOT

Si docs et code divergent, le code gagne (sauf décision Will explicite
pour durcir le code). Faire une "reality check" pré-audit (Phase 0.5)
avant tout audit majeur.

## Pointeurs

- `AGENTS.md` — stack runtime + breaking changes Next 16
- `docs/adr/` — Architecture Decision Records
- `_AUDIT/` — audits historiques + prompts master
- `docs/ops/RUNBOOK-DEPLOY-STUCK.md` — débloquer un deploy Coolify
- `docs/ci/ENV-VARS.md` — env vars CI vs prod vs dev
- `.claude/coordination.md` — règles multi-sessions Claude
