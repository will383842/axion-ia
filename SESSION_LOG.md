# SESSION_LOG — AxionIA

> Append-only journal of work sessions on the Next.js codebase.
> One entry per significant session. Most recent on top.

---

## 2026-05-06 — Sprint 5b (correctif) · Home + Design v3 Editorial Premium

**Auteur** : Will + Claude Opus 4.7
**Référence** : ADR `docs/adr/0002-design-direction-editorial-premium.md`

### Contexte

Inspection live home post-Sprint 14 par Will → 2 verdicts :

1. **Home placeholder Sprint 2 jamais remplacée** (Sprint 5 a livré pages produits, oublié home — trou non détecté par FRONTEND-DEEP-CHECK).
2. **Doctrine "Webflow-light"** rejetée : _« vieillot, sans contraste, tout est blanc, trop carré »_. Pivot dark agressif aussi rejeté (_« haut de gamme sans noir »_). Direction validée → **Editorial Premium Light** (Anthropic / Mistral / Ramp).

### Décisions structurantes

- **ADR 0002** : Editorial Premium Light supersedes la doctrine implicite Webflow-light.
- **Aucun fond noir** : ivoire / sand / mocha (brun-aubergine) au lieu de blanc / noir.
- **Fraunces serif** chargée via `next/font` — titres + numbers + pull-quotes.
- **Italiques terracotta** sur 1-2 mots-clés par titre (signature Anthropic).
- **6 tones de Section** : canvas / paper / sand / halo-warm / halo-cool / mocha.
- **Webflow Blue préservé** comme couleur identitaire `#1a4dd9`.
- **i18n keys split** en `Part1` / `Em` / `Part2` pour rendre les italiques sans markup dans les traductions.

### Livré ce sprint correctif

**Home conversion-grade refondée** (`[locale]/page.tsx`) — 11 sections alternées :

- Hero ivoire `bg-halo-warm` avec titre Fraunces géant 112px + italique terracotta
- Trust strip sable (4 trust-points icônes circulaires)
- Modules paper avec 3 cards radius-xl (numéros 01/02/03 mono)
- Metrics mocha-rich (numbers Fraunces 96-112px)
- Méthode halo-cool (4 colonnes border-top + numéros serif terracotta)
- Cas concrets paper (3 cards titles serif + badges sand/terracotta-soft)
- ROI sand (carte centrale paper)
- Témoignages paper (4 pull-quotes serif italic + guillemets terracotta géants)
- FAQ canvas (accordion natif + FAQPage JSON-LD)
- CTA final mocha-rich avec italique terracotta
- JSON-LD Organization + WebSite + FAQPage

**Refonte tokens (`globals.css` v3)** :

- 4 surfaces sans noir : `bg`, `paper`, `sand`, `mocha`, `mocha-soft`
- 3 fonds composés : `bg-halo-warm`, `bg-halo-cool`, `bg-mocha-rich`
- Foreground : `fg`, `fg-soft`, `fg-muted` anthracites-bruns
- Accents : `terracotta`, `terracotta-soft`, `terracotta-deep`, `sage`, `sage-soft`
- Radius : `xl` 20px, `2xl` 28px
- Shadows : tons chauds rgba(42,37,32,…)
- Utilities : `text-display-editorial`, `italic-editorial`, `cta-lift`

**Layout root** : Fraunces chargée via `next/font/google` (variable + italique).

**Composants partagés refondus (15 fichiers)** :

- `<Header>` + `<NavLink>` + `<LocaleSwitcher>` + `<MobileNav>` (logo serif Axion**IA** italique, nav active italique terracotta, locale pill)
- `<Footer>` (bg-mocha-rich, tagline serif géant, columns sobres)
- `<Button>` + `<Cta>` (7 variants + terracotta, shape pill par défaut sur Cta marketing, cta-lift)
- `<Card>` (radius-xl 20, padding 28, border sand, hover terracotta)
- `<Section>` (6 tones + titleEm italic-editorial)
- `<Hero>` (bg-halo-warm + indicator dot + titleEm)
- `<ProductHero>` (21 pages produits — bg-halo-warm + halo accent latéral + h1 Fraunces)
- `<MetricsRow>` + `<Stat>` (numbers Fraunces 96-112px + suffix terracotta, auto-adapt mocha)
- `<ProcessSteps>` (numéros serif terracotta + top border, auto-adapt mocha)
- `<CtaBlock>` (tones mocha/paper/sand + alias dark/light rétrocompat)
- `<FaqBlock>` (tones canvas/paper/sand)
- `<FeatureGrid>` (icônes terracotta-soft circulaires)
- `<TimelineBlock>` (dates serif terracotta + ring-bg connector)
- `<TeamGrid>` (sand avatar fallback, names serif, role italic terracotta)
- `<LegalPageTemplate>` (hero halo-warm + body paper)
- `<TestimonialCard>` (pull-quote pur figure + blockquote serif italic)
- `<TestimonialsCarousel>` (boutons rounded-full, bordures sable)
- `<ArticleCard>` + `<CaseStudyCard>` (titles serif Fraunces, badges sand + terracotta-soft)
- `<ProductPageTemplate>` (alternance auto paper → sand → mocha → canvas → mocha)

**i18n** : 64 nouvelles clés home FR+EN en parité (102 keys total).
**Tests** : `Hero.test.tsx` réécrit pour assertion `text-display-editorial` + indicator dot accent. `Button.test.tsx` assertion `cta-lift`. **71/71 verts**.
**Gates** : verify:all GREEN (typecheck · lint · i18n · anti-formation/siren/hex · use-client · contrast 10 paires AA · radius · 71 tests).

### À faire ensuite

- **Audit contraste étendu** : ajouter au `scripts/check-contrast.ts` les paires v3 (text-fg-muted sur bg-sand, text-mocha-fg/70 sur mocha-rich, etc.).
- **Renforcer la modernité** (animations subtiles scroll-triggered, visuels SVG abstraits).
- **Renforcer le message client** : intervention/audit/implémentation + bénéfice chiffré ultra-clair dès le hero.
- **Reprendre la séquence d'audits** : 1/4 SPRINT-AUDIT, 2/4 Checkpoint, 4/4 VERIFICATION-FINALE Pass A.

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
