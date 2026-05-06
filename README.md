# AxionIA

Cabinet IA opérationnel B2B premium · OÜ estonienne · multilingue FR/EN.

> **Source de vérité** : `../AxionIA_Dossier_FINAL_ABSOLU_v10.1/CLAUDE.md` v6 + `axionia-package/docs/_DECISIONS-FINALES.md` + `Design.md` racine + ADR `docs/adr/`.

## Quickstart

```bash
pnpm install        # tire les deps + run husky prepare
pnpm dev            # http://localhost:3000
pnpm verify:all     # typecheck + lint + i18n + 4 anti-grep + tests
```

## Stack

- **Framework** : Next.js 16 (App Router) · React 19.2 · TypeScript 5 strict
- **Style** : Tailwind v4 + CSS variables (Webflow-inspired) · `Manrope` + `Inconsolata`
- **i18n** : `next-intl@3` (FR canonique, EN miroir)
- **Forms** : `react-hook-form` + `zod`
- **DB** : Postgres 16 + `prisma@5` (Sprint 15)
- **State** : `@tanstack/react-query` · `zustand`
- **Animation** : `motion@11` (`prefers-reduced-motion` strict)
- **Auth** : Auth.js v5 (`next-auth@beta`) + 2FA TOTP + WebAuthn (Sprint 16)
- **Email** : `nodemailer` + `@react-email` → PowerMTA + MailWizz self-hosted (Sprint 19) — **Resend interdit**
- **Queue** : `bullmq` + `ioredis` (Sprint 18)
- **Tests** : `vitest` (unit) + `@playwright/test` × 5 projects (cross-browser + mobile) + `@axe-core/playwright`
- **Quality** : Husky + lint-staged + commitlint + 4 anti-grep custom + size-limit
- **Observability** : `@sentry/nextjs` + endpoint `/api/vitals` Edge + Plausible self-hosted
- **CI** : Gates A/B/C/D/E (cf. `.github/workflows/`)
- **Hosting** : Hetzner CX32 Frankfurt (UE) + Coolify + Cloudflare proxy/WAF (Sprint 22)

## Conventions non négociables

- **Mot « formation » BANNI** (`axionia-core`) — `pnpm anti-formation:check` enforce 0 occurrence.
- **Mobile-first absolu** (`axionia-mobile-first`) — Tailwind classes sans préfixe d'abord.
- **OÜ estonienne** — jamais SIREN/SIRET/RCS · `pnpm anti-siren:check`.
- **Server Components par défaut** · `'use client'` justifié obligatoire (`pnpm use-client:check`).
- **Aucun hex hardcodé** hors `globals.css` (`pnpm anti-hex:check`).
- **i18n parité FR/EN** (`pnpm i18n:check`).
- **Conventional Commits** + Husky (jamais `--no-verify`).
- **Lighthouse mobile ≥ 95** par page produit (Sprint 5+).

## Scripts utiles

| Script                                           | Rôle                                   |
| ------------------------------------------------ | -------------------------------------- |
| `pnpm dev`                                       | dev server :3000                       |
| `pnpm build`                                     | prod build                             |
| `pnpm typecheck`                                 | TS strict                              |
| `pnpm lint` / `pnpm lint:fix`                    | ESLint                                 |
| `pnpm format` / `pnpm format:check`              | Prettier                               |
| `pnpm test` / `pnpm test:watch` / `pnpm test:ui` | Vitest                                 |
| `pnpm test:e2e` / `pnpm test:e2e:ui`             | Playwright                             |
| `pnpm test:e2e:cross-browser`                    | Chromium + WebKit + Firefox            |
| `pnpm a11y:audit`                                | tests Playwright tagués `@a11y`        |
| `pnpm lhci:autorun`                              | Lighthouse CI                          |
| `pnpm bundle:check`                              | size-limit                             |
| `pnpm bundle:analyze`                            | `@next/bundle-analyzer` HTML report    |
| `pnpm prisma:studio`                             | Prisma Studio                          |
| `pnpm db:seed`                                   | seed DB                                |
| `pnpm worker`                                    | BullMQ worker                          |
| `pnpm adr:new <slug>`                            | nouveau ADR                            |
| `pnpm verify:all`                                | TS + lint + i18n + 4 anti-grep + tests |

## Gates CI

- **Gate A — per-commit** : typecheck, lint, format, vitest, i18n, 4 anti-grep, gitleaks, zod tests.
- **Gate B — per-PR** : build, bundle size, Playwright cross-browser, Lighthouse CI.
- **Gate C — per-merge main** : déploiement staging via Coolify + smoke + OWASP ZAP baseline.
- **Gate D — nightly 03:00 UTC** : full Playwright vs staging, audit deps, ZAP full, mail-tester, backup drill.
- **Gate E — per-release tag `v*`** : prod deploy + smoke + Telegram alert.

## Arborescence

```
src/
├─ app/                    # Next.js App Router (locale-driven Sprint 2)
│  ├─ api/vitals/route.ts  # web-vitals beacon (Edge)
│  ├─ layout.tsx
│  └─ page.tsx
├─ components/             # UI atomic + composite (Sprint 3-4)
├─ lib/                    # utils, schemas Zod, helpers
├─ messages/               # next-intl FR / EN
├─ instrumentation.ts      # Sentry server + edge
├─ instrumentation-client.ts # Sentry browser
├─ sentry.server.config.ts
├─ sentry.edge.config.ts
└─ env.ts                  # @t3-oss/env-nextjs validation runtime

scripts/                   # check-* custom + adr-new
prisma/                    # schema + seeds (Sprint 15)
docs/adr/                  # Architecture Decision Records
.github/workflows/         # 4 workflows + dependabot
```

## Documentation locale Next 16

`node_modules/next/dist/docs/` contient la doc complète. **Lire avant** d'utiliser une API serveur Next 16 (View Transitions, Speculation Rules, PPR, `useCache`, `unstable_instant`, etc.).

## Liens

- [`SESSION_LOG.md`](./SESSION_LOG.md) — journal de session
- [`docs/adr/`](./docs/adr/) — décisions structurelles
- `../_AUDIT/02-PLAN.md` — jalons M1-M11
- `../AxionIA_Dossier_FINAL_ABSOLU_v10.1/CLAUDE.md` — référence projet
