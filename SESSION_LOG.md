# SESSION_LOG — AxionIA

> Append-only journal of work sessions on the Next.js codebase.
> One entry per significant session. Most recent on top.

---

## 2026-05-06 — Sprint 0 (M1) · Setup repo & toolchain

**Auteur** : Will + Claude Opus 4.7
**Référence** : `_AUDIT/02-PLAN.md` jalon M1 · ADR `docs/adr/0001-stack-initial.md`

### Décisions structurantes

- **Passe v10.2 close** sans patch des .docx (cf. `_AUDIT/CHANGELOG-v10.2.md`). CLAUDE.md v6 + skills `axionia-*` + 22 LOCKs + wireframes propres résolvent les 16 contradictions à la source. .docx = archives.
- **Aucun skill archivé** (Q2=c) — les 9 skills hors-scope restent actifs.
- **Sous-repo Git axionia/** — repo parent `Axion-IA/` est l'umbrella docs/audits, `axionia/` est l'app Next.js avec son propre `.git`.
- **Next.js 16.2.4** au lieu de 15 — scaffold latest stable. ADR 0001 documente l'écart.
- **Auth.js v5 beta** (`5.0.0-beta.31`) — la v5 stable n'est pas encore sortie.
- **Pas de Stripe** confirmé.

### Livré ce Sprint

- Repo Next.js 16 + TS strict (noUncheckedIndexedAccess, exactOptionalPropertyTypes, noImplicitOverride).
- 30+ deps prod, 32 deps dev, versions épinglées.
- ESLint flat + jsx-a11y + @typescript-eslint strict + Prettier + tailwind plugin.
- Husky 9 + lint-staged + commitlint Conventional Commits.
- 7 scripts custom : `check-i18n`, `check-anti-formation`, `check-anti-siren`, `check-anti-hex`, `check-use-client`, `check-zod`, `check-schema`, `seo-audit`, `vitals-report`, `adr-new`.
- Sentry server + edge + client + `instrumentation.ts` + `instrumentation-client.ts`.
- Endpoint `src/app/api/vitals/route.ts` (Edge runtime) pour beacon web-vitals.
- `src/env.ts` via `@t3-oss/env-nextjs` couvrant DB / Redis / Auth / SMTP / Hetzner Storage / Telegram / Turnstile / Sentry / Plausible / IndexNow / Company.
- 4 GitHub Actions workflows (Gates A/B/C/D/E) + Dependabot.
- `next.config.ts` avec headers de sécurité de base + `reactCompiler` activé + bundle analyzer.
- ADR 0001-stack-initial.md.
- `.gitleaks.toml` config.
- `lighthouserc.json` Lighthouse CI desktop assertions.
- `vitest.config.ts` + `vitest.integration.config.ts` + `playwright.config.ts` (5 projects : chromium/webkit/firefox + 2 mobile).

### À faire au prochain Sprint (Sprint 1 — tokens Webflow)

- Lire `node_modules/next/dist/docs/` pour valider les options expérimentales Next 16 avant Sprint 2.
- Implémenter `Design.md` Webflow-inspired dans `src/app/globals.css` (palette + typo Manrope/Inconsolata + radius + shadows + animation `translate-x-[6px]`).
- Page `/_design` (dev-only).
- Linter contrast + radius custom.
