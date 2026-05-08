# 🛠️ PROMPT D'IMPLÉMENTATION — Axion-IA · Design → Frontend → Vérif → Backend

> Version 3.0 · 2026-05-06 (soir) — pivot doctrine **Editorial Premium Light v3** (ADR 0002 supersedes 0001) + 103 skills + plan M1-M11.
> À utiliser **après** validation des phases 0, 1, 1.S et 2 du `PROMPT-MAITRE.md` (audit + plan + Design.md + skill `axionia-architecture` validés par Will).
> Lance-le depuis une session Claude Code à la racine du sous-repo Next.js 16 (`C:\Users\willi\Documents\Projets\Axion-IA\axionia\`).

> ⚠️ **Pivot doctrinal v1 → v3** acté le 2026-05-06 :
>
> - **Source de vérité visuelle ACTUELLE** : `axionia/Design.md` v3 + `axionia/docs/adr/0002-design-pivot-editorial-v3.md`. Doctrine **Editorial Premium Light** : surfaces ivoire chaud `#faf8f3` + sand + mocha `#2a2520` (pas de noir pur), primary Editorial Blue `#1a4dd9` (densifié depuis `#146ef5`), accent éditorial **terracotta** `#c24a1b`, accent doux **sage** `#7a8870`, **3 polices** Manrope (sans) + Fraunces (serif, NEW) + Inconsolata (mono), type scale display **7rem (112px)**, radius `xs:2 / sm:4 / md:8 / lg:12 / xl:20 / 2xl:28`, shadows **ton chaud** `rgba(42,37,32,…)` cascade 5 couches, halos `bg-halo-warm` / `bg-halo-cool`, signature `em.editorial` (serif italique terracotta), animation `translate-x-[6px]` conservée, breakpoints 479/768/992/1280, max-w 1280.
> - **Source de vérité v1 HISTORIQUE** (sprints 0-14 livrés) : `Axion-IA_Dossier_FINAL_ABSOLU_v10.1/Design.md` + `docs/adr/0001-design-direction-webflow.md` — **archivés**, conservés uniquement pour traçabilité de la DoD historique des sprints 0-14 (commits `f52a2b4` → `1135136` + polish `01c5a59` → `f2ea1e6`).
> - **Conséquence pour PROMPT-SPRINT-AUDIT** : la DoD attendue Sprint N (N ∈ 0..14) reste celle de la v1 historique pour la croisée DoD attendue/déclarée/réelle. Le pivot v3 est traité comme un **Sprint 14.5 « Pivot doctrinal »** (post-Sprint 14 polish) à commiter séparément.
> - **Conséquence pour CHECKPOINT FINAL** + audits frontend (FRONTEND-DEEP-CHECK, VERIFICATION-FINALE) : la doctrine v3 fait foi.

> ⚠️ Source de vérité technique : `axionia-package/docs/_DECISIONS-FINALES.md` + `axionia-package/docs/_NO-STRIPE.md` + `CLAUDE.md` v6 + `_AUDIT/02-PLAN.md` (jalons M1→M11, ~56 j-h). **Pas de Stripe Phase 1** : tunnel commercial = devis + virement + facture Indy.

> ⚠️ Skills disponibles : **103 au total** dans `axionia-package/.claude/skills/` dont **18 `axionia-*`** : `axionia-core`, `axionia-architecture`, `axionia-stack`, `axionia-design`, `axionia-mobile-first`, `axionia-anti-spa`, `axionia-i18n`, `axionia-a11y`, `axionia-seo-aeo`, `axionia-database`, `axionia-content-models`, `axionia-forms`, `axionia-calendar`, `axionia-emails`, `axionia-admin-ux`, `axionia-rgpd`, `axionia-performance`, `axionia-testing`, `axionia-monitoring`, `axionia-deployment`. Skills archivés `_archive/` : `seo-flow`, `seo-schema`. À archiver Sprint 0 selon `_AUDIT/01s-F-actions.md` : `signup-flow-cro`, `paywall-upgrade-cro`, `onboarding-cro`, `churn-prevention`, `revops`, `community-marketing`, `referral-program`, `aso-audit`, `seo-ecommerce`.

> ⚠️ Mégapack `axionia-megapack-skills/` (88 skills) = sous-ensemble strict du package, **redondant — à archiver** Sprint 0.

> 🔧 **Passe v10.2 préalable** : 16 contradictions détectées Phase 0 (`_AUDIT/00-fiches-lecture.md`) — Resend résiduel dans 2 docx, Backblaze B2 résiduel, perf budgets divergents, mot « formation » résiduel dans 3 docx, droit français des CGV, etc. À traiter **avant ou pendant** Sprint 0 selon ce que Will arbitre.

### Correspondance Sprints ↔ Jalons M1-M11

| Sprint(s) | Jalon plan | Estimation |
| --------- | ---------- | ---------- |
| 0         | M1         | 3 j-h      |
| 1, 3, 4   | M2         | 5 j-h      |
| 2         | M3         | 3 j-h      |
| 5-9       | M4         | 12 j-h     |
| 11-13     | M5         | 6 j-h      |
| 9-10      | M6         | 5 j-h      |
| 14        | M7         | 3 j-h      |
| 15-19     | M8         | 6 j-h      |
| 20        | M9         | 6 j-h      |
| 21        | M10        | 4 j-h      |
| 22-23     | M11        | 3 j-h      |

---

## RÈGLES DU JEU

1. **Mode auto** : exécuter sans demander la permission, sauf checkpoints explicites « STOP & ASK ».
2. **TaskList vivante** : créer une tâche par sprint, sous-tâches par page/composant. Marquer `in_progress` puis `completed` au fur et à mesure.
3. **Skills à charger en début de chaque sprint** : indiqués sous chaque sprint. Ne jamais coder un fichier React/TSX sans avoir d'abord chargé `axionia-core` + `axionia-architecture` + `axionia-anti-spa` + `axionia-mobile-first` + `axionia-design` + `axionia-i18n` + `axionia-a11y` + `axionia-seo-aeo` + `axionia-performance`. Pour le backend : `axionia-database` + `axionia-stack` + `axionia-content-models` + `axionia-emails` + `axionia-rgpd` + `axionia-deployment` + `axionia-monitoring` + `owasp-security`. Pour les tests : `axionia-testing`.
4. **Definition of Done** stricte par sprint : les critères doivent être tous verts pour fermer le sprint. Aucune dette technique tolérée entre sprints.
5. **Conventional Commits** : un commit par sous-tâche logique. Pas de `--no-verify`. Husky + ESLint + TS strict + tests doivent passer.
6. **Aucune feature non spécifiée** dans `_DECISIONS-FINALES.md` ou les wireframes. En cas de doute → STOP & ASK.
7. **Aucune dépendance hors stack verrouillée** (cf. doc 25). Resend/Mailchimp/Stripe interdits.
8. **ADR obligatoire** (`docs/adr/NNNN-titre.md`) pour toute décision technique structurelle prise en cours de route. Format Michael Nygard.
9. **`SESSION_LOG.md`** mis à jour à la fin de chaque sprint (état, décisions, ce qui reste).
10. **Couverture exhaustive obligatoire** : la source de vérité du périmètre est `_AUDIT/02b-mapping-pages.md` (64 routes templates HEAD (cf. SYNC-NOTICE-2026-05-07.md) uniques, ~170-220 routes au lancement). À la fin de la Partie I, **chaque** template doit être livré ou justifier d'un report explicite tracé dans `SESSION_LOG.md`. Aucune page n'est « optionnelle » par défaut.

---

## VÉRIFICATIONS CONTINUES (gates qui s'appliquent à TOUS les sprints)

Ces gates sont configurés au **Sprint 0** et tournent en CI à chaque commit / PR / merge / nightly. Aucun sprint ne ferme tant que ces gates sont rouges.

### Gate A — Per-commit (pre-commit hook + GitHub Actions PR)

- `pnpm typecheck` (TS strict, 0 erreur).
- `pnpm lint` (ESLint + jsx-a11y + @typescript-eslint/strict-type-checked).
- `pnpm format:check` (Prettier).
- `pnpm test` (Vitest, coverage seuil progressif : 50 % sprint 4, 70 % sprint 14, 80 % sprint 21).
- `pnpm test:integration` (server actions + Prisma in-memory).
- **Bundle size delta** : `size-limit` ou équivalent, échec si page produit dépasse 100 KB JS first load (ou +5 KB par PR).
- **i18n cross-check** : script `scripts/check-i18n.ts` qui vérifie qu'aucune clé n'est dans `fr.json` sans son miroir dans `en.json` et inversement.
- **Anti-formation grep** : `grep -ri "formation\|formateur\|former" src/ messages/` doit retourner 0 résultat (whitelist explicite si vraiment besoin).
- **Anti-SIREN grep** : `grep -ri "siren\|siret\|rcs"` 0 résultat.
- **Anti-hex hardcoded** : `grep -rE "#[0-9a-f]{3,8}\b" src/components src/app` 0 résultat (hors `globals.css` et tokens).
- **`'use client'` justifié** : script qui vérifie qu'un commentaire `// use-client: <raison>` précède chaque directive.
- **Schemas Zod statiques validés** : `pnpm zod:check` (chaque schéma a un test).
- **Secrets scanning** : `gitleaks` ou équivalent en pre-commit.

### Gate B — Per-PR (GitHub Actions on pull_request)

- Tout Gate A.
- **Build** complet (`pnpm build` Next.js 15 avec PPR + React Compiler).
- **Playwright** suite complète (parallélisée, sharded x4).
- **Lighthouse CI** sur 20 URLs échantillon, assertions :
  - Performance ≥ 95 mobile, ≥ 98 desktop.
  - Accessibility ≥ 95.
  - Best Practices ≥ 95.
  - SEO 100.
  - Specific metrics : LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1, TBT ≤ 200ms.
- **axe-core/playwright** : 0 violation sur les mêmes 20 URLs.
- **Visual regression** : Playwright `toHaveScreenshot()` baseline. Diff > 0.1 % refusé sans review.
- **Schema.org validation** : script qui appelle l'API officielle Schema.org Validator sur les routes principales.
- **Dead link checker** : `linkinator` ou équivalent sur build local.
- **Bundle analyzer** : `@next/bundle-analyzer` rapport HTML uploadé en artifact.
- **Cross-browser matrix Playwright** : Chromium + WebKit + Firefox sur 3 viewports (360, 768, 1280).
- **Mobile devices Playwright** : iPhone 14 Pro, iPhone SE, Pixel 7, Samsung S22.
- **Semgrep** : règles OWASP Top 10 + custom rules Axion-IA.
- **CodeQL** GitHub natif.
- **Dependabot** PRs auto pour dépendances.

### Gate C — Per-merge to main (deploy staging + checks)

- Auto-deploy staging via Coolify webhook.
- Smoke tests Playwright contre staging (5 scénarios golden path).
- **Lighthouse contre staging** sur 5 pages clés.
- **OWASP ZAP baseline scan** contre staging.
- **Web Vitals RUM** activé (Plausible + custom beacon).
- Sentry release créée, sourcemaps uploadés.

### Gate D — Nightly (cron 03:00 UTC)

- **Full Playwright** contre staging (60+ scénarios).
- **OWASP ZAP full scan** contre staging.
- **Trivy** scan des images Docker.
- **npm audit** + **pnpm audit** rapport Telegram.
- **Mail-tester** automatisé : envoyer 1 email de chaque template à un compte mail-tester via API et logguer le score (échec si < 9/10).
- **DKIM/SPF/DMARC verify** automatique (`mxtoolbox` ou équivalent self-hosted).
- **Backups** : vérifier qu'un backup Postgres horaire existe et est restaurable (test restore en sandbox).
- **Synthetic transactions** Uptime Kuma : login admin, soumission audit, lecture article, switcher FR/EN.
- **Lighthouse historique** : enregistrer le score quotidien dans une base SQLite, alerte Telegram si régression > 5 points.

### Gate E — Per-release (deploy prod manuel)

- Tag git `v0.X.Y` + CHANGELOG.md généré (`changesets` ou conventional-changelog).
- Déploiement prod via Coolify.
- Smoke tests prod (5 scénarios).
- Lighthouse prod sur 10 pages.
- Sentry release prod + monitoring 30 min post-deploy.
- Alerte Telegram « release v0.X.Y déployée ».
- Rollback documenté (commande `coolify rollback` testée mensuellement).

---

## BEST PRACTICES 2026 — à appliquer systématiquement

Cette section recense les pratiques 2026 que **chaque** composant/page/feature doit incorporer. Chaque sprint indique en bas quelles BP s'appliquent.

### Frontend / Next.js 15+

- **React Compiler** activé (memoization automatique, pas de `useMemo`/`useCallback` manuels sauf cas mesurés).
- **Partial Prerendering (PPR)** : pages produit en static shell + Suspense boundaries dynamiques pour les sections data-driven.
- **`useActionState`** (Next.js 15) pour tous les forms (remplace `useFormState`).
- **`useFormStatus`** pour le bouton submit.
- **Streaming SSR** : `<Suspense fallback={<Skeleton />}>` autour des sections data, pas de blocking au layout.
- **View Transitions API** pour les transitions de pages (Next.js 15 stable). Désactivable via `prefers-reduced-motion`.
- **Speculation Rules API** : `<script type="speculationrules">` pour prefetch/prerender les liens hover, conservatrice (eagerness="moderate").
- **`<link rel="modulepreload">`** sur les chunks critiques.
- **`fetchPriority="high"`** sur l'image LCP de chaque hero.
- **`loading="lazy"` + `decoding="async"`** sur les images below-the-fold.
- **`<Image>` Next.js** avec `placeholder="blur"` + AVIF + WebP fallback.
- **Fonts** : `next/font` avec `display: 'swap'`, `preload: true` pour la font primaire seulement, `adjustFontFallback` automatique.
- **CSS @container queries** quand un composant doit s'adapter à son parent (sidebar/main).
- **CSS @scope** pour scoping local quand pertinent.
- **`<dialog>` natif** (au lieu de div modale) — shadcn-ui Dialog v3+ l'utilise déjà.
- **CSP nonce** sur scripts inline + **Trusted Types** activé.
- **Web Vitals INP** (pas FID, déprécié depuis 2024) — mesurer en RUM.

### Backend / Next.js Server

- **Server Actions** pour toutes les mutations (pas de route handlers REST sauf besoin externe).
- **Idempotency keys** sur toutes les mutations critiques.
- **Rate limiting Redis sliding window** (`@upstash/ratelimit` ou impl maison sur ioredis).
- **`unstable_cache` + `revalidateTag`** pour cache invalidation fine-grained.
- **Edge runtime** pour OG images, sitemap, robots, llms.txt.
- **Node runtime** pour DB / Auth / mailer.
- **HTTP/3** + **103 Early Hints** activés au niveau Cloudflare.
- **Brotli 11** static + **Zstd** dynamic (Cloudflare auto).

### Sécurité 2026

- **OWASP ASVS 5.0** complet (Level 2 minimum).
- **NIST SP 800-63-4** (2024-2026 update) : passwords ≥ 15 chars min, pas de rotation forcée, pas de questions secrètes, breach checking via HIBP API.
- **Argon2id** params : memory 64 MB, iterations 3, parallelism 4.
- **Auth.js v5 + WebAuthn passkeys** en plus du TOTP (passkey + TOTP = 2FA fort, passkey only = MFA).
- **Trusted Types** + **CSP strict** avec nonce dynamique.
- **COOP `same-origin`** + **COEP `require-corp`** si cross-origin isolation nécessaire (probablement pas pour vitrine, mais à vérifier).
- **Subresource Integrity (SRI)** sur tout script tiers (Plausible, Turnstile).
- **Permissions-Policy** ultra-restrictive.
- **`Cross-Origin-Resource-Policy: same-origin`**.
- **Cookies** : `__Host-` prefix + `Secure` + `HttpOnly` + `SameSite=Lax` (ou `Strict` pour admin).

### Database 2026

- **PostgreSQL 16+** (PG 17 si dispo).
- **`pg_stat_statements`** activé en prod, dashboard Grafana ou view admin.
- **`auto_explain`** sur slow queries > 500 ms en prod.
- **Logical replication** staging ← prod (anonymisation PII via `pg_anonymize` ou trigger).
- **Connection pooling** : PgBouncer en mode `transaction` ou Prisma Accelerate-like local.
- **Read replicas** si trafic justifie (probablement pas avant traction).
- **Partitionnement** sur `EmailLog`, `AuditLog` par mois.

### Email 2026

- **DMARC `p=reject`** une fois warmup terminé (≥ 30 j sans bounce > 2 %).
- **BIMI** avec VMC certificate (optionnel, payant ~ 1500 €/an, à différer).
- **ARC seal** sur emails forwardés.
- **One-Click Unsubscribe (RFC 8058)** sur tous emails marketing.
- **List-Unsubscribe-Post** header.
- **Feedback Loops** Microsoft + Google + Yahoo configurés.
- **Domain warmup** : courbe `5 → 50 → 200 → 1k → 5k → 10k` sur 30 j.
- **Reverse DNS** sur l'IP dédiée correspondant à `mail.axion-ia.com`.

### Observability 2026

- **OpenTelemetry** instrumentation côté Node (traces + metrics + logs corrélés).
- **Pino** structured JSON logs avec trace_id/span_id.
- **Sentry** avec performance monitoring + session replay (5 % sample) + profiling.
- **Plausible** custom events pour conversions critiques.
- **Real User Monitoring** : web-vitals lib + beacon endpoint Edge runtime → ClickHouse ou Plausible custom props.

### CI/CD 2026

- **GitHub Actions** avec **OIDC** auth (pas de secrets statiques).
- **Reusable workflows** + **composite actions** pour DRY.
- **Concurrency control** : 1 deploy par env à la fois.
- **Required checks** : tous les Gates A+B verts pour merge.
- **Branch protection** main + staging.
- **Semantic release** automatisé.
- **Renovate** ou Dependabot avec auto-merge sur patches verts.

---

## PARTIE I — DESIGN & FRONTEND DE BOUT EN BOUT

### SPRINT 0 — Setup repo & toolchain (= jalon M1)

**Skills** : `axionia-core` + `axionia-stack` + `axionia-architecture` + `axionia-rgpd` (cookie strategy) + `using-superpowers` + `executing-plans` + `verification-before-completion`.

**Pré-requis lecture** :

- `axionia/Design.md` v3 (canon doctrine Editorial Premium Light).
- `axionia/docs/adr/0002-design-pivot-editorial-v3.md` (ADR pivot doctrinal).
- `axionia/docs/adr/0001-design-direction-webflow.md` (superseded — pour traçabilité historique sprints 0-14).
- `axionia-package/docs/_DECISIONS-FINALES.md`.
- `axionia-package/docs/_NO-STRIPE.md` (interdiction de coder Stripe).
- `_AUDIT/02-PLAN.md` (jalons M1-M11).
- `_AUDIT/00-fiches-lecture.md` (16 contradictions à connaître).
- `_AUDIT/01s-F-actions.md` (skills à archiver).
- `axionia-architecture/SKILL.md` (arborescence canon).

**Préalable — passe v10.2 contradictions** : si Will n'a pas encore fait corriger les 16 contradictions Phase 0, lui demander si on attaque Sprint 0 quand même ou si on patche d'abord les .docx + skills concernés. Décision Will avant de continuer.

**Préalable — archivage skills** : déplacer dans `.claude/skills/_archive/` les skills hors-scope (cf. `01s-F-actions.md`) :

- `signup-flow-cro`, `paywall-upgrade-cro`, `onboarding-cro`, `churn-prevention`, `revops`, `community-marketing`, `referral-program`, `aso-audit`, `seo-ecommerce`.
- Confirmer avec Will avant déplacement (révocable). Le mégapack `axionia-megapack-skills/` peut aussi être archivé entier (sous-ensemble strict du package).

**Étapes**

1. `pnpm create next-app@latest axionia` (TS strict, ESLint, Tailwind, App Router, src dir, `@/*` alias).
2. Installer dépendances exactes (versions épinglées) :
   ```
   pnpm add next-intl@^3 zod@^3 react-hook-form@^7 @hookform/resolvers@^3
   pnpm add @tanstack/react-query@^5 zustand@^4 motion@^11 lucide-react@latest
   pnpm add @t3-oss/env-nextjs@latest @vercel/og@latest
   pnpm add prisma@^5 @prisma/client@^5
   pnpm add next-auth@^5 @auth/prisma-adapter@latest
   pnpm add bullmq@^5 ioredis@^5
   pnpm add @tiptap/react @tiptap/starter-kit @tiptap/pm
   pnpm add nodemailer@latest react-email@^3 @react-email/components@latest
   pnpm add -D vitest@^2 @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
   pnpm add -D playwright@latest @playwright/test @axe-core/playwright
   pnpm add -D @lhci/cli@latest
   pnpm add -D eslint-plugin-jsx-a11y@latest @typescript-eslint/eslint-plugin@latest
   pnpm add -D husky@^9 lint-staged@^15 @commitlint/cli@^19 @commitlint/config-conventional@^19
   pnpm add -D prettier@latest prettier-plugin-tailwindcss@latest
   ```
3. Setup shadcn/ui : `pnpm dlx shadcn@latest init` (style: default, RSC: yes, Tailwind v4).
4. Installer composants shadcn de base : `button input textarea label form select dialog sheet dropdown-menu tooltip badge alert tabs accordion card separator avatar skeleton toast`.
5. Configurer Tailwind v4 avec CSS variables sur tokens du `Design.md` Webflow-inspired (cf. sprint 1).
6. `tsconfig.json` strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`).
7. ESLint config : extends `next/core-web-vitals`, `plugin:jsx-a11y/recommended`, `plugin:@typescript-eslint/strict-type-checked`.
8. Husky : `pre-commit` (lint-staged + scripts custom : i18n-check, ~~anti-formation grep~~ (retiré ADR 0003), anti-siren grep, anti-hex grep, use-client justifié, gitleaks) ; `commit-msg` (commitlint) ; `pre-push` (typecheck + test + zod:check + bundle:check).
9. Scripts `package.json` : `dev`, `build`, `start`, `lint`, `lint:fix`, `typecheck`, `test`, `test:watch`, `test:integration`, `test:e2e`, `test:e2e:ui`, `test:e2e:cross-browser`, `lhci`, `lhci:autorun`, `format`, `format:check`, `email:dev`, `prisma:studio`, `prisma:migrate`, `db:seed`, `i18n:check`, `zod:check`, `bundle:check`, `bundle:analyze`, `linkcheck`, `schemacheck`, `seo:audit`, `a11y:audit`, `vitals:report`, `worker`, `adr:new`.
10. Init Prisma : `pnpm prisma init` + activer `pg_stat_statements` + `auto_explain` + `pg_trgm` + `unaccent` dans la migration init.
11. Setup `@t3-oss/env-nextjs` avec `src/env.ts` strict (vars : DATABASE_URL, REDIS_URL, AUTH_SECRET, AUTH_URL, ADMIN_URL_PREFIX, SMTP_HOST, SMTP_PORT, TELEGRAM_BOT_TOKEN, TURNSTILE_SITE_KEY, TURNSTILE_SECRET, SENTRY_DSN, PLAUSIBLE_DOMAIN, NEXT_PUBLIC_SITE_URL).
12. `.env.example` complet (avec commentaires) ; `.env.local` créé avec valeurs dev ; `.env.test` pour Playwright.
13. `.gitignore` : `.next`, `node_modules`, `.env*.local`, `coverage`, `playwright-report`, `lhci`, `*.log`, `.DS_Store`.
14. **Configurer tous les gates CI dès maintenant** (cf. section VÉRIFICATIONS CONTINUES) :
    - `.github/workflows/ci.yml` : Gate A + Gate B sur PR.
    - `.github/workflows/staging.yml` : Gate C sur push main.
    - `.github/workflows/nightly.yml` : Gate D cron 03:00 UTC.
    - `.github/workflows/release.yml` : Gate E sur tag `v*`.
    - `.github/dependabot.yml` ou `renovate.json` config.
    - Branch protection rules sur `main` (admin manuel à appliquer dans GitHub UI).
15. **`next.config.ts`** initial avec :
    - `experimental.ppr = 'incremental'` (Partial Prerendering).
    - `experimental.reactCompiler = true`.
    - `experimental.useCache = true` si applicable.
    - `experimental.viewTransition = true`.
    - `images.formats = ['image/avif', 'image/webp']`.
    - Headers de sécurité de base (CSP placeholder à raffiner sprint 16).
    - `poweredByHeader: false`.
    - `compress: true` (Brotli côté Cloudflare en prod).
16. **Configurer Sentry** dès maintenant (`@sentry/nextjs` wizard) — DSN via env, sample 100 % en dev, 10 % en prod.
17. **Configurer OpenTelemetry** (`@vercel/otel` ou `@opentelemetry/sdk-node`) — exporter OTLP vers self-hosted Tempo/Jaeger plus tard.
18. **Configurer Plausible** stub (script tag dans `<head>` via env) ; vraie intégration sprint 14.
19. **Configurer `web-vitals`** beacon endpoint (`src/app/api/vitals/route.ts` Edge runtime) qui logge LCP/INP/CLS/TTFB/FCP par session.
20. **Pre-commit scripts custom** (Bash/TS) :
    - `scripts/check-i18n.ts` (parité FR/EN).
    - ~~`scripts/check-anti-formation.sh` (grep banni)~~ — **supprimé** par ADR 0003 (2026-05-07).
    - `scripts/check-anti-siren.sh`.
    - `scripts/check-anti-hex.sh`.
    - `scripts/check-use-client.ts` (commentaire `// use-client: <raison>` requis).
    - `scripts/check-bundle-size.ts` (size-limit ou next/bundle-analyzer parsing).
    - `scripts/check-zod.ts` (chaque schéma a un test).
21. README.md initial : commands + arborescence + lien `_DECISIONS-FINALES.md` + liste des gates CI + workflow ADR.
22. **`docs/adr/0001-stack-initial.md`** créé en référence à `_DECISIONS-FINALES.md` + `0002-i18n-suffix-vs-jsonb.md` à valider phase database.
23. Premier commit : `chore(setup): initialize Next.js 15 + TS strict + Tailwind v4 + full CI gates + observability stubs`.

**DoD**

- `pnpm dev` lance le site sur `http://localhost:3000` sans erreur.
- `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test` ✅ (au moins 1 test smoke).
- **Tous les Gates A+B passent en CI sur la PR initiale** (les 12+ scripts custom incluent).
- Husky bloque un commit avec message non conventionnel ET un commit qui inclut `formation` ou un hex code.
- `gitleaks` détecte un faux secret de test.
- `pnpm bundle:analyze` produit un rapport HTML.
- Sentry capture une erreur volontaire de test.
- `web-vitals` beacon reçoit un POST quand on charge `/`.
- README clair pour un nouveau dev.

**Best Practices 2026 appliquées au Sprint 0**

- React Compiler activé · PPR incremental · View Transitions API activé · OpenTelemetry instrumenté · CI gates A+B+C+D+E configurés · OIDC GitHub Actions · gitleaks · Trivy (sera ajouté Sprint 22 sur Docker images).

---

### SPRINT 1 — Implémentation tokens (Design.md v1 historique → puis pivot v3 Sprint 14.5)

> **NOTE 2026-05-06** : ce Sprint 1 a été livré le 2026-05-06 sous doctrine v1 Webflow-inspired (commit `fe000c6`). La section ci-dessous documente la DoD historique v1 pour traçabilité. Le pivot v3 Editorial Premium Light a été appliqué post-Sprint 14 (cf. **Sprint 14.5 « Pivot doctrinal v3 »** ajouté plus bas) et fait foi pour les audits finaux. Pour relancer Sprint 1 from scratch sur un nouveau projet, **utiliser directement la doctrine v3** (cf. `axionia/Design.md` v3 + ADR 0002).

**Skills** : `axionia-core` + `axionia-design` + `axionia-mobile-first` + `axionia-a11y` + `axionia-performance`.

**Pré-requis** : `Design.md` racine existe (v3 Editorial actif depuis 2026-05-06 / v1 Webflow archivé). `axionia-design/SKILL.md` est la doctrine canon. **Ne pas réinventer la doctrine — l'implémenter strictement.**

**Étapes**

#### 1.1 · CSS variables Webflow (`src/app/globals.css`)

Implémenter **à l'identique** la palette du `axionia-design/SKILL.md` § Palette :

- **Primary** : `--color-primary: 20 110 245` (#146ef5 Webflow Blue), `--color-primary-hover: 0 85 212` (#0055d4), `--color-primary-400: 59 137 255` (#3b89ff), `--color-primary-300: 0 106 204` (#006acc), `--color-primary-fg: 255 255 255`.
- **Secondaries (6, usage disciplined)** : `--color-purple: 122 61 255` (#7a3dff), `--color-pink: 237 82 203` (#ed52cb), `--color-green: 0 215 34` (#00d722), `--color-orange: 255 107 0` (#ff6b00), `--color-yellow: 255 174 19` (#ffae13), `--color-red: 238 29 54` (#ee1d36).
- **Module-color mapping** (ADR 0001) : Module 1 Interventions = Webflow Blue (primary), Module 2 Audit = orange `#ff6b00`, Module 3 Implémentation = purple `#7a3dff`. Cas concrets = green. Blog = neutral.
- **Background / text** : `--color-bg: 255 255 255`, `--color-fg: 8 8 8` (near-black).
- **Neutrals** : `--color-gray-800: 34 34 34`, `--color-gray-700: 54 54 54`, `--color-gray-600: 90 90 90`, `--color-gray-300: 171 171 171`, `--color-border: 216 216 216`, `--color-border-hover: 137 137 137`.
- **Semantic** : success = green, warning = yellow, error = red, info = primary (alias).
- Format RGB triplets (Tailwind v4 `rgb(var(--color-primary) / <alpha-value>)`).

#### 1.2 · Radius (conservatif)

- `--radius-xs: 2px`, `--radius-sm: 4px`, `--radius-md: 6px`, `--radius-lg: 8px`, `--radius-full: 9999px` (avatars seulement).
- **Aucun radius > 8px sur fonctionnels** (linter custom à ajouter dans Gate A).

#### 1.3 · Spacing (échelle fractionnelle Webflow)

- `--space-0-25: 1px`, `--space-0-5: 2.4px`, `--space-0-75: 3.2px`, `--space-1: 4px`, `--space-1-5: 5.6px`, `--space-2: 8px`, `--space-3: 12px`, `--space-4: 16px`, `--space-5: 20px`, `--space-6: 24px`, `--space-8: 32px`, `--space-10: 40px`, `--space-12: 48px`, `--space-16: 64px`, `--space-20: 80px`, `--space-24: 96px`.

#### 1.4 · Shadows 5-couches signature (cascade)

```css
--shadow-card:
  rgba(0, 0, 0, 0) 0px 84px 24px, rgba(0, 0, 0, 0.01) 0px 54px 22px,
  rgba(0, 0, 0, 0.04) 0px 30px 18px, rgba(0, 0, 0, 0.08) 0px 13px 13px,
  rgba(0, 0, 0, 0.09) 0px 3px 7px;
--shadow-elevated: <variante plus prononcée pour modales/popovers>;
--shadow-subtle: <1-2 couches pour éléments légers>;
```

#### 1.5 · Typographie — Manrope + Inconsolata

- `next/font/google` :
  ```ts
  import { Manrope, Inconsolata } from "next/font/google";
  const manrope = Manrope({
    subsets: ["latin"],
    variable: "--font-sans",
    display: "swap",
    weight: ["400", "500", "600", "700"],
  });
  const inconsolata = Inconsolata({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
  ```
- Échelle (cf. Design.md §3) : 80px display hero (weight 600, lh 1.04, ls -0.8px), 56px section heading (600, 1.04), 32px sub (500, 1.30), 24px feature (500-600, 1.30), 20px lead (400-500, 1.40-1.50), 16px body (400-500, 1.60, ls -0.16px), 15px label uppercase (500, 1.30, ls 1.5px), 14px caption, 12.8px badge uppercase (550, 1.20), 10px micro uppercase (500-600, 1.30, ls 1px).
- Variables Tailwind : `--text-display`, `--text-section`, `--text-sub`, `--text-feature`, `--text-lead`, `--text-body`, `--text-label-up`, `--text-caption`, `--text-badge-up`, `--text-micro-up`.
- Helper component `<Eyebrow>` qui applique automatiquement uppercase + tracking + weight + size.

#### 1.6 · Animation signature

- `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)` (Webflow-like).
- `--duration-fast: 150ms`, `--duration-base: 250ms`, `--duration-slow: 400ms`.
- Classe utilitaire `.cta-translate` qui applique `transition: transform var(--duration-base) var(--ease-out)` + `&:hover { transform: translateX(6px); }`.
- **`prefers-reduced-motion: reduce`** désactive toutes les animations via media query global :
  ```css
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation: none !important;
      transition: none !important;
    }
  }
  ```

#### 1.7 · Breakpoints Webflow (Tailwind v4)

Configurer dans `@theme` :

- `xs: 479px` (mobile S)
- `md: 768px` (tablet)
- `lg: 992px` (desktop)
- `xl: 1280px` (wide)
- Container max-width 1280px (`<Container>` composant).

#### 1.8 · Composants utilitaires de base

- `cn()` (clsx + tailwind-merge) dans `src/lib/utils.ts`.
- `<Container>` (max-w 1280, padding responsive 16/24/32/48).
- `<Section>` (vertical rhythm Webflow : `py-16 sm:py-20 lg:py-28`, anchor id, eyebrow optionnel).
- `<Eyebrow>` (label uppercase 10-15px tracking 0.6-1.5px).

#### 1.9 · Page demo `/_design` (dev only)

Rend palette + typo échelle + spacing + radius + shadows + animation `translate-x-[6px]` + module-color mapping + lecteur de contraste AA pour chaque paire text/bg.

#### 1.10 · Linter contrast + radius custom

Script `scripts/check-contrast.ts` (axe-core ou `@adobe/leonardo-contrast-colors`) qui valide tous les usages text/bg ≥ 4.5:1 AA, ≥ 7:1 AAA pour body. Ajout au Gate A.

Script `scripts/check-radius.ts` qui détecte tout `border-radius > 8px` hors `radius-full`.

#### 1.11 · Commit

`feat(design): implement Webflow-inspired tokens (palette + typo Manrope + shadows 5-layer + animation translate-6px) per Design.md + ADR 0001`.

**DoD**

- Tous les tokens du `Design.md` accessibles via classes Tailwind v4.
- Aucune valeur hex hardcodée hors `globals.css` (grep CI passe).
- Page `/_design` rend palette complète + 6 secondaires + typo échelle + 5-layer shadow + `translate-x-[6px]` au hover.
- Manrope chargée en `font-display: swap`, Inconsolata aussi, total fonts ≤ 100 KB woff2.
- Linter contrast 0 violation.
- Linter radius 0 radius > 8px hors avatars.
- Lighthouse `/` mobile : Perf ≥ 95, Accessibility ≥ 95.

**Best Practices 2026 appliquées au Sprint 1**

- `next/font/google` avec `display: swap` + `adjustFontFallback`.
- CSS variables RGB triplets (compatible alpha Tailwind v4).
- `@theme` Tailwind v4 directive.
- `prefers-reduced-motion` strict en early CSS.
- View Transitions API préparée (sera activée Sprint 2 layout).

---

### SPRINT 2 — Layout `[locale]` + i18n + navigation parfaite

**Skills** : `axionia-i18n` + `axionia-mobile-first` + `axionia-a11y` + `axionia-anti-spa` + `axionia-seo-aeo`.

**Objectif** : la navigation doit être **parfaite** — keyboard-friendly, mobile-friendly, SEO-friendly, multilingue, jamais cassée, jamais SPA.

**Étapes**

#### 2.1 · next-intl

1. `src/i18n/routing.ts` : `defineRouting({ locales: ['fr', 'en'], defaultLocale: 'fr', localePrefix: 'always', pathnames: { ... } })`.
2. `src/i18n/request.ts` : load messages selon locale.
3. `src/middleware.ts` : `createMiddleware(routing)`.
4. `src/messages/fr.json` + `src/messages/en.json` : namespaces `nav`, `footer`, `cta`, `home`, `interventions`, `audit`, `implementation`, `cases`, `legal`, `forms`, `errors`. Clés vides initiales, à remplir au fur et à mesure.
5. Pathnames traduits (FR canon, EN miroir) — cf. Navigation-Complete §1 :
   - `/interventions` ↔ `/interventions` (ou `/services`)
   - `/audit` ↔ `/audit`
   - `/implementation` ↔ `/implementation`
   - `/cas-concrets` ↔ `/case-studies`
   - `/a-propos` ↔ `/about`
   - `/conditions-generales` ↔ `/terms`
   - etc. (table complète dans `_AUDIT/02b-mapping-pages.md`).

#### 2.2 · Layout racine

1. `src/app/[locale]/layout.tsx` (Server Component) :
   - `<html lang={locale}>` avec `dir="ltr"`.
   - `<NextIntlClientProvider>` wrapping children.
   - `<SkipToContent />` premier focusable.
   - `<Header />` puis `<main id="main">` puis `<Footer />`.
   - `generateMetadata()` : titre canonique + alternates `hreflang` (FR + EN + x-default) + OG + Twitter.
   - JSON-LD `Organization` (OÜ estonienne — pas de SIREN) + `WebSite` + sitelinks search action.
2. `src/app/[locale]/not-found.tsx` (404 localisée).
3. `src/app/[locale]/error.tsx` (Client component minimal pour erreur runtime).
4. `src/app/[locale]/loading.tsx` (skeleton générique).

#### 2.3 · Header (5 items, ZÉRO dropdown)

Composant `src/components/nav/Header.tsx` (Server Component) + `<MobileNav>` Client Component.

Desktop (≥ lg) :

- Logo gauche (link vers `/`).
- 4 liens centraux : Interventions · Audit · Implémentation · Cas concrets.
- CTA droit « Réserver une intervention · 490 € » (variant primary).
- `<LocaleSwitcher>` (FR · EN) — Server Component avec `<I18nLink>` ; jamais de JS pour switcher.

Mobile (< lg) :

- Logo gauche · Hamburger droit (touch target 44×44).
- `<Sheet>` shadcn pour drawer plein écran : 4 liens stacked + CTA + locale switcher + footer du drawer (téléphone, email, mentions).
- Trap focus dans le drawer, `Escape` ferme, `aria-modal="true"`.

Comportements :

- État actif : underline subtle ou indicator bottom 2px sur le lien correspondant à `pathname`.
- Scroll : header colle en haut, fond opaque dès `scrollY > 8`, transition `--duration-base`.
- Aucun `'use client'` sur le Header lui-même — uniquement sur `MobileNav` et `ScrollEffect`.
- Tous les liens via `<Link>` next-intl, `prefetch` par défaut.

#### 2.4 · Footer 5 zones

Composant `src/components/nav/Footer.tsx` (Server Component pure).

- Zone 1 — Identité : logo + baseline + adresse OÜ (placeholder à remplir) + langues.
- Zone 2 — Services : liens vers les 3 modules + Cas concrets.
- Zone 3 — Ressources : Blog, Guide, FAQ, Help center, llms.txt.
- Zone 4 — Entreprise : À propos, Contact, Calendrier, Newsletter.
- Zone 5 — Légal : 6 pages légales (cf. doc 28).
- Bandeau bas : copyright + sélecteur langue + lien sitemap.

#### 2.5 · Breadcrumbs partout (sauf accueil)

Composant `<Breadcrumbs items={[...]} />` Server Component avec JSON-LD `BreadcrumbList` automatique. Visible visuellement + sémantique.

#### 2.6 · Skip-to-content

`<a href="#main" className="sr-only focus:not-sr-only ...">Aller au contenu</a>` premier dans `<body>`. Visible uniquement quand focus.

#### 2.7 · Sitemap dynamique + robots + llms.txt + IndexNow

- `src/app/sitemap.ts` : génère toutes les routes FR + EN avec `lastModified`, `changeFrequency`, `priority`. Lit Prisma pour les contenus dynamiques (articles, cas, FAQ).
- `src/app/robots.ts` : Allow all, sitemap reference.
- `src/app/llms.txt/route.ts` : fichier llms.txt + llms-full.txt (cf. axionia-seo-aeo).
- API IndexNow : `src/app/api/indexnow/route.ts` POST avec key.

**DoD**

- Naviguer FR ↔ EN sur 5 pages random, jamais d'écart de layout, jamais de flash.
- Tab keyboard parcourt Header → Main → Footer dans l'ordre logique. Skip-to-content fonctionne.
- Lighthouse mobile sur `/fr` : Perf ≥ 95, SEO 100, A11y ≥ 95.
- `axe` 0 violation sur le layout.
- Mobile drawer s'ouvre/ferme au clavier (`Enter` / `Escape`).
- Test Playwright : « depuis l'accueil FR, cliquer "EN" → URL devient `/en`, Header en EN ».

---

### SPRINT 3 — Composants atomiques (lib UI Webflow-inspired)

**Skills** : `axionia-design` + `axionia-a11y` + `axionia-mobile-first`.

**Règles spécifiques Webflow**

- `<Button variant="primary">` : background `--color-primary`, text white, radius 4px, weight 550, hover `--color-primary-hover`, hover transform `translate-x-[6px]` + transition 250ms ease-out, focus ring 2px `--color-primary` + offset 2px.
- `<Button variant="ghost">` : transparent, text `--color-fg`, hover `translate-x-[6px]`.
- `<Card>` : `1px solid var(--color-border)`, radius 4-8px (jamais plus), `--shadow-card` 5-couches au hover (transition fade-in subtile 200ms).
- `<Badge>` : background `rgb(var(--color-primary) / 0.1)`, text `--color-primary`, radius 4px, uppercase 12.8px tracking 0px weight 550.
- `<Input>` / `<Textarea>` / `<Select>` : `1px solid var(--color-border)`, radius 4px, focus `--color-primary` + ring 2px alpha 0.2, hover `--color-border-hover`.
- `<Eyebrow>` : uppercase, 10-15px, weight 500-600, tracking 0.6-1.5px, color `--color-gray-700` ou variant module.

**Étapes**

1. Étendre les composants shadcn pour matcher `Design.md` (Webflow-inspired) :
   - `<Button>` : variants `primary | secondary | ghost | outline | link | destructive`. Sizes `sm | md | lg | xl`. `asChild` supporté. Loading state avec spinner.
   - `<Input>`, `<Textarea>`, `<Select>`, `<Checkbox>`, `<RadioGroup>`, `<Switch>`, `<Slider>`.
   - `<Card>` avec sous-composants `Header`, `Title`, `Description`, `Content`, `Footer`.
   - `<Badge>` variants `neutral | accent | success | warning | danger`.
   - `<Alert>` 4 variants idem.
   - `<Tabs>`, `<Accordion>`, `<Tooltip>`, `<Dialog>`, `<Sheet>`, `<DropdownMenu>` (admin uniquement), `<Popover>`.
2. Composants Axion-IA spécifiques :
   - `<I18nLink>` (wrapper next-intl).
   - `<LocaleSwitcher>`.
   - `<Price amount={490} currency="EUR" suffix="HT" />`.
   - `<Cta variant="primary" href={...}>` (analytics-friendly, data attribute auto).
   - `<Stat number={...} label={...} suffix={...} />`.
   - `<TestimonialCard>`, `<CaseStudyCard>`, `<ArticleCard>`, `<FaqAccordion>`.
   - `<Breadcrumbs>` (déjà sprint 2).
   - `<JsonLd>` helper.
3. Tests Vitest unit pour chaque composant : props, variants, a11y axe (avec `@testing-library/react` + `jest-axe`).

**DoD**

- Couverture ≥ 80 % sur `src/components/ui/*`.
- Storybook **non requis** (cf. décision : pas d'outil hors stack), mais page interne `/_components` (dev only) qui rend tous les composants pour validation visuelle.
- 0 violation axe sur `/_components`.

---

### SPRINT 4 — Composants composites & sections

**Skills** : `axionia-design` + `axionia-mobile-first`.

**Étapes**

1. Sections réutilisables (toutes Server Components) :
   - `<Hero>` (variants : `accueil`, `module`, `produit`, `transverse`).
   - `<FeatureGrid items={...} columns={2|3|4}>`.
   - `<ProcessSteps steps={...}>` (étapes numérotées).
   - `<TestimonialsCarousel>` (Client Component avec embla-carousel ou pure CSS scroll-snap mobile-first).
   - `<CaseStudiesShowcase>` (3-6 cards horizontaux desktop, stack mobile).
   - `<FaqBlock items={...}>` (auto JSON-LD `FAQPage`).
   - `<CtaBlock>` (full-width section conversion).
   - `<MetricsRow stats={...}>` (chiffres marquants).
   - `<PricingTable plans={...}>` (si applicable — sinon SKIP).
   - `<TimelineBlock events={...}>` (page À propos).
   - `<TeamGrid>` (page À propos).
   - `<TrustBar logos={...}>` (logos clients monochromes).
2. Toutes les sections respectent :
   - Mobile-first (mobile par défaut, breakpoints `sm md lg xl 2xl`).
   - Padding section `py-16 sm:py-20 lg:py-28`.
   - Container max-w 1280.
   - Pas d'animation au scroll forcée (subtle uniquement).
3. Animations motion : `<FadeInOnView delay={...}>` Client Component avec `framer-motion` et `prefers-reduced-motion` strict.

**DoD**

- Page `/_sections` (dev) rend toutes les sections composites.
- Aucune section n'a besoin de `'use client'` sauf `TestimonialsCarousel` et `FadeInOnView`.

---

### SPRINT 5 — Module 1 : Interventions entreprise (6 pages — accent Editorial Blue)

**Skills** : `axionia-core` + `axionia-anti-spa` + `axionia-seo-aeo` + `axionia-i18n` + `axionia-design` + `axionia-content-models` + `axionia-performance`.

**Couleur module v3** : Editorial Blue `#1a4dd9` (token `--color-primary`, densifié post-pivot v3). Hero peut utiliser `bg-halo-warm` + dot indicator primary. Aucun accent secondaire en CTA principal.

**Pages** :

1. `/interventions` (listing parent) — wireframe `02-Page-Accueil.md` adapté + 5 cards interventions + simulateur ROI inline (placeholder vers sprint 12) + calendrier preuve sociale.
2. `/interventions/essentielle` ⭐ — page phare, conversion principale. Wireframe `03-Page-Essentielle.md`. Hero conversion + bénéfices + livrables + déroulé jour J + témoignages + ROI + FAQ + CTA réservation 490 €.
3. `/interventions/equipes` — cible équipes & salariés (11+).
4. `/interventions/managers` — cible managers.
5. `/interventions/conference` — format conférence ½ journée.
6. `/interventions/dirigeants` — cible dirigeants & CODIR.

**Pour chaque page** :

- Server Component pure (sauf forms/calendrier interactifs).
- `generateMetadata()` avec title, description, OG image dynamique via `@vercel/og`, canonical, alternates hreflang.
- JSON-LD : `Service` ou `Product` (selon analyse SEO) + `BreadcrumbList` + `FAQPage` si FAQ + `Offer` avec prix.
- Bloc « Réponse directe AEO » en haut (40-80 mots, structure question-réponse, citable par LLM).
- Texte FR rédigé d'abord, EN traduit ensuite (mais via clés i18n dès le début).
- Mobile-first absolu : tester sur 360px avant tout.
- Aucun `'use client'`.
- Test Playwright : ouvrir page, vérifier H1, CTA présent, FAQ accordions ouvrent, hreflang correct.
- Lighthouse mobile ≥ 95 sur les 4 axes.

**DoD du sprint**

- 6 pages publiées en FR + EN.
- 6 OG images dynamiques fonctionnelles.
- 6 tests Playwright verts × 4 navigateurs (Chromium, WebKit, Firefox, Mobile Safari).
- 6 audits Lighthouse ≥ 95 mobile + ≥ 98 desktop.
- 0 violation axe sur les 6 pages.
- 6 visual regression baselines créées et stables.
- 6 JSON-LD validés via Schema.org Validator API.
- Bundle delta < +5 KB par page produit.
- LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 mesurés sur trace WebPageTest local.
- Tous les forms ouvrent un `useActionState` (stub backend) sans console error.
- Speculation Rules ajoutés sur les 6 cards listing (`eagerness="moderate"`).
- View Transitions actives entre listing et page produit.
- Rapport `_AUDIT/03-frontend-progress.md` mis à jour.

### MID-SPRINT CHECKPOINT ↗ (entre sprint 5 et 6 — obligatoire)

- **Will démo** : Will navigue sur les 6 pages FR+EN au clavier uniquement, en mobile (DevTools 360px), en desktop, en mode reduced-motion, avec NVDA/VoiceOver actif. Annote tout ce qui cloche.
- **Cross-check skills** : vérifier qu'on n'a pas dérivé d'une règle `axionia-*` (re-grep des bannis, re-vérif des tokens, re-vérif `'use client'` justifiés).
- **Performance budget** : page phare `/interventions/essentielle` doit avoir LCP ≤ 1.8s sur 4G slow throttling.
- **SEO/AEO** : valider chaque page sur https://search.google.com/test/rich-results et https://ahrefs.com/seo-toolbar (extension).
- **STOP & ASK Will** avant module 2.

---

### SPRINT 6 — Module 2 : Audit & optimisation (6 pages — accent Orange) — REFACTOR 2026-05-07

> **Refactor 2026-05-07** : module audit refactoré dans `axionia/src/app/[locale]/audit/`. Anciennes routes `/audit/{complet,departement,point-de-vente,cabinet}` SUPPRIMÉES. Nouvelle architecture orientée parcours d'engagement B2B (cf. `_AUDIT/02b-mapping-pages.md` v2 §3, `content/audit.ts` HEAD). Cette section reflète l'état effectif HEAD `fd91518`.

**Skills** : idem sprint 5.

**Couleur module v3 (ADR 0002, mapping conservé depuis 0001)** : Orange `#ff6b00` (`--color-accent-orange`) en accent secondaire (badges, dot indicator hero, illustrations module-specific). **CTA primaire reste Editorial Blue `#1a4dd9`**. Limite : jamais 3+ couleurs sur une même section.

**Pages** :

1. `/audit` (listing parent) — `AuditHeroSchema` + 4 cartes diagnostic (pas de `<PriceMatrix>` 4×2 dans la version livrée — `AggregateOffer` à brancher Sprint 17 settings DB).
2. `/audit/flash` — Diagnostic Flash (porte d'entrée la plus accessible).
3. `/audit/process` — Audit Ciblé processus.
4. `/audit/strategique-pme` — Audit stratégique PME (10-49 salariés).
5. `/audit/strategique-eti` — Audit stratégique ETI (50+ salariés).
6. `/audit/demande` — formulaire 5 étapes mutualisé pour les 4 niveaux (`'use client'` léger). CTA tunnel depuis chaque produit avec `?audit=flash|process|strategique-pme|strategique-eti`.

**Spécifique sprint 6 (réactualisé)** :

- Tunnel form unifié `/audit/demande` au lieu de 4 forms intégrés en page produit.
- `content/audit.ts` source FR+EN avec helper `getAudit(slug)`.
- CTAs des 4 pages produit pointent tous vers `/audit/demande?audit={slug}`.

**DoD** : idem sprint 5, adapté au refactor (6 pages, 5 OG sur les pages produit + listing, Playwright × 4 nav, Lighthouse, JSON-LD validés `Service` + `FAQPage` (`/audit/flash`) + `BreadcrumbList`, visual regression, bundle delta OK).

### MID-SPRINT CHECKPOINT ↗ (entre sprint 6 et 7)

- Will valide les 5 pages audit en démo.
- Re-passe Gate A + Gate B complets.
- Vérifie qu'aucune régression sur les 6 pages du module 1 (visual + Lighthouse).
- Met à jour `SESSION_LOG.md`.
- **STOP & ASK Will** avant module 3.

---

### SPRINT 7 — Module 3 : Implémentation IA (10 pages — accent Purple)

**Skills** : idem sprint 5.

**Couleur module v3 (ADR 0002, mapping conservé depuis 0001)** : Purple `#7a3dff` (`--color-accent-purple`) en accent secondaire (badges, dot indicator hero, illustrations). **CTA primaire reste Editorial Blue `#1a4dd9`**. Page premium `/implementation/ia-custom` peut exploiter purple plus largement (badges, hero accent, cards section IA Custom).

**Pages** : cf. Navigation-Complete §1.2 module 3 (10 écrans listés).

**Spécifique sprint 7** :

- Plus dense techniquement (custom IA, intégration outils).
- Utiliser `<ProcessSteps>` pour le déroulé en 4 phases.
- Cas concrets liés en bas de page (`<CaseStudiesShowcase>` filtrée par tag).

**DoD** : 10 pages × 8 critères = 80 checks verts (Playwright × 4 nav, Lighthouse mobile + desktop, axe, visual regression, JSON-LD, bundle).

### MID-SPRINT CHECKPOINT ↗ (entre sprint 7 et 8)

- Will démo des 10 pages.
- Audit transverse : les 21 pages des 3 modules doivent partager strictement les mêmes patterns (hero, sections, CTA, footer pré-section). Toute divergence est un bug.
- Bundle global après 21 pages : vérifier qu'on est encore < 100 KB JS first load par page.
- **STOP & ASK Will** avant cas concrets.

---

### SPRINT 8 — Cas concrets (3 templates × 2 langues + filtres — accent Green)

**Skills** : `axionia-i18n` + `axionia-seo-aeo` + `axionia-content-models` + `axionia-database` (lecture seule pour fixtures).

**Couleur module v3 (ADR 0002)** : **Sage `#7a8870`** (`--color-sage`, repositionnement éditorial du green `#00d722` v1 — cf. ADR 0002 § Module-color mapping) en accent (badges « +X% ROI », metrics). **CTA primaire reste Editorial Blue `#1a4dd9`**.

**Templates** :

1. `/cas-concrets` — listing avec filtres (industrie, taille, problématique).
2. `/cas-concrets/[slug]` — page détail.
3. `/cas-concrets/secteur/[slug]` — listing filtré par secteur (route SEO-friendly type `/cas-concrets/secteur/cabinet-avocat`, `/cas-concrets/secteur/e-commerce`, etc.).

**Étapes**

1. Listing `/cas-concrets` : grille avec filtres (industrie, taille entreprise, problématique). Fixtures Zod en dev (5-8 cas plausibles), Prisma en prod (sprint 15).
2. Template `/cas-concrets/[slug]` : hero + contexte + problème + solution + résultats chiffrés + témoignage client + CTA réservation. Schema.org `Article` + `Review`.
3. RSS feed `/cas-concrets/rss.xml`.

**DoD** : listing + 8 fixtures rendent. Filtres URL-driven (pas de state client). Test Playwright : filtrer par industrie change l'URL et la liste.

---

### SPRINT 9 — Pages transversales (couverture exhaustive — alignée `02b-mapping-pages.md`)

**Templates obligatoires (× 2 langues sauf indication)** :

#### 9.A · Pages institutionnelles

- `/a-propos` — wireframe + doc 30. `<Hero>` + mission + équipe + timeline + valeurs + CTA.
- `/guide-utilisation` — doc 32.
- `/contact` — formulaire contact (sprint 13) + info OÜ + carte (statique).
- `/methodologie` — page transversale présentant la méthodologie Axion-IA (intervention → audit → implémentation), schémas + chiffres.
- `/glossaire` — listing termes techniques IA + définitions FR/EN. Schema.org `DefinedTermSet`.
- `/comparaisons` (listing) + `/comparaisons/[slug]` — pages « Axion-IA vs cabinet conseil traditionnel », « Axion-IA vs ESN », etc.

#### 9.B · Blog (5 templates)

- `/blog` — listing paginé avec sidebar (catégories, tags, derniers articles).
- `/blog/[slug]` — article (MDX + Tiptap support, JSON-LD `Article`).
- `/blog/categorie/[slug]` — listing filtré par catégorie.
- `/blog/tag/[slug]` — listing filtré par tag.
- `/blog/auteur/[slug]` — page auteur (bio + photo + articles + JSON-LD `Person` + `sameAs` réseaux).

#### 9.C · FAQ (3 templates dédiés — pas qu'un composant)

- `/faq` — listing global toutes catégories + recherche locale.
- `/faq/[slug]` — question/réponse en page dédiée (canonical pour citations LLM, JSON-LD `Question` + `Answer`).
- `/faq/categorie/[slug]` — listing filtré.
- 20 questions seedées initiales (cf. doc 18).

#### 9.D · Centre d'aide (3 templates)

- `/help` — listing sections + recherche FTS (branchée sprint 15).
- `/help/[slug]` — article aide.
- `/help/categorie/[slug]` — listing filtré.
- 10 articles seedés initiaux.

#### 9.E · Témoignages (1 template + détail)

- `/temoignages` — listing complet (au-delà du `<TestimonialsCarousel>` des modules).
- `/temoignages/[slug]` — page détail témoignage longue forme + JSON-LD `Review` + `Person`.

#### 9.F · Recherche globale (1 template)

- `/recherche?q=...` — résultats agrégés (articles, cas, FAQ, help, services). FTS Postgres branchée sprint 15. Vue facettée par type. Surfaces les snippets.

#### 9.G · Sous-catégories & pages dédiées (docs 11 + 20 + 21)

- Sous-catégories interventions (doc 20) — slugs SEO type `/interventions/secteur/[slug]`, `/interventions/metier/[slug]` selon plan éditorial.
- Pages dédiées (docs 11 + 21) — pages produit fines pour intentions de recherche spécifiques (ex. `/interventions/intelligence-artificielle-cabinet-avocat`).

**Pour chaque page** : `generateMetadata` + JSON-LD adapté + hreflang + Server Component + test Playwright + Lighthouse ≥ 95.

**DoD** :

- Tous les templates ci-dessus live FR + EN.
- 20 FAQ seedées · 10 help seedées · 5 articles blog seedés · 3 cas concrets seedés · 6 témoignages seedés.
- MDX + Tiptap renderers fonctionnent côte à côte.
- Page recherche teste FTS local (mock dev, vrai Prisma sprint 15).
- 0 page orpheline (chaque page a au moins un lien depuis le footer ou un parent).

---

### SPRINT 10 — Pages légales (6 pages)

**Skills** : `axionia-core` (mentions OÜ obligatoires) + `axionia-rgpd` (politique confidentialité, cookies, droits utilisateurs RGPD).

**Pages** : Mentions légales · CGU · CGV (doc 31) · Politique de confidentialité · Politique cookies · Politique de déplacement.

**Règles non négociables** :

- Mentions « OÜ estonienne » + registrikood placeholder + adresse Estonia.
- **Aucune** mention SIREN/SIRET/RCS/TVA française.
- TVA estonienne EE selon résidence client.
- Pas de Stripe → pas de mention paiement Stripe.
- Texte FR juridique d'abord, EN traduit avec relecture.

**DoD** : 6 pages live, audit textuel `grep -i "siren\|siret\|rcs"` retourne 0 résultats.

---

### SPRINT 11 — Calendrier maison (composant + page)

**Skills** : `axionia-calendar` (canon) + `axionia-forms` + `axionia-a11y` + `axionia-i18n`.

**Étapes**

1. Composant `<HouseCalendar>` (Client Component, mais SSR placeholder).
2. Wireframe `04-Calendrier-Maison.md` + doc 24.
3. Logique : créneaux dispo lus depuis Prisma `calendar_options` (mock JSON en sprint 11, branche Prisma sprint 15).
4. UX : navigation mois prev/next, sélection date → liste créneaux → confirmation → submit.
5. A11y : navigation clavier (flèches), aria-label dates, annonce live region pour changements.
6. Test Playwright : « réserver le 15 du mois prochain à 14h → écran de confirmation ».

**DoD** : `<HouseCalendar>` autonome + page `/reserver` live + form connecté à `<Sheet>` de récap.

---

### SPRINT 12 — Simulateur ROI

**Skills** : `axionia-forms` + `axionia-a11y` + `axionia-mobile-first`.

**Étapes**

1. Wireframe `05-Simulateur-ROI.md` + doc 23.
2. Composant `<RoiSimulator>` (Client Component, isolé).
3. Inputs : taille équipe, secteur, % temps tâches répétitives, salaire moyen, etc. Validation Zod.
4. Calcul réactif (useReducer ou Zustand local) → affiche ROI annualisé + heures gagnées + payback.
5. CTA « Réserver un audit » avec params pré-remplis du simulateur.
6. Sauvegarde optionnelle email pour recevoir le PDF (formulaire sprint 13).
7. A11y : sliders avec aria-valuetext, résultats annoncés en live region.

**DoD** : intégré sur `/interventions`, `/audit`, `/implementation`. Test Playwright : modifier taille équipe → ROI se met à jour. Page autonome `/roi`.

---

### SPRINT 13 — Formulaires multi-step (5 forms)

**Skills** : `axionia-forms` + `axionia-anti-spa` + `axionia-a11y` + `axionia-rgpd` (consentement, finalité, droits + cookie banner Turnstile-only).

**Forms** :

1. **Audit 5 étapes** (`/audit/demande`).
2. **Implémentation 4 étapes** (`/implementation/contact`).
3. **Contact** (`/contact`) — single-step.
4. **Newsletter** (composant footer + popup discret).
5. **Réservation intervention** (calendrier + form coords).

**Règles** :

- React Hook Form + Zod (schémas dans `src/lib/schemas/forms.ts`).
- Server actions Next.js 15 (sprint 17 finalise — ici stub `console.log` + revalidation).
- Persistance entre étapes : Zustand store local (volatile, pas de localStorage sauf opt-in).
- Cloudflare Turnstile sur tous les forms publics.
- Confirmation : page `/confirmation/[type]` avec récap.
- Email confirmation : queue BullMQ (sprint 18-19).

**A11y** :

- Indicateur d'étape (`aria-current="step"`, role="progressbar" si pertinent).
- Erreurs annoncées (`role="alert"` ou aria-live).
- Bouton « Précédent » garde l'état.
- Aucune perte de saisie en cas de page reload (warn beforeunload sur dirty).

**DoD** : 5 forms fonctionnels (stub backend), 5 tests Playwright golden path + 5 tests Playwright erreur de validation. 0 axe violation.

---

### SPRINT 14 — Pages système & SEO finalisé (couverture exhaustive)

**Skills** : `axionia-seo-aeo` + `axionia-rgpd`.

**Étapes**

1. `/_not-found` 404 par locale avec liens utiles.
2. `/error` 500 minimal (Client Component imposé par Next.js).
3. `/maintenance` (page statique pour bascule via env flag).
4. **`/desabonnement?token=...`** — landing One-Click Unsubscribe RFC 8058 (List-Unsubscribe-Post). Server action qui décode le token (HMAC), désabonne en DB, affiche confirmation FR/EN.
5. **`/preferences-cookies`** — page de gestion des cookies (audit RGPD strict).
6. **`/mes-donnees`** — page « exercer vos droits RGPD » (export, suppression, rectification) avec formulaire dédié → server action sprint 17.
7. `app/sitemap.ts` final : routes statiques + dynamiques (articles, cas, FAQ, help, témoignages, glossaire, comparaisons) — sprint 15 connectera Prisma.
8. `app/robots.ts` final.
9. `llms.txt` + `llms-full.txt` (cf. axionia-seo-aeo).
10. IndexNow `app/api/indexnow/route.ts` + script de ping post-build.
11. JSON-LD globaux : `Organization` + `WebSite` + `BreadcrumbList` automatiques.
12. OG image fallback pour pages sans OG dédiée.
13. **RSS feeds** : HEAD livré sous `feed.xml` (convention Next.js 16 route handler) — `/blog/feed.xml`, `/cas-concrets/feed.xml`, `/faq/feed.xml`. Pas de `/rss.xml` séparé. Le feed FAQ est découvrable via `<link rel="alternate" type="application/rss+xml">` dans `<head>` de `/faq` (pattern à propager sur `/blog` et `/cas-concrets`).
14. **JSON Feed** alternative (`/blog/feed.json`) — différé.
15. **Atom feed** alternative pour les agrégateurs old-school.

**DoD** : `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/desabonnement`, `/preferences-cookies`, `/mes-donnees` valides. RSS validés sur https://validator.w3.org/feed/. Soumettre sitemap via Google Search Console (placeholder, à faire en prod).

---

### SPRINT 14.5 — Pivot doctrinal v3 « Editorial Premium Light » (post-Sprint 14 polish)

> **Statut au 2026-05-06** : pivot livré en working copy (31 fichiers modifiés, +1548/-410). À officialiser par commit dédié + ADR 0002 + Design.md v3 racine. Cf. mémoire `axionia_design_pivot.md`.

**Skills** : `axionia-core` + `axionia-design` (à mettre à jour vers v3) + `axionia-mobile-first` + `axionia-a11y` + `axionia-performance`.

**Pré-requis** : avoir lu `axionia/docs/adr/0002-design-pivot-editorial-v3.md` + `axionia/Design.md` v3 (canon).

**Étapes**

1. Réécrire `src/app/globals.css` complet :
   - Surfaces : `--color-bg: #faf8f3`, `--color-paper: #ffffff`, `--color-sand: #f0e9da`, `--color-sand-deep: #e6dcc4`, `--color-mocha: #2a2520`, `--color-mocha-soft: #3d362f`, `--color-mocha-fg: #f7f3ea`.
   - Foreground : `--color-fg: #1a1815`, `--color-fg-soft: #524b41`, `--color-fg-muted: #80766a`.
   - Primary densifié : `--color-primary: #1a4dd9`, `--color-primary-hover: #0f3aae`, `--color-primary-soft: #e8efff`.
   - Accent éditorial NEW : `--color-terracotta: #c24a1b`, `--color-terracotta-soft: #f5e3d8`, `--color-terracotta-deep: #8c3010`.
   - Accent doux NEW : `--color-sage: #7a8870`, `--color-sage-soft: #e6ebe2`.
   - Borders : `--color-border: #e5ddc8`, `--color-border-strong: #c8bda0`, `--color-border-on-mocha: #4a4239`.
   - Compat v1/v2 : conserver `--color-primary-300/400`, `--color-accent-purple/pink/green/orange/yellow/red`, `--color-gray-300/600/700/800` aliasés sur palette v3 (cf. ADR 0002 § Compat).
   - Type scale v3 : display 7rem lh 0.96 ls -0.04em, section 4rem lh 1.04, sub 2.25rem lh 1.20, lead 1.375rem lh 1.50, body 1rem lh 1.65 ls -0.005em, label-up 0.8125rem tracking 0.16em.
   - Radius v3 : ajout `--radius-xl: 20px` et `--radius-2xl: 28px`. md:6px → 8px, lg:8px → 12px.
   - Shadows ton chaud : `rgba(0,0,0,…)` → `rgba(42,37,32,…)` sur 5 couches. Ajout `--shadow-inset-soft`.
   - Halos NEW : `.bg-halo-warm` (radial-gradient terracotta 0.10 + bleu 0.06) + `.bg-halo-cool` (radial-gradient bleu 0.08 + sage 0.06).
   - Signature `em.editorial` : font-family serif Fraunces, font-style italic, color terracotta, weight 500.
   - Selection : `::selection { background: var(--color-terracotta); color: var(--color-mocha-fg); }`.
2. Charger Fraunces via `next/font/google` dans `src/app/[locale]/layout.tsx` :
   ```ts
   import { Fraunces } from "next/font/google";
   const fraunces = Fraunces({
     subsets: ["latin"],
     variable: "--font-serif",
     display: "swap",
     weight: ["400", "500", "600"],
     style: ["normal", "italic"],
   });
   ```
   Ajouter `${fraunces.variable}` à la `className` du `<html>` ou `<body>`.
3. Mettre à jour `<Hero>` (`src/components/sections/Hero.tsx`) :
   - Ajouter prop `accent="terracotta"` (default éditorial).
   - Ajouter props `titleEm` + `titleTail` (slot pour serif italique terracotta-soft).
   - Wrapper `<section>` reçoit `bg-halo-warm relative overflow-hidden`.
   - Eyebrow : remplacer `<Eyebrow>` v1 par `<p>` + dot indicator (`mr-3 h-1.5 w-1.5 rounded-full bg-{module-color}`).
   - `titleScale.home` passe à `text-display-editorial` (utility custom dans globals).
4. Mettre à jour `<Footer>` (`src/components/nav/Footer.tsx`) :
   - Wrapper en `bg-mocha text-mocha-fg`.
   - Logo serif italique terracotta sur « IA » (`font-family: var(--font-serif)` italic 500).
   - Tagline éditoriale en serif 24-30px medium tracking-tight, avec `<span class="editorial">` sur mot identitaire.
   - Dividers `border-border-on-mocha`.
   - Links `text-mocha-fg/85 hover:text-terracotta-soft transition`.
5. Mettre à jour `<Header>` (`src/components/nav/Header.tsx`) :
   - Sticky + `bg-bg/85 backdrop-blur` sur scroll.
   - Logo serif italique terracotta sur « IA ».
   - CTA primaire variant `primary` (Editorial Blue) avec `cta-translate`.
6. Mettre à jour `<Button>` (`src/components/ui/button.tsx`) :
   - Ajouter variant `dark` (bg-mocha + mocha-fg + terracotta-soft border hover).
   - Variant `primary` : bg `--color-primary` (densifié `#1a4dd9`).
   - Variant `secondary` : bg `--color-paper` + border `--color-border` + sand hover.
   - Variant `ghost` : transparent + sand hover.
7. Mettre à jour `<Card>` (`src/components/ui/card.tsx`) :
   - Default radius `--radius-lg` (12px).
   - Variant `editorial` : radius `--radius-xl` (20px) + `--shadow-inset-soft`.
   - Shadow `--shadow-subtle` au repos, `--shadow-card` au hover.
8. Mettre à jour les sections (`Hero`, `CtaBlock`, `FeatureGrid`, `MetricsRow`, `ProcessSteps`, `TimelineBlock`, `TeamGrid`, `TestimonialsCarousel`, `LegalPageTemplate`, `ProductHero`, `ProductPageTemplate`, `FaqBlock`) pour consommer les nouveaux tokens (bg-halo-\*, bg-sand, bg-mocha, text-fg-soft/muted, etc.).
9. Mettre à jour les marketing primitives (`Cta`, `Stat`, `TestimonialCard`, `CaseStudyCard`, `ArticleCard`) pour cohérence v3.
10. Mettre à jour `messages/fr.json` + `messages/en.json` : ajouter clés home v3 (`heroEyebrow`, `heroTitlePart1/Em/Part2`, `trust1-4`, `module1-3Title/Description/Cta`, `metricsEyebrow`, `methodEyebrow`, `casesEyebrow`, `roiEyebrow`, `testimonialsEyebrow`, `faqTitle`, `ctaBlockEyebrow`).
11. Réécrire `src/app/[locale]/page.tsx` : home conversion-grade complète (anciennement placeholder Sprint 2). Sections : Hero halo-warm + dot indicator + titleEm serif italique → Trust bar → Modules grid 3-cols → Métriques halo-cool → Méthode 4 étapes → Cas concrets carrousel → ROI promo → Témoignages → FAQ → CtaBlock dark mocha → Footer.
12. Updater `axionia-design/SKILL.md` pour pointer vers Design.md v3 + ADR 0002.
13. Re-baseliner les tests visual regression Playwright (toutes les baselines v1 invalides).
14. Mettre à jour `_AUDIT/CHANGELOG-DESIGN-CLAUDE.md` avec entrée pivot v3 + captures avant/après.
15. Mettre à jour `axionia/SESSION_LOG.md` Sprint 14.5.
16. Mettre à jour `axionia-package/docs/_DECISIONS-FINALES.md` : remplacer entrée doctrine Webflow par pointeur ADR 0002.
17. Commit dédié : `feat(design): pivot v3 editorial premium light (mocha + terracotta + serif Fraunces) per ADR 0002`.

**DoD Sprint 14.5**

- ADR 0002 commité dans `axionia/docs/adr/`.
- `axionia/Design.md` v3 commité.
- `globals.css` v3 commité.
- Fraunces chargée via next/font/google, total fonts ≤ 100 KB woff2.
- 0 occurrence `#000000`/`#0a0a0a`/`#080808` hors `globals.css` legacy compat (grep CI passe).
- 0 `bg-white` natif sur section principale (utilisation `bg-bg`/`bg-paper`).
- `pnpm contrast:check` passe sur 12+ paires testées (tableau ADR 0002 § Conformité a11y).
- `pnpm radius:check` passe (xl/2xl autorisés sur hero blocks seulement).
- Page `/` (home) rend la version conversion-grade v3 complète FR + EN.
- Visual regression baselines re-générées et stables.
- Lighthouse mobile ≥ 95 sur la home après pivot (vérifier que le bundle Fraunces ne dégrade pas LCP).
- 71 tests verts maintenus (vs avant Sprint 14.5).
- Will valide visuellement que le rendu n'a plus rien d'un SaaS B2C grand public.

**STOP & ASK Will** avant CHECKPOINT INTERMÉDIAIRE final.

---

## CHECKPOINT INTERMÉDIAIRE — VÉRIFICATION FRONTEND COMPLET

> ⛔ **Aucune ligne de backend tant que ce checkpoint n'est pas 100 % vert.**

### Audit qualité frontend (livrable `_AUDIT/04-frontend-final-audit.md`)

1. **Inventaire 100 %** : les **64 routes templates HEAD (cf. SYNC-NOTICE-2026-05-07.md)** de `_AUDIT/02b-mapping-pages.md` sont tous livrés (170-220 routes FR + EN), aucune 404 inattendue. Script `scripts/check-route-coverage.ts` qui parse `02b-mapping-pages.md`, génère la liste attendue, fait un crawl du build et compare → 0 manquant. `linkinator` 0 broken link.
2. **Lighthouse mobile** sur 30 pages échantillon (accueil, 6 interventions, 5 audit, 10 implémentation, 5 cas, 4 transverses, 6 légales) : tous ≥ 95 sur perf/SEO/a11y/best-practices.
3. **Lighthouse desktop** sur les 10 pages critiques : ≥ 98.
4. **Core Web Vitals** : LCP ≤ 2.5s mobile (≤ 1.8s sur pages produit), INP ≤ 200ms, CLS ≤ 0.1, TTFB ≤ 600ms, FCP ≤ 1.8s. Mesures WebPageTest + RUM web-vitals beacon.
5. **axe-core/playwright** : 0 violation sur les 30 pages, level WCAG 2.2 AA.
6. **Keyboard navigation** : checklist Will test 15 pages au clavier uniquement.
7. **Screen reader** : test NVDA + VoiceOver iOS + Narrator sur Hero + Form audit + FAQ + Calendrier + Simulateur ROI.
8. **Cross-browser matrix** : suite Playwright passe sur Chromium + WebKit + Firefox + Mobile Safari iPhone 14 + Mobile Chrome Pixel 7.
9. **Visual regression** : 100 % des baselines stables (0 diff inattendu).
10. **i18n** : `pnpm i18n:check` 0 erreur (parité FR/EN). Aucune string FR/EN hardcodée hors `messages/*.json` (script de scan).
11. **anti-SPA** : grep `'use client'` → toutes occurrences avec commentaire `// use-client: <raison>`.
12. ~~**anti-formation** : 0 résultat.~~ — gate retiré ADR 0003 (2026-05-07).
13. **anti-SIREN** : 0 résultat.
14. **anti-hex** : 0 hex hardcodé hors tokens.
15. **JSON-LD** : `pnpm schemacheck` valide les 30 pages contre Schema.org Validator API.
16. **hreflang** : `pnpm seo:audit` vérifie la cohérence FR↔EN sur les 170 routes.
17. **Sitemap + robots + llms.txt + IndexNow** : valides + pingés en staging.
18. **Bundle size** : `pnpm bundle:check` → premier load JS ≤ 100 KB par page produit, ≤ 80 KB pour pages texte.
19. **Image weight** : ≤ 800 KB total par page, AVIF servi par défaut, fallback WebP, dernière fallback JPEG/PNG.
20. **Font weight** : ≤ 100 KB total, woff2 only, `font-display: swap`, preload primaire seul.
21. **CSS weight** : ≤ 50 KB par page (Tailwind purgé).
22. **Sécurité statique** : `pnpm audit` 0 high/critical, `gitleaks` 0 fuite, `semgrep` règles OWASP 0 finding bloquant.
23. **Headers** : `next.config.ts` produit CSP strict + HSTS + X-Frame + Referrer-Policy + Permissions-Policy + COOP + CORP. Test via securityheaders.com note A+ minimum.
24. **Trusted Types** activé en CSP, audit que aucune injection DOM directe ne passe.
25. **Tests** : Vitest coverage ≥ 80 %, Playwright ≥ 60 scénarios verts × 4 navigateurs = 240 runs.
26. **CI Gates A+B+C** verts depuis 7 jours minimum (stabilité).
27. **Web Vitals RUM** beacon endpoint reçoit des métriques en dev, valide la chaîne de mesure pour la prod.
28. **View Transitions API** : navigation listing → produit fait une transition douce (ou aucune transition si `prefers-reduced-motion`).
29. **Speculation Rules** : prerender hover testé, pas de surconsommation bandwidth.
30. **PPR (Partial Prerendering)** : pages produit ont un static shell + Suspense boundaries vérifiés via `next build --profile`.
31. **AEO citability** : tester manuellement 5 pages dans Perplexity / ChatGPT / Claude pour voir si les blocs réponse directe sont cités correctement.
32. **Accessibilité réelle** : 1 ou 2 utilisateurs équipés (lecteur d'écran, mobilité réduite) testent 5 pages — feedback consigné.
33. **Conformité doctrine v3 Editorial Premium Light** (ADR 0002, supersedes 0001) — source : `axionia/Design.md` v3 :
    - **Editorial Blue `#1a4dd9`** (token `--color-primary`) est l'unique couleur de CTA primaire sur les 30 pages échantillon (grep + visuel + Playwright sur button bg-color).
    - **Terracotta `#c24a1b`** (`--color-terracotta`) est l'unique accent éditorial : signature `em.editorial`, dot indicator hero, divider footer. Jamais sur CTA primaire.
    - **Mocha `#2a2520`** (`--color-mocha`) sur sections premium (Footer, CTA dark). **Zéro noir pur** détecté : grep `#000000`/`#0a0a0a`/`#080808` retourne 0 hors `globals.css` legacy compat.
    - **Surfaces** : ivoire chaud `#faf8f3` (`--color-bg`) en canvas, blanc pur `#ffffff` (`--color-paper`) sur cards de contraste seulement, sand `#f0e9da` / `#e6dcc4` en alternance. Tout `bg-white` natif sur section principale = **finding**.
    - **Sage `#7a8870`** (`--color-sage`) sur Module Cas concrets (substitut éditorial du `#00d722` v1).
    - Module-color mapping conservé : Module 1 = primary, Module 2 = orange `#ff6b00`, Module 3 = purple `#7a3dff`, Cas concrets = sage. Aucune section ne combine 3+ couleurs (linter custom passe).
    - Radius v3 : `xs:2 / sm:4 / md:8 / lg:12 / xl:20 / 2xl:28 / full:9999`. `border-radius > 12px` autorisé **uniquement** sur hero blocks et cards éditoriales premium (xl/2xl). `pnpm radius:check` passe.
    - Shadows ton chaud `rgba(42,37,32,…)` cascade 5 couches sur cards/popovers/modales. Tout shadow ton-froid `rgba(0,0,0,…)` hardcodé hors `globals.css` legacy = **finding**.
    - Halos signature : `bg-halo-warm` sur Hero `home`/`module` par défaut, `bg-halo-cool` en alternance.
    - Animation : `translate-x-[6px]` au hover sur **tous** les CTA primaires (visuel manuel + Playwright `expect(button).toHaveCSS('transform', /matrix\(.*6,.*\)/)`).
    - **3 polices uniquement** : Manrope (`--font-sans`) + Fraunces (`--font-serif`, NEW pour h1/hero/`em.editorial`) + Inconsolata (`--font-mono`). Aucune autre police (Inter/Geist/Newsreader/Helvetica/Source Serif/etc.) dans le bundle.
    - Type scale v3 : `--text-display: 7rem` (112px lh 0.96), `--text-label-up: 0.8125rem` tracking **0.16em**.
    - Eyebrow signature : pas de fond coloré, **dot indicator** 6×6px en couleur module devant le texte. Eyebrow style v1 (`bg-primary/10`) résiduel = **finding**.
    - Signature `em.editorial` rendue serif italique terracotta — vérifier ≥1 occurrence par page produit/home/cas.
    - `::selection` rendue terracotta + mocha-fg.
    - `:focus-visible` outline 2px primary sur fond clair, **terracotta sur fond mocha**.
    - Breakpoints respectés : 479/768/992/1280, max-w 1280 sur tous les containers.
34. **Validation positionnement** (ADR 0002 § Conséquences positives) : Will confirme visuellement que la doctrine v3 porte bien le positionnement « cabinet IA premium B2B ». Le pivot ADR 0002 visait précisément à résoudre la tension surveillée par ADR 0001 — vérifier que le rendu n'a plus rien d'un SaaS B2C grand public. Si doute, alerter immédiatement.

**STOP & ASK Will** : valider l'audit complet avant Partie II. Livrable `_AUDIT/04-frontend-final-audit.md` avec captures + traces + scripts pour rejouer.

---

## PARTIE II — BACKEND DE BOUT EN BOUT

### SPRINT 15 — Prisma schema + migrations + seeders

**Skills** : `axionia-database` + `axionia-content-models` (canon pour modèles de contenu multilingues) + `axionia-stack`.

**Pas de Stripe** : aucune table `subscriptions` / `customers` / `invoices`. Cf. `axionia-package/docs/_NO-STRIPE.md`. Status booking : `DEMANDE_RECUE → DEVIS_ENVOYE → EN_ATTENTE_VIREMENT → PAYE → LIVRE → ANNULE`.

**Étapes**

1. `prisma/schema.prisma` exhaustif (cf. doc 09 + 09b + 09c) :
   - `User` (admin) — email unique, password hash argon2, totp_secret, role.
   - `Submission` (audit/implémentation/contact) — type enum, JSON form_data, status enum, locale, ip, user_agent.
   - `Booking` — calendar_option_id, customer fields, status, payment status (off pour MVP).
   - `Article` — slug_fr/slug_en, title_fr/title_en, body_fr/body_en (MDX ou Tiptap JSON), category, tags, published_at, author_id, og_image.
   - `Faq` — question_fr/\_en, answer_fr/\_en, category, order.
   - `Testimonial` — author, role, company, content_fr/\_en, rating, photo, published.
   - `CaseStudy` — slug + champs FR/EN + metrics JSON.
   - `HelpArticle` — slug + FR/EN + section.
   - `CalendarOption` — date, time, capacity, type.
   - `EmailLog` — to, from, subject, status, message_id, opened_at, clicked_at.
   - `AuditLog` — admin_user_id, action, target_id, diff JSON, ip, ts.
2. Choix FR/EN : suffixes `_fr`/`_en` (plus simple à indexer pour FTS) — décision à figer dans `axionia-database`.
3. FTS Postgres : champs `search_vector_fr` + `search_vector_en` GIN-indexés, MAJ via trigger SQL.
4. Migration initiale `pnpm prisma migrate dev --name init`.
5. Seeders `prisma/seed.ts` :
   - 1 admin Will + 1 admin secondaire.
   - 8 articles fixtures FR + EN.
   - 8 cas concrets fixtures.
   - 30 FAQ fixtures.
   - 12 testimonials fixtures.
   - 50 help articles fixtures.
   - 60 calendar_options sur 30 jours.
6. Scripts backup : `scripts/db-backup.sh` (pg_dump → Storage Box S3) + cron crontab.
7. Restore : `scripts/db-restore.sh`.

**DoD** : `pnpm prisma migrate reset && pnpm db:seed` rejoue tout. 0 warning Prisma. FTS testé via SQL direct.

---

### SPRINT 16 — Auth.js v5 + 2FA TOTP + sécurité headers

**Skills** : `axionia-stack` + `owasp-security` + `axionia-deployment`.

**Étapes**

1. Auth.js v5 avec Prisma adapter + Credentials provider (admin uniquement).
2. Login flow : email + password (argon2id, paramètres OWASP) + TOTP (otplib).
3. Session : strategy `database`, max 8h, sliding refresh.
4. Middleware d'admin : `/{ADMIN_URL_PREFIX}/*` requiert session admin valide + 2FA validée.
5. Rate limit Redis sur `/login`, `/2fa/verify` : 5/min/IP, 20/min/email.
6. CSRF natif Auth.js + Turnstile sur form login.
7. Audit log : chaque login / logout / action sensible loggée dans `AuditLog`.
8. Headers `next.config.js` :
   - `Content-Security-Policy` strict (nonce sur scripts inline si besoin, default-src 'self').
   - `Strict-Transport-Security` 1 an + preload.
   - `X-Frame-Options DENY`.
   - `Referrer-Policy strict-origin-when-cross-origin`.
   - `Permissions-Policy` restrictive (camera, mic, geolocation = none).
9. CORS : aucun (le site n'expose pas d'API publique cross-origin).
10. OWASP Top 10 + ASVS 5.0 — passe complète documentée dans `_AUDIT/06-owasp-pass.md`.

**DoD** : Login admin fonctionnel avec 2FA. Tentative login sans 2FA refusée. Rate limit testé. Headers vérifiés sur securityheaders.com (note A+).

---

### SPRINT 17 — Server actions + Zod + Prisma

**Skills** : `axionia-forms` + `axionia-anti-spa` + `axionia-database`.

**Étapes**

1. `src/server/actions/audit.ts` `submitAuditRequest()` : valide Zod, persiste `Submission`, enqueue email + Telegram, retourne `{ ok, redirectTo }`.
2. Idem pour : `submitImplementation`, `submitContact`, `submitNewsletter`, `submitBooking`.
3. Pattern de retour typé `Result<T, FormError>` partagé.
4. Erreurs Zod côté server traduites via next-intl pour réponse FR/EN.
5. Idempotence via `idempotency_key` (header ou champ caché).
6. Sentry capture sur erreurs serveur.
7. Tests Vitest : appel direct des actions avec inputs valides + invalides + edge cases.

**DoD** : 5 server actions complètes. Tests verts. Soumission audit stockée en DB visible via `pnpm prisma studio`.

---

### SPRINT 18 — BullMQ + queue jobs + Telegram

**Skills** : `axionia-stack` + `axionia-deployment`.

**Étapes**

1. `src/server/queue/index.ts` : connexion ioredis + queues `email`, `telegram`, `indexnow`, `db-cleanup`.
2. Workers : `src/server/queue/workers/email.ts` (consume → call mailer), `telegram.ts`, etc.
3. Lancement worker : process séparé `pnpm worker` (Coolify déploiera 2 services : web + worker).
4. Telegram tag-based (cf. axionia-forms) : routes vers chats différents selon type submission.
5. Retry stratégie : 5 essais exponentiels.
6. Dashboard local : `bull-board` monté sur `/{ADMIN_URL_PREFIX}/queue` (admin only).

**DoD** : soumettre audit en dev → message Telegram reçu en moins de 10s.

---

### SPRINT 19 — Email maison (PowerMTA + React Email + Nodemailer)

**Skills** : `axionia-emails` + `axionia-deployment`.

**Étapes**

1. Templates `emails/` (React Email) :
   - `audit-confirmation.tsx` (FR + EN — composant `<Email locale="fr|en">`).
   - `implementation-confirmation.tsx`.
   - `contact-confirmation.tsx`.
   - `booking-confirmation.tsx`.
   - `newsletter-double-opt-in.tsx`.
   - `internal-notification.tsx` (vers Will).
   - `password-reset.tsx`.
2. Mailer : `src/server/mail/transport.ts` Nodemailer pointant sur PowerMTA local (port interne, pas exposé internet).
3. Send via queue `email` (sprint 18).
4. EmailLog en DB.
5. Webhooks bounce/complaint depuis PowerMTA → marquer `users.email_status` ou `EmailLog.status`.
6. DKIM 2048 + SPF strict + DMARC `p=quarantine` au démarrage.
7. Job warmup IP (envoi progressif sur 30 jours, courbe documentée).
8. Mailpit en dev pour inbox locale.

**DoD** : envoyer email audit en dev → reçu sur Mailpit. En staging : envoyer 5 emails à Mail-tester.com → score ≥ 9/10.

---

### SPRINT 20 — Console admin (14 sections — doc 08)

**Skills** : `axionia-admin-ux` (canon, déjà existant) + `axionia-content-models` + `axionia-stack` + `axionia-design`.

**Sections** :

1. Dashboard (KPIs : soumissions/jour, bookings, articles).
2. Soumissions (liste + détail + statut + export CSV).
3. Réservations.
4. Articles (Tiptap editor + preview + planification + multilingue).
5. FAQs.
6. Témoignages.
7. Cas concrets.
8. Help center.
9. Calendrier (gérer slots, capacités, blackout dates).
10. Utilisateurs admin (CRUD + reset 2FA).
11. Logs (Sentry events embed).
12. Email campaigns (iframe MailWizz ou lien).
13. Paramètres (env-overrides safe).
14. Audit log.

**Patterns** :

- Layout admin séparé (`src/app/{ADMIN_URL_PREFIX}/layout.tsx`).
- Sidebar nav + topbar.
- Auth obligatoire + 2FA validée.
- Toutes les mutations passent par server actions.
- Confirmations destructives (Dialog).
- Recherche FTS connectée.

**DoD** : 14 sections live. Test Playwright admin : login → 2FA → article créé → publié → visible sur `/blog`.

---

### SPRINT 21 — Tests E2E exhaustifs + Lighthouse CI + sécurité finale

**Skills** : `axionia-testing` (canon, déjà existant) + `axionia-performance` + `verification-before-completion` + `owasp-security`.

**Étapes**

1. Suite Playwright complète :
   - 30 tests publics (par module + transverses + légales).
   - 15 tests forms (golden + erreurs).
   - 10 tests admin (login, CRUD, 2FA).
   - 5 tests i18n (switcher, hreflang, redirections).
2. Lighthouse CI dans GitHub Actions : assert ≥ 95 sur 20 URLs.
3. Pa11y CI ou axe-core CLI sur les mêmes 20 URLs.
4. OWASP ZAP baseline scan en CI nightly contre staging.
5. Coverage Vitest ≥ 75 %.
6. Bundle analyzer : alerte si page > 100 KB JS.

**DoD** : CI verte sur main, badge dans README.

---

### SPRINT 22 — Déploiement Hetzner + Coolify + Cloudflare

**Skills** : `axionia-deployment` + `axionia-stack`.

**Étapes**

1. Provisionner VPS Hetzner CX32 Frankfurt + Storage Box BX11 + IP dédiée mail.
2. Installer Coolify self-hosted.
3. Docker Compose : `web`, `worker`, `postgres`, `redis`, `mailpit-staging` (pas en prod), `powermta`, `mailwizz`.
4. Déclarer apps dans Coolify : `axionia-web` + `axionia-worker` + `axionia-mailwizz`.
5. Cloudflare : zone axion-ia.com, proxy on, WAF rules, cache rules (SSG 1 an, dynamic by-pass), Turnstile.
6. SSL : Caddy ou Traefik auto-renouvel.
7. DNS mail : MX vers `mail.axion-ia.com`, SPF, DKIM, DMARC, BIMI.
8. Backups Postgres horaire → Storage Box.
9. CI/CD : GitHub Actions push main → webhook Coolify → deploy + run migrations.
10. Smoke tests post-deploy : ping `/healthz`, ping admin login, ping email send.

**DoD** : `https://staging.axion-ia.com` live + `https://axion-ia.com` live. Score securityheaders.com A+. Mail-tester ≥ 9/10.

---

### SPRINT 23 — Monitoring & observability + runbook

**Skills** : `axionia-monitoring` (canon, déjà existant — couvre Sentry, Plausible, Uptime Kuma, Pino, Telegram alerts, sauvegardes) + `axionia-deployment`.

**Étapes**

1. Plausible self-hosted sur sous-domaine `analytics.axion-ia.com`.
2. Sentry self-hosted sur `sentry.axion-ia.com` + intégration Next.js (sourcemaps upload via Husky pre-push).
3. Uptime Kuma sur `status.axion-ia.com` + 10 checks (web FR, web EN, admin, sitemap, llms.txt, smtp, postgres, redis, calendrier, blog rss).
4. Pino logs → journald → loki (optionnel).
5. Telegram bot alerts : downtime, erreurs Sentry critiques, queues backlog > seuil.
6. Runbook `_AUDIT/07-runbook.md` : rollback, restore backup, rotation DKIM, gérer une fuite, incident emails.
7. Disaster recovery test : simuler perte VPS, restaurer en < 2h.

**DoD** : 4 services monitoring live. Test alerte volontaire reçue sur Telegram.

---

## RÈGLES TRANSVERSES (rappel — non négociables)

- ❌ Mot « formation » / « formateur » / « former » bannis (skill `axionia-core`).
- ✅ Mobile-first absolu.
- ✅ Société estonienne OÜ (jamais SIREN/SIRET/RCS).
- ✅ FR rédigé en premier, EN s'adapte. next-intl partout.
- ✅ Server Components par défaut. `'use client'` justifié.
- ✅ `generateMetadata` partout. JSON-LD adapté. hreflang systématique.
- ✅ Lighthouse mobile ≥ 95 par page produit.
- ✅ A11y WCAG 2.2 AA strict. Touch targets 44×44.
- ✅ Charte couleurs reportée → tokens neutres provisoires.
- ✅ Stack verrouillée. Aucune dépendance hors doc 25.
- ✅ Conventional Commits. Aucun `--no-verify`.

---

## SORTIES OBLIGATOIRES

| Sprint         | Livrable principal                                |
| -------------- | ------------------------------------------------- |
| 0              | Repo Next.js setup                                |
| 1              | Tokens Tailwind Webflow (Design.md déjà existant) |
| 2              | Layout + nav parfaite + i18n                      |
| 3-4            | Lib UI complète                                   |
| 5-7            | 21 pages modules                                  |
| 8-10           | Cas + transverses + légales                       |
| 11-13          | Calendrier + simulateur + 5 forms                 |
| 14             | Pages système + SEO finalisé                      |
| **CHECKPOINT** | `_AUDIT/04-frontend-final-audit.md`               |
| 15-19          | Backend complet (DB, auth, actions, queue, email) |
| 20             | Console admin 14 sections                         |
| 21             | Tests E2E + Lighthouse CI + OWASP                 |
| 22-23          | Déploiement + monitoring                          |

---

## VÉRIFICATIONS CONTINUES BACKEND (entre chaque sprint 15 → 23)

Comme pour le frontend, mid-sprint checkpoints obligatoires :

### Entre sprint 15 et 16 (DB → Auth)

- Migration `up` puis `down` puis `up` round-trip réussit.
- `pnpm db:seed` déterministe (mêmes IDs à chaque run sur DB fresh).
- FTS benchmark : recherche article < 50ms sur 1000 articles seedés en stress.
- `EXPLAIN ANALYZE` sur les 5 requêtes critiques, indexes vérifiés.

### Entre sprint 16 et 17 (Auth → Server actions)

- Tentative login sans 2FA refusée (test Playwright).
- Brute force 6 tentatives → ban temporaire (test Playwright).
- Headers `next.config.ts` testés via securityheaders.com note A+ confirmée.
- WebAuthn passkey créé + utilisé (test Playwright avec virtual authenticator).

### Entre sprint 17 et 18 (Actions → Queue)

- 5 server actions testées Vitest avec inputs valides + invalides + edge.
- Idempotency keys testées (double submit ne crée pas 2 records).
- Sentry capture une erreur volontaire de chaque action.

### Entre sprint 18 et 19 (Queue → Email)

- Soumission audit dev → message Telegram reçu < 10s.
- Retry exponentiel testé (mock fail 2 fois puis succès).
- bull-board accessible et masqué hors admin.

### Entre sprint 19 et 20 (Email → Admin)

- Mail-tester score ≥ 9/10 sur les 7 templates (FR + EN = 14 envois).
- DKIM/SPF/DMARC verts sur mxtoolbox.
- Inbox placement testé via GlockApps si compte dispo, sinon test manuel Gmail/Outlook/Yahoo.
- One-Click Unsubscribe RFC 8058 fonctionnel.

### Entre sprint 20 et 21 (Admin → Tests E2E)

- 14 sections admin testées Playwright admin.
- Audit log enregistre toutes les actions sensibles.
- 2FA reset par admin senior testé.

### Entre sprint 21 et 22 (Tests → Déploiement)

- CI tous gates verts sur main depuis 7 jours.
- Lighthouse historique stable (pas de régression > 2 points sur 7 jours).
- OWASP ZAP nightly 0 high/critical.

### Entre sprint 22 et 23 (Déploiement → Monitoring)

- Smoke prod 5 scénarios verts.
- Backup restore test sandbox réussi.
- DNS mail (MX, SPF, DKIM, DMARC, BIMI optionnel) verts.
- Cloudflare WAF rules actifs, Turnstile testé.

### Post-sprint 23 (livraison finale)

- Disaster recovery drill : couper le VPS → restaurer ailleurs en < 2h.
- Charge testing : k6 ou autocannon, 100 RPS sur la home, p95 < 500ms.
- Sécurité review externe (pentester sur 1 jour si budget) ou auto-pentest avec OWASP ZAP + Burp Community.
- AEO baseline : interroger Perplexity, ChatGPT, Claude, Google AI Overview sur 10 questions cibles → noter quels résultats Axion-IA est cité.

---

## ARTEFACTS FINAUX (livrés à Will à la fin)

| Artefact                            | Description                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| `_AUDIT/04-frontend-final-audit.md` | Audit frontend complet (32 critères).                                                       |
| `_AUDIT/05-backend-final-audit.md`  | Audit backend complet (DB, auth, actions, queue, email, admin).                             |
| `_AUDIT/06-owasp-pass.md`           | Passe OWASP ASVS 5.0 + NIST SP 800-63-4.                                                    |
| `_AUDIT/07-runbook.md`              | Rollback, restore, rotation DKIM, incidents emails.                                         |
| `_AUDIT/08-disaster-recovery.md`    | Drill DR documenté avec captures.                                                           |
| `_AUDIT/09-aeo-baseline.md`         | Citations Axion-IA sur Perplexity/ChatGPT/Claude/AIO.                                       |
| `docs/adr/*.md`                     | Architecture Decision Records.                                                              |
| `CHANGELOG.md`                      | Historique versions.                                                                        |
| `SESSION_LOG.md`                    | Log session par session.                                                                    |
| README.md                           | Setup + commands + arborescence.                                                            |
| Repo GitHub                         | Branch protection main + staging + tags + releases.                                         |
| Site live                           | https://axion-ia.com + https://staging.axion-ia.com.                                        |
| Monitoring                          | https://status.axion-ia.com + https://analytics.axion-ia.com + https://sentry.axion-ia.com. |

---

## DÉMARRAGE

Confirme en 5 lignes que tu as lu ce prompt. Crée la TaskList globale (un sprint = une tâche). Vérifie que `PROMPT-MAITRE.md` phases 0/1/1.S/2 sont validées (sinon STOP & retourne au prompt maître). Puis attaque le **SPRINT 0** en configurant **tous** les Gates CI A+B+C+D+E dès le début (cf. section VÉRIFICATIONS CONTINUES).

> **Cadence de validation par Will** : à chaque MID-SPRINT CHECKPOINT, Will reçoit un rapport ≤ 200 mots + une démo live + une question fermée « OUI / CONTINUE / STOP ». Tu n'avances pas tant que la réponse n'est pas reçue.

---

## ANNEXE — Sprints 14.5 → 14.9 livrés (ratifiés post-publication v3.0)

> Ajoutée 2026-05-07 par DOC-SYNC V14 (cf. `_AUDIT/sync-snapshot.md`). Ces sprints intermédiaires ont été livrés entre la fin du Sprint 14 et le démarrage du Sprint 15. Ils ne figurent pas dans la numérotation initiale du prompt mais ont été intégralement implémentés et pushés sur `origin/main`.

### Sprint 14.5 — Pivot doctrine v3 « Editorial Premium Light »

- **Statut** : ✅ commité 2026-05-06/07, dispersé `5942d2f` → `941a8e1` (22 commits pushed).
- **ADR** : `axionia/docs/adr/0002-design-pivot-editorial-v3.md` (supersedes 0001).
- **Livré** : palette ivoire chaud + sand + mocha + terracotta + sage, Fraunces serif italique signature `em.editorial`, halos `.bg-halo-warm` + `.bg-halo-cool` + `.bg-mocha-rich`, refonte Hero/Footer/Header (couleur figée terracotta), 256 occurrences `Axion-IA` canoniques.
- **Dette traçabilité** : pivot non atomisé en commit dédié `feat(design): pivot v3` (A-P1-2).

### Sprint 14.6 — Espace presse `/presse` + content/press.ts

- **Statut** : ✅ commit `38879bc`.
- **Livré** : page `/presse` (FR) `/press` (EN) GEO E-E-A-T, content fixtures Sprint 14.6 (3 releases + 7 facts + 6 kit assets + 1 spokesperson + 6 FAQ + boilerplate). JSON-LD `WebPage` + `Person` (knowsAbout/sameAs) + `FAQPage` + `BreadcrumbList` + `ItemList(NewsArticle)` + `Speakable` (#press-pitch + #press-boilerplate). États « vide médias » transparents anti-fabrication.

### Sprint 14.7 — Visual rhythm A+B (placeholder infra + 6 hero schemas + 17 pages)

- **Statut** : ✅ commit `dbc39b3`.
- **Livré** : composants `Illustration` + `Placeholder` réutilisables, `DetailHeroSchema` + 3 `HeroSchema` dédiés (Methodology, Comparisons, Help), 14 pages + 3 sous-pages produit patchées avec rythme visuel cohérent. TypeScript + anti-hex clean.
- **ADR** : `axionia/docs/adr/0004-typography-baseline-upgrade-v3-1.md` (body 16 → **18 px**, `text-sm` 14 → **15 px**, line-height **1.7**, override Tailwind v4 defaults).

### Sprint 14.8 — AEO/GEO 2026 perfection (sitemap-index + 5 nouvelles factories + obsolescences purgées)

- **Statut** : ✅ commits `eda574b`, `5d9d527`, `c884acc`, `fd91518` (step A 76% → 95%).
- **Livré** :
  - **Sitemap-index Next 16** via `generateSitemaps()` + 6 sous-sitemaps (`pages`, `blog`, `help`, `cas-concrets`, `comparaisons`, `implementation`) avec `alternates.languages` + `lastModified` sur `BlogPosting.updatedAt`.
  - **5 nouvelles factories JSON-LD** dans `src/lib/seo.ts` : `Person` (Will sur `/a-propos`), `FaqSpeakable` (#press-pitch), `LocalBusiness` (cabinet UE distant minimal), `Place` (réservé pSEO villes), `ItemList` (tous listings + hubs).
  - Dedupe homepage `Organization` + rename `ease-out-webflow` → `--ease-out-editorial`.
  - Obsolescences purgées : tarifs audit anciens, OG image v3, Webflow → editorial.

### Sprint 14.9 — Audit Header & Navigation 2026 (8 STOP & ASK validés)

- **Statut** : ✅ audit livré, ADRs proposés.
- **ADRs proposés** (status `proposed` à commiter Sprint 15) :
  - `axionia/docs/adr/0005-navigation-mega-menu.md` (depuis `_AUDIT/adr-0003-navigation-mega-menu-PROPOSITION.md`)
  - `axionia/docs/adr/0006-pseo-villes.md` (depuis `_AUDIT/adr-0004-pseo-villes-PROPOSITION.md`)
- **Validations Will 2026-05-07** : Q1 conserver 11 outils `/stack-ia`, Q2 URL hiérarchique `/implantations/[region]/[ville]`, Q3 métropole + 5 DROM exclure COM, Q4 Voie 2 mega-menus avec garde-fous, Q5 pipeline 80/20 LLM/Will, Q6 phase 1 = top 50 villes, Q7 split sitemap, Q8 ⌘K reportable Sprint 16+.
- **Volume INSEE villes >5000 hab** corrigé à ~2150 (vs 3500 estimé). V1 recommandée 1160 villes >10000 hab + 5 DROM.

### Sprint correctifs (livrés simultanément)

- **Refonte `/interventions`** + ADR 0003 lift formation ban (script anti-formation supprimé, sorti de Gate A).
- **Page `/reserver` v2** : calendrier rounded-3xl, sélecteur intervention IN-calendar, anti-chevauchement 2j, social proof Sophie L. flottant, popup multi-step XXL, bug `LocaleSwitcher` corrigé (Client + `usePathname()` + `useParams()` pour préserver pathname au toggle FR↔EN).
- **3 tiers Essentielle** (`?tier=intimiste|standard|complete`) : 1 produit visible, 3 tarifs distincts, 3 lignes admin.
- **Pages erreur refondues v3** (locale + root + global-error + maintenance).
- **156 tests verts** maintenus, `pnpm verify:all` ✅ (typecheck + lint 0 errors + i18n parité + 5 anti-banni gates verts + 80/80 tests).
