# Axion-IA

Cabinet IA opérationnel B2B premium · européen · multilingue FR/EN.

> **Source de vérité** : `../Axion-IA_Dossier_FINAL_ABSOLU_v10.1/CLAUDE.md` v6 + `axionia-package/docs/_DECISIONS-FINALES.md` + `Design.md` (doctrine visuelle v3.1 « Editorial Premium Light ») + ADR `docs/adr/` (notamment 0002 pivot v3 et 0004 typography v3.1).

## Quickstart

```bash
pnpm install        # tire les deps + run husky prepare
pnpm dev            # http://localhost:3000
pnpm verify:all     # typecheck + lint + i18n + 3 anti-grep + tests
```

## Stack

- **Framework** : Next.js 16 (App Router) · React 19.2 · TypeScript 5 strict
- **Style** : Tailwind v4 + CSS variables (Editorial Premium Light v3.1, cf. `Design.md`) · `Manrope` (sans) + `Fraunces` (serif éditorial signature) + `Inconsolata` (mono)
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
- **Hosting** : Hetzner CPX32 Frankfurt (UE) + Coolify + Cloudflare proxy/WAF (Sprint 22)

## Conventions non négociables

- **Mot « formation »** : autorisé depuis 2026-05-07 (ADR 0003). Vocabulaire commercial réintégré pour les pages `/interventions` & co. Plus aucun gate `anti-formation`.
- **Doctrine visuelle v3.1** : tout titre de page a un `h1` (WCAG 2.4.6) et passe par `<Section titleAs="h1" tone="halo-warm">` ou son équivalent canonique manuel (display-editorial Fraunces + dot terracotta + italic-editorial). `<LegalPageTemplate>` et `<ProductPageTemplate>` exigent une prop `isFr` pour la localisation des fallbacks/strings.
- **Mobile-first absolu** (`axionia-mobile-first`) — Tailwind classes sans préfixe d'abord.
- **Pas de SIREN/SIRET/RCS** dans les copies marketing — la société est constituée hors France, le linter `pnpm anti-siren:check` enforce cette règle.
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
| `pnpm verify:all`                                | TS + lint + i18n + 3 anti-grep + tests |

## Gates CI

- **Gate A — per-commit** : typecheck, lint, format, vitest, i18n, 3 anti-grep, gitleaks, zod tests.
- **Gate B — per-PR** : build, bundle size, Playwright cross-browser, Lighthouse CI.
- **Gate C — per-merge main** : déploiement staging via Coolify + smoke + OWASP ZAP baseline.
- **Gate D — nightly 03:00 UTC** : full Playwright vs staging, audit deps, ZAP full, mail-tester, backup drill.
- **Gate E — per-release tag `v*`** : prod deploy + smoke + Telegram alert.

## Arborescence

```
src/
├─ app/
│  ├─ [locale]/            # Routes localisées FR/EN (App Router)
│  │  ├─ page.tsx          # Home (référence design v3.1)
│  │  ├─ interventions/    # Module 1 — 5 produits + listing
│  │  ├─ audit/            # Module 2 — 4 niveaux + demande
│  │  ├─ implementation/   # Module 3 — 9 prestations + par-fonction/par-techno
│  │  ├─ cas-concrets/     # Cas concrets + secteurs
│  │  ├─ blog/             # Articles + categorie/auteur/tag
│  │  ├─ centre-aide/      # Help articles + categorie
│  │  ├─ faq/              # FAQ + entries
│  │  ├─ presse/           # Page presse · NewsroomPage
│  │  ├─ comparaisons/     # Comparatifs
│  │  ├─ {a-propos,contact,roi,reserver,recherche,...}
│  │  ├─ {mentions-legales,conditions-generales,politique-*,cookies,rgpd}/
│  │  └─ {design,components,sections}/   # Pages dev no-index
│  ├─ api/vitals/route.ts  # web-vitals beacon (Edge)
│  ├─ globals.css          # Tokens Editorial v3.1 (@theme directive)
│  └─ layout.tsx
├─ components/
│  ├─ layout/              # Container, Section (composant central tones+titleEm)
│  ├─ nav/                 # Header, Footer, MobileNav, LocaleSwitcher
│  ├─ sections/            # ProductPageTemplate, LegalPageTemplate, Hero, FaqBlock, …
│  ├─ marketing/           # Cta, JsonLd, ArticleCard, CaseStudyCard, Price, …
│  ├─ forms/               # ContactForm, AuditRequestForm, NewsletterForm, …
│  ├─ calendar/            # BookingCalendar, HouseCalendar
│  ├─ roi/                 # RoiSimulator
│  ├─ ui/                  # Atomes shadcn-like (Button, Card, Input, Alert, …)
│  └─ {motion,a11y,analytics,typography}/
├─ content/                # Source de vérité fixtures (interventions, audit,
│                          #   implementations, case-studies, transversal,
│                          #   press, legal, comparisons) FR + EN co-localisé
├─ i18n/                   # routing + Link wrapper next-intl
├─ messages/               # next-intl FR / EN (parité enforced via i18n:check)
├─ lib/                    # utils, schemas Zod, helpers SEO/JSON-LD
├─ instrumentation*.ts     # Sentry server + edge + browser
├─ sentry.{server,edge}.config.ts
└─ env.ts                  # @t3-oss/env-nextjs validation runtime

scripts/                   # check-* custom + adr-new
prisma/                    # schema + seeds (Sprint 15)
docs/adr/                  # Architecture Decision Records (0001 → 0004)
.github/workflows/         # workflows CI Gates A/B/C/D/E + dependabot
```

## Documentation locale Next 16

`node_modules/next/dist/docs/` contient la doc complète. **Lire avant** d'utiliser une API serveur Next 16 (View Transitions, Speculation Rules, PPR, `useCache`, `unstable_instant`, etc.).

## Liens

- [`SESSION_LOG.md`](./SESSION_LOG.md) — journal de session
- [`docs/adr/`](./docs/adr/) — décisions structurelles
- [`_AUDIT/02-PLAN.md`](./_AUDIT/02-PLAN.md) — jalons M1-M11
- `../Axion-IA_Dossier_FINAL_ABSOLU_v10.1/CLAUDE.md` — référence projet
