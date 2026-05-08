# Annexe A — Inventaire des skills (Phase 1.S)

**Date** : 06/05/2026 — soir, post-réécriture Webflow
**Périmètre** : `C:\Users\willi\Documents\Projets\Axion-IA\AxionIA_Dossier_FINAL_ABSOLU_v10.1\axionia-package\.claude\skills\` (103 skills)
**Mode** : READ-ONLY

---

## 1. Synthèse quantitative

- **Total skills** : 103 (102 dossiers + 1 README.md racine)
- **Skills sur-mesure `axionia-*`** : 18
- **Skills génériques importés** : 85
  - Marketing/Growth : 35
  - SEO (suite externe) : 29
  - Workflow / méta / Anthropic Labs : 17
  - UI/UX externes : 4 (`frontend-design`, `ui-ux-pro-max`, `web-design-guidelines`, `image`)

---

## 2. Fiches détaillées — 18 skills `axionia-*`

### 2.1 `axionia-core`

- **Path** : `.claude/skills/axionia-core/SKILL.md`
- **Lignes** : 212
- **Description** (verbatim, tronquée 250) : « Règles non négociables du projet AxionIA. À CHARGER À CHAQUE SESSION avant tout autre skill. Couvre l'identité projet, les bannissements lexicaux (mot "formation" interdit), les 3 modules, l'architecture URL, le statut société estonienne, et les déc »
- **allowed-tools** : non spécifié
- **model** : non spécifié
- **Triggers FR** : « projet AxionIA », « charger », « formation », « modules », « architecture URL », « société estonienne », « décisions verrouillées 06/05/2026 »
- **Triggers EN** : aucun (skill 100% FR)
- **Triggers négatifs** : skills SEO (`aso-audit`, `seo-ecommerce`, `seo-local`, `seo-maps`, `seo-image-gen`, `seo-dataforseo`, `seo-flow`) et marketing (`paywall-upgrade-cro`, `signup-flow-cro`, `onboarding-cro`, `churn-prevention`, `referral-program`, `community-marketing`, `revops`) explicitement listés à NE PAS invoquer
- **Skills cités** : tous les 17 autres `axionia-*` + `web-design-guidelines`, `ui-ux-pro-max`, `frontend-design`, `claude-md-improver`, `claude-automation-recommender`
- **Fichiers projet cités** : `Design.md` (racine), `docs/adr/0001-design-direction-webflow.md`, `_DECISIONS-FINALES.md`, `axionia-package/CLAUDE.md`

### 2.2 `axionia-design`

- **Path** : `.claude/skills/axionia-design/SKILL.md`
- **Lignes** : 465
- **Description** (verbatim, tronquée 250) : « Système de design AxionIA — direction visuelle Webflow-inspired (validée par Will le 06/05/2026). À charger pour toute création/modification de composants UI, pages, layouts, ou questions de style. Couvre la palette CSS variables (Webflow Blue + 6 secondaires »
- **allowed-tools** : non spécifié
- **model** : non spécifié
- **Triggers FR** : « composants UI », « pages », « layouts », « style », « palette », « typographie », « ombres », « rayons », « animations », « shadcn/ui »
- **Triggers EN** : « Webflow Blue », « Webflow-inspired » (anglicismes techniques)
- **Triggers négatifs** : pas de section explicite, mais anti-patterns interdisent gradients, glassmorphism, border-radius > 8px, shadows lourdes, secondaire en CTA principal
- **Skills cités** : `axionia-core`, `axionia-mobile-first`, `axionia-a11y`, `axionia-anti-spa`, `web-design-guidelines`
- **Fichiers projet cités** : `Design.md` racine, `docs/adr/0001-design-direction-webflow.md`, `app/globals.css`, `app/fonts.ts`

### 2.3 `axionia-anti-spa`

- **Path** : `.claude/skills/axionia-anti-spa/SKILL.md`
- **Lignes** : 374
- **Description** (verbatim, tronquée 250) : « Règles anti-SPA d'AxionIA — verrouille les pratiques SSR/SSG natives Next.js pour ne JAMAIS dégrader le SEO/AEO. À charger dès qu'on écrit ou modifie un composant React/page Next.js. Interdit `'use client'` non justifié, interdit les fetchs dans `useEffect` »
- **Triggers FR** : « composant React », « page Next.js », « SSR », « SSG », « SEO », « AEO »
- **Triggers EN** : « 'use client' », « useEffect », « dynamic », « generateMetadata », « Server Components »
- **Skills cités** : (implicite) `axionia-i18n`, `axionia-seo-aeo`
- **Fichiers projet cités** : `app/[locale]/layout.tsx`, `i18n/navigation`, `next.config`

### 2.4 `axionia-mobile-first`

- **Path** : `.claude/skills/axionia-mobile-first/SKILL.md`
- **Lignes** : 162
- **Description** (verbatim, tronquée 250) : « Règles mobile-first absolues du projet AxionIA. À charger systématiquement quand on écrit du JSX/TSX, des classes Tailwind, ou qu'on touche à un layout. Mobile-first n'est pas négociable. Couvre la convention bottom-up Tailwind, les viewports de test, les to »
- **Triggers FR** : « JSX », « TSX », « Tailwind », « layout », « mobile-first »
- **Triggers EN** : « LCP », « INP », « CLS », « touch targets », « WCAG », « drawer », « bottom-sheet »
- **Skills cités** : (implicite) `axionia-performance`
- **Fichiers projet cités** : aucun (skill purement règles)

### 2.5 `axionia-a11y`

- **Path** : `.claude/skills/axionia-a11y/SKILL.md`
- **Lignes** : 210
- **Description** (verbatim, tronquée 250) : « Accessibilité WCAG 2.2 AA d'AxionIA. À charger pour toute création/audit de composant, page, ou formulaire. Couvre les règles WCAG 2.2 AA, les patterns ARIA shadcn/ui, le focus visible, prefers-reduced-motion, les touch targets 44×44, le skip-to-content »
- **Triggers FR** : « accessibilité », « formulaire », « lecteurs d'écran »
- **Triggers EN** : « WCAG 2.2 AA », « ARIA », « focus visible », « prefers-reduced-motion », « axe-core », « eslint-plugin-jsx-a11y », « touch targets », « skip-to-content »
- **Skills cités** : (implicite) `axionia-performance`
- **Fichiers projet cités** : `app/[locale]/layout.tsx`, `tests/e2e/a11y.spec.ts`, `.eslintrc`, `.lighthouserc.json`

### 2.6 `axionia-admin-ux`

- **Path** : `.claude/skills/axionia-admin-ux/SKILL.md`
- **Lignes** : 272
- **Description** (verbatim, tronquée 250) : « UX et structure de la console d'administration AxionIA. À charger pour toute création/modification de page admin, layout sidebar/topbar, table de données, formulaires CMS, gestion de contenus FR+EN, ou matrice de permissions. Couvre les 4 rôles (Super Admin »
- **Triggers FR** : « console admin », « sidebar », « topbar », « table données », « formulaires CMS », « rôles », « 2FA », « Tiptap »
- **Triggers EN** : « TOTP », « RBAC », « DataTable »
- **Skills cités** : `axionia-calendar`, `axionia-testing`
- **Fichiers projet cités** : `lib/auth-rbac.ts`, `lib/auth.ts`, `app/[locale]/(admin)/[admin-prefix]/layout.tsx`, `components/admin/sidebar`, `components/admin/topbar`, `components/admin/editor.tsx`, `components/admin/content-locale-toggle.tsx`

### 2.7 `axionia-calendar`

- **Path** : `.claude/skills/axionia-calendar/SKILL.md`
- **Lignes** : 311
- **Description** (verbatim, tronquée 250) : « Logique métier du calendrier maison AxionIA (3 états, options 48h, race conditions). À charger pour toute tâche concernant la réservation d'interventions, le composant calendrier 3 états, la pose/expiration d'options, les notifications Telegram d'expiration »
- **Triggers FR** : « calendrier maison », « réservation », « options 48h », « race conditions », « expirations »
- **Triggers EN** : aucun spécifique
- **Triggers négatifs** : Calendly explicitement abandonné/interdit
- **Skills cités** : `axionia-database`, `axionia-testing`
- **Fichiers projet cités** : `lib/calendar/place-option.ts`, `lib/calendar/confirm-option.ts`, `scripts/expire-options.ts`, `components/calendar/calendar-month.tsx`

### 2.8 `axionia-database`

- **Path** : `.claude/skills/axionia-database/SKILL.md`
- **Lignes** : 490
- **Description** (verbatim, tronquée 250) : « Schéma de base de données AxionIA avec Prisma + Postgres. À charger pour toute tâche touchant aux migrations, schemas Prisma, requêtes BDD, seeders, ou modifications de tables. Couvre les tables principales (submissions, bookings, articles, faqs, testimon »
- **Triggers FR** : « migrations », « schémas », « requêtes BDD », « seeders », « tables », « multilingue », « sauvegarde »
- **Triggers EN** : « Prisma », « Postgres », « UUID »
- **Skills cités** : `axionia-deployment`
- **Fichiers projet cités** : `prisma/schema.prisma`, `prisma/migrations/`, `lib/db/article.ts`

### 2.9 `axionia-deployment`

- **Path** : `.claude/skills/axionia-deployment/SKILL.md`
- **Lignes** : 526
- **Description** (verbatim, tronquée 250) : « Déploiement et infrastructure d'AxionIA sur Hetzner Cloud + Coolify + Cloudflare. À charger pour toute tâche de DevOps, Docker, configuration serveur, CI/CD, sauvegardes, monitoring, ou question sur le déploiement. Couvre la configuration Hetzner CX32, Cool »
- **Triggers FR** : « DevOps », « Docker », « configuration serveur », « CI/CD », « sauvegardes », « déploiement », « rollback »
- **Triggers EN** : « Hetzner », « Coolify », « Cloudflare », « Caddy », « SSL », « WAF », « rclone »
- **Triggers négatifs** : Vercel, Netlify, AWS, GCP, Azure, Render, Railway, Fly.io, Cloudflare Pages explicitement interdits
- **Skills cités** : `axionia-emails`, `axionia-forms`
- **Fichiers projet cités** : `Caddyfile`, `docker-compose.yml`, `.github/workflows/ci.yml`, `.github/workflows/lighthouse-budget.yml`, `/home/axionia/scripts/backup-postgres.sh`

### 2.10 `axionia-emails`

- **Path** : `.claude/skills/axionia-emails/SKILL.md`
- **Lignes** : 447
- **Description** (verbatim, tronquée 250) : « Système email maison d'AxionIA basé sur PowerMTA + MailWizz self-hosted. À charger pour toute tâche concernant les emails transactionnels (confirmations, notifications), les campagnes (newsletter), les templates React Email FR/EN, la délivrabilité (DKIM/SPF/ »
- **Triggers FR** : « emails transactionnels », « campagnes », « newsletter », « délivrabilité », « warmup IP », « queue »
- **Triggers EN** : « PowerMTA », « MailWizz », « DKIM », « SPF », « DMARC », « BIMI », « BullMQ », « Nodemailer », « React Email »
- **Triggers négatifs** : Resend, SendGrid, Mailgun, Brevo formellement interdits
- **Skills cités** : (implicite) `axionia-deployment`
- **Fichiers projet cités** : `lib/email/client.ts`, `lib/email/queue.ts`, `lib/email/templates/audit-confirmation.tsx`, `/etc/pmta/config`

### 2.11 `axionia-forms`

- **Path** : `.claude/skills/axionia-forms/SKILL.md`
- **Lignes** : 341
- **Description** (verbatim, tronquée 250) : « Construction de formulaires multi-step pour AxionIA avec React Hook Form + Zod. À charger pour toute création/modification de formulaire (audit 5 étapes, implémentation 4 étapes, contact, newsletter, réservation intervention). Couvre la validation Zod, le st »
- **Triggers FR** : « formulaire », « multi-step », « audit 5 étapes », « implémentation 4 étapes », « réservation intervention », « anti-spam »
- **Triggers EN** : « React Hook Form », « Zod », « Zustand », « Telegram »
- **Triggers négatifs** : Resend formellement interdit (rappelé)
- **Skills cités** : `axionia-emails`
- **Fichiers projet cités** : `lib/forms/audit-schema.ts`, `lib/forms/audit-store.ts`, `components/forms/AuditForm.tsx`, `app/api/forms/audit/route.ts`, `lib/telegram.ts`

### 2.12 `axionia-i18n`

- **Path** : `.claude/skills/axionia-i18n/SKILL.md`
- **Lignes** : 306
- **Description** (verbatim, tronquée 250) : « Internationalisation FR/EN d'AxionIA avec next-intl. À charger pour toute tâche touchant aux traductions, aux URLs localisées, aux pathnames traduits, au sélecteur de langue, aux messages emails bilingues, ou au middleware de routing. Couvre la config next-i »
- **Triggers FR** : « traductions », « URLs localisées », « sélecteur de langue », « emails bilingues », « middleware routing »
- **Triggers EN** : « next-intl », « hreflang », « pathnames »
- **Triggers négatifs** : Resend formellement interdit (rappelé)
- **Skills cités** : `axionia-emails`
- **Fichiers projet cités** : `i18n/routing.ts`, `i18n/navigation.ts`, `middleware.ts`, `i18n/request.ts`, `messages/fr.json`, `messages/en.json`, `app/sitemap.ts`

### 2.13 `axionia-seo-aeo`

- **Path** : `.claude/skills/axionia-seo-aeo/SKILL.md`
- **Lignes** : 607
- **Description** (verbatim, tronquée 250) : « Stratégie SEO + AEO + GEO d'AxionIA pour une visibilité maximale sur Google, Bing, Perplexity, ChatGPT, Claude, Google AI Overview. À charger pour toute tâche concernant les meta tags, Schema.org JSON-LD, sitemap multilingue, robots.txt, hreflang, blocs ré »
- **Triggers FR** : « meta tags », « sitemap », « robots », « hreflang », « blocs réponse directe AEO », « llms.txt », « IndexNow »
- **Triggers EN** : « Schema.org », « JSON-LD », « Core Web Vitals », « OpenGraph », « FAQPage », « BreadcrumbList »
- **Skills cités** : `axionia-anti-spa`
- **Fichiers projet cités** : `app/[locale]/(public)/.../page.tsx`, `components/seo/OrganizationSchema.tsx`, `app/sitemap.ts`, `app/robots.ts`, `lib/seo/indexnow.ts`, `app/api/og/[locale]/[...path]/route.tsx`, `/public/llms.txt`

### 2.14 `axionia-stack`

- **Path** : `.claude/skills/axionia-stack/SKILL.md`
- **Lignes** : 251
- **Description** (verbatim, tronquée 250) : « Stack technique DÉFINITIVE et VERROUILLÉE d'AxionIA. À charger pour toute tâche d'installation, configuration, structure de dossiers, choix de bibliothèque, ou setup d'environnement. Couvre Next.js 15 App Router, TypeScript strict, Tailwind v4, shadcn/ui, P »
- **Triggers FR** : « installation », « configuration », « structure dossiers », « bibliothèque », « setup environnement »
- **Triggers EN** : « Next.js », « TypeScript », « Tailwind », « shadcn/ui », « Prisma », « Auth.js », « PowerMTA »
- **Triggers négatifs** : Vercel, AWS, GCP, etc. interdits comme hébergeurs
- **Skills cités** : `axionia-deployment`
- **Fichiers projet cités** : `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `lib/env.ts`

### 2.15 `axionia-testing`

- **Path** : `.claude/skills/axionia-testing/SKILL.md`
- **Lignes** : 316
- **Description** (verbatim, tronquée 250) : « Stratégie de tests AxionIA avec Vitest (unit/integration) et Playwright (E2E). À charger pour toute écriture de test, configuration de CI tests, ou question sur la couverture. Couvre les patterns Next.js 15 (Server Components, Server Actions, route handlers, »
- **Triggers FR** : « tests », « couverture », « fixtures multilingues »
- **Triggers EN** : « Vitest », « Playwright », « axe-core », « React Testing Library », « next-test-api-route-handler »
- **Skills cités** : (implicite) `axionia-calendar`
- **Fichiers projet cités** : `vitest.config.ts`, `playwright.config.ts`, `tests/setup.ts`, `tests/e2e/audit-form.spec.ts`, `tests/fixtures/articles.ts`

### 2.16 `axionia-performance`

- **Path** : `.claude/skills/axionia-performance/SKILL.md`
- **Lignes** : 233
- **Description** (verbatim, tronquée 250) : « Performance budgets enforcement d'AxionIA. À charger pour tout audit ou optimisation de performance, configuration Lighthouse CI, bundle analysis, perf budget JSON, ou question sur Core Web Vitals. Couvre les budgets stricts AxionIA (LCP < 1.8s, INP < 80ms »
- **Triggers FR** : « performance », « optimisation », « bundle analysis », « budget »
- **Triggers EN** : « Lighthouse CI », « Core Web Vitals », « LCP », « INP », « CLS », « bundle-analyzer »
- **Skills cités** : `axionia-deployment`, `axionia-monitoring`
- **Fichiers projet cités** : `.lighthouserc.json`, `next.config.ts`, `budget.json`, `components/perf/web-vitals-reporter.tsx`

### 2.17 `axionia-rgpd`

- **Path** : `.claude/skills/axionia-rgpd/SKILL.md`
- **Lignes** : 218
- **Description** (verbatim, tronquée 250) : « Conformité RGPD d'AxionIA en tant que société estonienne (OÜ) responsable de traitement. À charger pour toute tâche touchant aux données personnelles, formulaires de contact/audit, newsletter, consentement, cookies, droits utilisateurs (accès/rectification/e »
- **Triggers FR** : « données personnelles », « consentement », « cookies », « droits utilisateurs », « DPO », « registre des traitements », « durées de conservation »
- **Triggers EN** : « RGPD », « DPA », « TOTP » (incidemment)
- **Triggers négatifs** : « CNIL » (à remplacer par AKI), SIREN/SIRET (à remplacer par registrikood), pré-cochage consent, services US
- **Skills cités** : aucun explicitement
- **Fichiers projet cités** : `app/api/rgpd/export/route.ts`, `app/api/rgpd/delete/route.ts`, `lib/logger.ts`, `docs/rgpd/registre-traitements.md`

### 2.18 `axionia-monitoring`

- **Path** : `.claude/skills/axionia-monitoring/SKILL.md`
- **Lignes** : 304
- **Description** (verbatim, tronquée 250) : « Stack de monitoring AxionIA (Sentry self-hosted, Uptime Kuma, Pino, Plausible, Telegram alerts). À charger pour toute tâche d'observabilité, configuration d'alertes, dashboards, logs, sauvegardes, ou diagnostic post-incident. Couvre les patterns Next.js 15 ( »
- **Triggers FR** : « observabilité », « alertes », « dashboards », « logs », « sauvegardes », « diagnostic post-incident »
- **Triggers EN** : « Sentry », « Uptime Kuma », « Pino », « Plausible », « instrumentation.ts »
- **Skills cités** : (implicite) `axionia-rgpd` (logs), `axionia-deployment`
- **Fichiers projet cités** : `sentry.client.config.ts`, `instrumentation.ts`, `lib/logger.ts`, `lib/alerts/telegram-alert.ts`, `app/api/health/route.ts`, `/home/axionia/scripts/backup-postgres.sh`

---

## 3. Tableau condensé — 85 skills génériques

### 3.1 Marketing & Growth (35 skills)

| Skill                       | Lignes | Description résumée                          | Statut AxionIA                    |
| --------------------------- | -----: | -------------------------------------------- | --------------------------------- |
| `ab-test-setup`             |    353 | A/B test design + experimentation programs   | Pertinent (phase 2+)              |
| `ad-creative`               |    362 | Bulk ad copy generation Meta/Google/LinkedIn | Possiblement pertinent            |
| `ai-seo`                    |    443 | LLMO/AEO/GEO citation optimization           | Doublon `axionia-seo-aeo`         |
| `analytics-tracking`        |    309 | GA4, GTM, conversion tracking                | À filtrer (Plausible imposé)      |
| `aso-audit`                 |    312 | App Store Optimization                       | **Non pertinent** (ban core)      |
| `brainstorming`             |    164 | Refines ideas into specs (méta)              | Pertinent                         |
| `churn-prevention`          |    424 | Cancel flows, dunning, save offers           | **Non pertinent** (ban core)      |
| `co-marketing`              |    290 | Joint campaigns, partnerships                | Optionnel                         |
| `cold-email`                |    158 | B2B cold outreach sequences                  | Optionnel (phase 2)               |
| `community-marketing`       |    163 | Discord/Slack communities                    | **Non pertinent** (ban core)      |
| `competitor-alternatives`   |    256 | "X vs Y" / "alternatives to X" pages         | Pertinent                         |
| `competitor-profiling`      |    411 | Competitor research dossiers                 | Pertinent                         |
| `content-strategy`          |    365 | Editorial calendars, topic clusters          | Pertinent                         |
| `copy-editing`              |    508 | Refine existing marketing copy               | Pertinent                         |
| `copywriting`               |    252 | New marketing copy production                | Pertinent                         |
| `customer-research`         |    270 | ICP, JTBD, VOC, transcripts                  | Pertinent                         |
| `directory-submissions`     |    375 | Product Hunt, BetaList, listings             | Optionnel                         |
| `email-sequence`            |    311 | Drip campaigns, nurture                      | Pertinent (via PowerMTA)          |
| `form-cro`                  |    429 | Lead capture form optimization               | Pertinent                         |
| `free-tool-strategy`        |    179 | Calculator/grader as marketing               | Pertinent                         |
| `image`                     |    335 | AI image generation (Flux, Midjourney…)      | Pertinent (OG, hero)              |
| `launch-strategy`           |    353 | Product Hunt + GTM launch plans              | Pertinent (lancement)             |
| `lead-magnets`              |    310 | Ebooks, checklists, gated content            | Pertinent                         |
| `marketing-ideas`           |    167 | 139 SaaS marketing tactics library           | Pertinent                         |
| `marketing-psychology`      |    455 | Cognitive biases, persuasion                 | Pertinent                         |
| `onboarding-cro`            |    220 | Post-signup activation                       | **Non pertinent** (ban core)      |
| `page-cro`                  |    182 | Generic page CRO                             | Pertinent                         |
| `paid-ads`                  |    317 | Google/Meta/LinkedIn campaigns               | Optionnel                         |
| `paywall-upgrade-cro`       |    227 | Upgrade screens                              | **Non pertinent** (ban core)      |
| `popup-cro`                 |    454 | Modals, exit-intent                          | Optionnel                         |
| `pricing-strategy`          |    231 | Tiers, freemium, Van Westendorp              | Tarifs verrouillés                |
| `product-marketing-context` |    241 | `.agents/product-marketing-context.md`       | Doublon avec `axionia-core`       |
| `programmatic-seo`          |    238 | Pages at scale via templates                 | Pertinent (`/glossaire`)          |
| `referral-program`          |    257 | Affiliate programs                           | **Non pertinent** (ban core)      |
| `revops`                    |    345 | Lead lifecycle, MQL/SQL                      | **Non pertinent** (ban core)      |
| `sales-enablement`          |    359 | Pitch decks, one-pagers                      | Pertinent (phase 2)               |
| `signup-flow-cro`           |    359 | Registration optimization                    | **Non pertinent** (ban core)      |
| `site-architecture`         |    357 | Page hierarchy, IA, sitemap                  | Doublon partiel `axionia-seo-aeo` |
| `social-content`            |    409 | LinkedIn/X/TikTok posts + scripts            | Pertinent (LinkedIn)              |
| `video`                     |    332 | Remotion, HeyGen, AI video                   | Optionnel                         |

### 3.2 SEO suite externe AgriciDaniel (29 skills)

| Skill                               | Lignes | Description résumée                | Statut AxionIA                    |
| ----------------------------------- | -----: | ---------------------------------- | --------------------------------- |
| `seo`                               |    230 | Comprehensive SEO router           | Pertinent (filtrer footer)        |
| `seo-audit-marketing`               |    497 | SEO audit on-page/technical        | Pertinent                         |
| `seo-audit-technical`               |    137 | Full website audit subagent-driven | Pertinent                         |
| `seo-backlinks`                     |    264 | Referring domains, anchor text     | Pertinent                         |
| `seo-cluster`                       |    322 | SERP-based topic clustering        | Pertinent                         |
| `seo-competitor-pages`              |    220 | Comparison/alternatives pages      | Doublon `competitor-alternatives` |
| `seo-content`                       |    180 | E-E-A-T + AI citation readiness    | Pertinent                         |
| `seo-dataforseo`                    |    403 | DataForSEO MCP integration         | **Non pertinent** (MCP payant)    |
| `seo-drift`                         |    219 | Baseline + diff SEO regressions    | Pertinent                         |
| `seo-ecommerce`                     |    341 | Google Shopping, Amazon, products  | **Non pertinent** (ban core)      |
| `seo-flow`                          |    136 | FLOW framework prompts             | **Non pertinent** (ban core)      |
| `seo-geo`                           |    255 | AI Overviews + GEO                 | Doublon `axionia-seo-aeo`         |
| `seo-google`                        |    345 | GSC, PageSpeed, CrUX, GA4          | Pertinent                         |
| `seo-hreflang`                      |    255 | Hreflang i18n SEO                  | Pertinent (compléte axionia-i18n) |
| `seo-image-gen`                     |    176 | Nanobanana MCP image generation    | **Non pertinent** (MCP requis)    |
| `seo-images`                        |    336 | Image alt text, WebP, CLS          | Pertinent                         |
| `seo-local`                         |    317 | Google Business Profile, NAP       | **Non pertinent** (ban core)      |
| `seo-maps`                          |    259 | Geo-grid, GBP API                  | **Non pertinent** (ban core)      |
| `seo-page`                          |     94 | Single-page SEO analysis           | Pertinent                         |
| `seo-plan`                          |    126 | SEO strategic planning             | Pertinent (initialement)          |
| `seo-programmatic`                  |    178 | pSEO templates + safeguards        | Pertinent                         |
| `seo-schema`                        |    167 | Schema.org detection/generation    | Doublon `axionia-seo-aeo`         |
| `seo-sitemap`                       |    118 | XML sitemap analysis/generation    | Doublon `axionia-seo-aeo`         |
| `seo-sxo`                           |    254 | Search Experience Optimization     | Pertinent                         |
| `seo-technical`                     |    173 | Technical SEO 9 catégories         | Pertinent                         |
| `schema-markup`                     |    179 | Schema.org JSON-LD                 | Doublon `axionia-seo-aeo`         |
| `programmatic-seo` (déjà ci-dessus) |      — | —                                  | —                                 |
| `ai-seo` (déjà ci-dessus)           |      — | —                                  | —                                 |

### 3.3 Workflow / méta / Anthropic Labs (17 skills)

| Skill                                 | Lignes | Description résumée                  | Statut AxionIA       |
| ------------------------------------- | -----: | ------------------------------------ | -------------------- |
| `claude-automation-recommender`       |    288 | Recommend hooks/subagents/skills/MCP | Utile au démarrage   |
| `claude-md-improver`                  |    179 | Audit + suggest CLAUDE.md updates    | Utile périodiquement |
| `dispatching-parallel-agents`         |    182 | 2+ independent tasks parallel        | Méta workflow        |
| `executing-plans`                     |     70 | Load plan, review, execute           | Méta workflow        |
| `finishing-a-development-branch`      |    251 | Merge/PR/cleanup options             | Méta workflow        |
| `receiving-code-review`               |    213 | Review feedback handling             | Méta workflow        |
| `requesting-code-review`              |    103 | Dispatch reviewer subagent           | Méta workflow        |
| `subagent-driven-development`         |    279 | Plans avec sous-tâches indépendantes | Méta workflow        |
| `systematic-debugging`                |    296 | Debug methodology                    | Méta workflow        |
| `test-driven-development`             |    371 | TDD methodology                      | Pertinent            |
| `using-git-worktrees`                 |    215 | Isolated workspace                   | Méta workflow        |
| `using-superpowers`                   |    117 | Skill discovery rules                | Méta workflow        |
| `verification-before-completion`      |    139 | Evidence before claims               | Méta workflow        |
| `writing-plans`                       |    152 | Spec → multi-step plan               | Méta workflow        |
| `writing-skills`                      |    655 | Create/edit/verify skills            | Méta workflow        |
| `owasp-security`                      |    622 | OWASP Top 10:2025 + ASVS 5.0         | Pertinent (sécurité) |
| `analytics-tracking` (déjà ci-dessus) |      — | —                                    | —                    |

### 3.4 UI/UX externes (4 skills)

| Skill                        | Lignes | Description résumée                           | Statut AxionIA                              |
| ---------------------------- | -----: | --------------------------------------------- | ------------------------------------------- |
| `frontend-design`            |     41 | Distinctive, polished frontend (anti-AI-slop) | Limité à exécution (pas direction visuelle) |
| `ui-ux-pro-max`              |    351 | 50 styles, 97 palettes, 57 font pairings      | Pour patterns techniques uniquement         |
| `web-design-guidelines`      |     62 | Vercel Labs ~100 règles UI/a11y/perf          | Pertinent (linter)                          |
| `image` (déjà compté en 3.1) |      — | —                                             | —                                           |

---

## 4. Notes d'inventaire

- Aucun frontmatter `allowed-tools` ni `model` n'est défini sur les 18 skills `axionia-*` (héritage du défaut Claude Code).
- Quelques skills externes définissent `tools:` (ex. `claude-automation-recommender: Read, Glob, Grep, Bash`, `claude-md-improver: Read, Glob, Grep, Bash, Edit`).
- Les skills SEO AgriciDaniel exposent `user-invokable: true` + `argument-hint:` (slash-command friendly) — non utilisé sur les `axionia-*`.
- Les skills `seo-cluster`, `seo-competitor-pages`, `seo-content`, `seo-dataforseo`, `seo-drift`, `seo-ecommerce`, `seo-flow`, `seo-geo`, `seo-google`, `seo-hreflang`, `seo-images`, `seo-local`, `seo-maps`, `seo-page`, `seo-plan`, `seo-programmatic`, `seo-schema`, `seo-sitemap`, `seo-sxo`, `seo-technical` partagent le bloc footer publicitaire « Built by AgriciDaniel » que `axionia-core` impose de retirer avant livrable Will.
- Le README.md du dossier `.claude/skills/` n'a pas été ouvert ici (hors-skill).
