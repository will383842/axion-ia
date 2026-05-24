# Pr-10 — Best Practices 2026

**HEAD** : 81f6ea0e
**Score** : 22 / 25

## Évidence

### Next.js 16 RSC default

- `AGENTS.md` "This is NOT the Next.js you know" — version 16.2.6 (confirmed `node_modules/next@16.2.6`).
- RSC default Next 16 (Server Components par défaut).
- Hooks `use()` + `useFormStatus` React 19 disponibles (React 19.2.4 confirmed `node_modules/react@19.2.4`).
- Server Actions partout (498 occurrences Zod schemas dans `src/features/admin-*/actions.ts` + `src/server/actions/**`).
- `serverActions.allowedOrigins: ["axion-ia.com", "www.axion-ia.com"]` (`next.config.ts:170-172`) — guard cross-origin (Sprint X.2 Agent 8 P0-4).
- Suspense streaming (config Next 16 default).
- Edge middleware `src/proxy.ts` Edge runtime (CSP nonce + i18n + auth).
- PPR `experimental.ppr` désactivé documenté (`next.config.ts:131-133`, decision Sprint 17 deferred).

### TypeScript strict

- `tsconfig.json` strict (`exactOptionalPropertyTypes: true` confirmé via playwright.config.ts:33 commentaire).
- Gate A CI `pnpm typecheck` strict — bloquant.
- Pre-commit + pre-push runs typecheck (`.husky/pre-commit` ligne 5 + `.husky/pre-push` ligne 1).

### Prisma 5+ / BullMQ 4+

- Prisma generated client séparé `prisma/generated/client` (cf. `src/auth.ts:21`) — pattern Prisma 5+.
- BullMQ workers dans `src/server/queue/workers/` — 27 workers détectés (booking-crons, content-fact-check, content-gen, content-google-indexing, content-indexnow, content-keyword-sync, content-monitoring, content-news-lifecycle, content-orchestrator, content-psi-monitor, content-publish, content-qa-extract, content-quality-improver, content-rss-fetch, content-similarity-monitor, content-tier-lifecycle, content-web-vitals-monitor, content-weekly-report, email, embeddings-backfill, external-links-monitor, image-bank-auto-convert, image-bank-crons, image-bank-enrich, image-bank-import, image-bank-translate, brand-voice-drift-monitor, content-gen-deadline-checker, content-gen-scheduler).
- `BULLMQ_DISABLED=true` build-arg pattern (AGENTS.md) — Redis stub-aware singleton.

### Tailwind v4 / Design tokens

- `tailwindcss@4.3.0` confirmed (`node_modules/.pnpm/tailwindcss@4.3.0`).
- Design tokens centralisés mémoire 2026-05-17 admin refonte + corpus 2026-05-22 sprint UX.
- Couleurs canoniques terracotta principale + bleu pointes (mémoire `axionia_couleurs`).

### AI Overviews / SGE readiness

- AiContentDisclaimer + `aiGenerated:true` JSON-LD (Pr-03).
- KB facts coverage (Sprint Perfection 2026-05-22 — 340 facts cumulés mémoire).
- Speakable / structured data factories (`seo-content-gen-factories.ts`).
- Sub-sitemaps découpés (mémoire 2026-05-22 V-11) facilitent crawl AI bots.

### Voice search / Featured snippets / AI Overviews intents

- Mémoire 2026-05-22 sprint keywords : 5 verticales ≥250 + 4 intents 2026 (voice_search / ai_overview / featured_snippet / commercial_investigation).
- 1641 seeds keywords (mémoire `axionia_sprint_keywords_perfection_livre_2026-05-22`).

### Cookieless future

- Plausible (privacy-first, no cookies) + Microsoft Clarity gated consent CMP (CSP `src/lib/csp.ts:76-82`).
- IP hashing SHA-256 + RGPD self-service.

### WCAG 2.2 AA

- `tests/e2e/a11y.spec.ts` ✅ E2E accessibility.
- `lighthouserc.json:33` `categories:accessibility ≥ 0.9 warn` + assertions `target-size` `color-contrast` `label-content-name-mismatch` (warn).
- `/accessibilite` page présente.
- Score reco audit `_AUDIT/PERFECTION-2026-2026-05-22/B4-ACCESSIBILITE-WCAG.md`.

### INP gate

- LHCI INP `"off"` (lab non interactif) — mesuré field RUM `/api/vitals` + AGENTS.md budget interne ≤ 100ms p75.

### AVIF + WebP + LQIP

- `next.config.ts:116` formats AVIF+WebP.
- Image bank pipeline mémoire 2026-05-20 : Sharp variants WebP+AVIF+LQIP+thumbnail (skill axionia-image-bank).
- Sub-sitemap images dédié `sitemap-images-services.xml/route.ts`.

### Mobile-first

- 5 Playwright projects incluent mobile-chrome (Pixel 7) + mobile-safari (iPhone 14 Pro).
- LHCI 2 presets : `desktop` + `mobile` (`lighthouserc.json:27`).

### React Compiler

- Désactivé documenté (`next.config.ts:174-178`) — deferred Sprint 17 après RUM baseline. Pas un fail 2026 (le compiler reste experimental encore).

### Architecture cloisonnée

- `pnpm content-gen:isolation-check` Gate A (`ci.yml:80-81`) — zones whitelisted strict (src/server/content-gen/**, src/app/[locale]/(admin)/[adminPrefix]/content-gen/**, src/components/admin/content-gen/\*\*).
- `pnpm use-client:check` justifie chaque `"use client"` directive (mémoire 2026-05-22 V-04 use-client justification speculation rules).
- 9 packages `serverExternalPackages` strict (`next.config.ts:97-114`).

## Findings P0 / P1 / P2

- **P0** : aucun.
- **P1 (PPR opportunity)** : Next 16 PPR + Suspense boundaries per-route gagnerait sur pages dynamiques DB-bound. Décision documentée Sprint 17 (`next.config.ts:131-133`). Non-bloquant, opportunité connue.
- **P1 (React Compiler)** : idem, deferred Sprint 17 (ligne 174-178).
- **P2 (Tailwind v4 → v5 lookahead)** : Tailwind 4.3.0 = LTS actuel, v5 stable courant 2026-Q3+ — pas d'action nécessaire.
- **P2 (cookieless analytics maturity)** : Plausible self-hosted (`plausible.axion-ia.com` whitelist CSP) + Clarity post-consent — bonne pratique 2026 mais Clarity reste US-based (Microsoft) — pas un fail RGPD strict (consent gating), polish DPA Microsoft à vérifier.
- **P2 (AI bots crawlers explicit)** : confirmé robots.txt + sitemap-images.xml dédié — cf. mémoires.

## Verdict (paragraphe)

Stack 2026-natif exemplaire : Next 16.2.6 RSC default + React 19.2.4 (use/useFormStatus) + Server Actions partout (498 Zod schemas) + serverActions.allowedOrigins cross-origin guard + Edge middleware Suspense streaming + Prisma 5+ generated separate + BullMQ 27 workers cloisonnés + Tailwind 4.3.0 + TypeScript strict (exactOptionalPropertyTypes) + isolation checks CI (content-gen, use-client justification, anti-hex, anti-siren). Forward-looking 2026 : AI Act art.50 disclaimer + JSON-LD aiGenerated, AI Overviews/SGE intents (voice/ai_overview/featured_snippet/commercial_investigation) avec 1641 keyword seeds, AVIF+WebP+LQIP image pipeline, mobile-first 5 devices Playwright, INP field RUM, cookieless cookie-gated CMP, WCAG 2.2 AA a11y E2E. PPR et React Compiler désactivés (decisions Sprint 17 documentées). Score 22/25 — production-ready 2026, modèle de référence Next 16 + AI Act.
