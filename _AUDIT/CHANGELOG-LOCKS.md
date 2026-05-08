# CHANGELOG — Application des cadenas LOCK-01..23 sur les skills AxionIA

**Date d'application** : 2026-05-06
**Périmètre** : 34 SKILL.md modifiés (22 LOCKs uniques sur 23, dont LOCK-17 sur 2 skills, LOCK-22 sur 8 skills, LOCK-23 sur 4 skills).
**Méthode** : ajout d'une note `[LOCK-XX] ...` à la fin de la `description` du frontmatter YAML uniquement. Aucune autre modification du SKILL.md. Description toujours ≤ 1024 caractères.
**Source** : tableau des LOCKs fourni par Will (énoncé de la tâche). Les fichiers `_AUDIT/01s-F-actions.md` et `_AUDIT/01s-skills-deep-audit.md` n'existaient pas dans le repo au moment du log — appliqué directement à partir du tableau de référence de l'énoncé.

---

## LOCK-01 — `web-design-guidelines`

- **Fichier** : `web-design-guidelines/SKILL.md`
- **Description avant (tronquée)** : « Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI"... Linter agnostique de design system, complémentaire d'axionia-design (style) et d'axionia-mobile-first (stratégie responsive). »
- **Phrase ajoutée** : « [LOCK-01] Sur AxionIA, direction visuelle Webflow-inspired (cf. `axionia-design`). Ce skill complète comme linter UI mais ne propose PAS de direction visuelle. »

## LOCK-02 — `ui-ux-pro-max`

- **Fichier** : `ui-ux-pro-max/SKILL.md`
- **Description avant (tronquée)** : « UI/UX design intelligence. 50 styles, 21 palettes... Styles: glassmorphism, claymorphism, minimalism, brutalism, neumorphism, bento grid, dark mode, responsive, skeuomorphism, flat design... Integrations: shadcn/ui MCP for component search and examples. »
- **Phrase ajoutée** : « [LOCK-02] Sur AxionIA, doctrine visuelle = `axionia-design` (Webflow-inspired). Ce skill peut suggérer brutalism/glassmorphism/gradients colorés que `axionia-design` rejette : filtrer impérativement. »

## LOCK-03 — `frontend-design`

- **Fichier** : `frontend-design/SKILL.md`
- **Description avant (tronquée)** : « Create distinctive, production-grade frontend interfaces with high design quality... Generates creative, polished code that avoids generic AI aesthetics. »
- **Phrase ajoutée** : « [LOCK-03] Sur AxionIA, doctrine visuelle = `axionia-design` (Webflow-inspired). Ce skill peut suggérer brutalism/maximalist/glassmorphism/gradients colorés que `axionia-design` rejette : filtrer impérativement. »

## LOCK-04 — `copywriting`

- **Fichier** : `copywriting/SKILL.md`
- **Description avant (tronquée)** : « When the user wants to write, rewrite, or improve marketing copy... For email copy, see email-sequence. For popup copy, see popup-cro. For editing existing copy, see copy-editing. »
- **Phrase ajoutée** : « [LOCK-04] Sur AxionIA, mots « formation/formateur/former/training » BANNIS (cf. `axionia-core` §2). Utiliser « intervention/intervenant/accompagner ». Prix toujours en € HT. »

## LOCK-05 — `copy-editing`

- **Fichier** : `copy-editing/SKILL.md`
- **Description avant (tronquée)** : « When the user wants to edit, review, or improve existing marketing copy... For writing new copy, see copywriting. »
- **Phrase ajoutée** : « [LOCK-05] Sur AxionIA, mots « formation/formateur/former/training » BANNIS (cf. `axionia-core` §2). Utiliser « intervention/intervenant/accompagner ». Prix toujours en € HT. »

## LOCK-06 — `content-strategy`

- **Fichier** : `content-strategy/SKILL.md`
- **Description avant (tronquée)** : « When the user wants to plan a content strategy... For social media content specifically, see social-content. »
- **Phrase ajoutée** : « [LOCK-06] Sur AxionIA, mots « formation/training » BANNIS (cf. `axionia-core` §2). Cabinet IA B2B vitrine OÜ estonienne, pas SaaS classique — adapter clusters et tonalité. »

## LOCK-07 — `page-cro`

- **Fichier** : `page-cro/SKILL.md`
- **Description avant (tronquée)** : « When the user wants to optimize, improve, or increase conversions on any marketing page... For popups/modals, see popup-cro. »
- **Phrase ajoutée** : « [LOCK-07] Sur AxionIA, anti-SPA absolu (cf. `axionia-anti-spa`). Server Components par défaut. Pas de fetchs dans `useEffect`. »

## LOCK-08 — `form-cro`

- **Fichier** : `form-cro/SKILL.md`
- **Description avant (tronquée)** : « When the user wants to optimize any form that is NOT signup/registration... For popups containing forms, see popup-cro. »
- **Phrase ajoutée** : « [LOCK-08] Sur AxionIA, anti-SPA (cf. `axionia-anti-spa`) + tooling = RHF+Zod+Zustand (cf. `axionia-forms`). Pas de Formspree/Typeform externes. »

## LOCK-09 — `popup-cro`

- **Fichier** : `popup-cro/SKILL.md`
- **Description avant (tronquée)** : « When the user wants to create or optimize popups, modals, overlays, slide-ins, or banners for conversion purposes... For general page conversion optimization, see page-cro. »
- **Phrase ajoutée** : « [LOCK-09] Sur AxionIA, anti-SPA (cf. `axionia-anti-spa`) + sobriété B2B premium — popups très parcimonieux, pas d'exit-intent agressif. »

## LOCK-10 — `email-sequence`

- **Fichier** : `email-sequence/SKILL.md`
- **Description avant (tronquée)** : « When the user wants to create or optimize an email sequence... For in-app onboarding, see onboarding-cro. »
- **Phrase ajoutée** : « [LOCK-10] Sur AxionIA, tooling email = PowerMTA + MailWizz self-hosted + Nodemailer + React Email (cf. `axionia-emails`). Resend/SendGrid/Mailgun/Brevo/Mailchimp INTERDITS. »

## LOCK-11 — `cold-email`

- **Fichier** : `cold-email/SKILL.md`
- **Description avant (tronquée)** : « Write B2B cold emails and follow-up sequences that get replies... For sales collateral beyond emails, see sales-enablement. »
- **Phrase ajoutée** : « [LOCK-11] Sur AxionIA, tooling = PowerMTA + MailWizz self-hosted (cf. `axionia-emails`). Resend/SendGrid/Mailgun INTERDITS. Cible décideurs B2B premium tickets 290-50k€, pas de mass cold à grande échelle. »

## LOCK-12 — `seo-audit-marketing`

- **Fichier** : `seo-audit-marketing/SKILL.md`
- **Description avant (tronquée)** : « When the user wants to audit, review, or diagnose SEO issues on their site... For AI search optimization, see ai-seo. »
- **Phrase ajoutée** : « [LOCK-12] Sur AxionIA, canon SEO/AEO = `axionia-seo-aeo`. Mot « formation » banni. URLs canoniques `/implementation` `/cas-concrets` `/conditions-generales`. »

## LOCK-13 — `ai-seo`

- **Fichier** : `ai-seo/SKILL.md`
- **Description avant (tronquée)** : « When the user wants to optimize content for AI search engines, get cited by LLMs... For structured data implementation, see schema-markup. »
- **Phrase ajoutée** : « [LOCK-13] Sur AxionIA, canon SEO/AEO = `axionia-seo-aeo`. Mot « formation » banni. URLs canoniques `/implementation` `/cas-concrets`. »

## LOCK-14 — `seo-hreflang`

- **Fichier** : `seo-hreflang/SKILL.md`
- **Description avant (tronquée, format YAML `>`)** : « Hreflang and international SEO audit, validation, and generation... Use when user says "hreflang", "i18n SEO", "international SEO", "multi-language", "multi-region", or "language tags". »
- **Phrase ajoutée** : « [LOCK-14] Sur AxionIA, génération hreflang = `axionia-i18n` (next-intl). Ce skill = validation post-build uniquement. »

## LOCK-15 — `seo-sitemap`

- **Fichier** : `seo-sitemap/SKILL.md`
- **Description avant (tronquée, format YAML `>`)** : « Analyze existing XML sitemaps or generate new ones with industry templates... Use when user says "sitemap", "generate sitemap", "sitemap issues", or "XML sitemap". »
- **Phrase ajoutée** : « [LOCK-15] Sur AxionIA, génération sitemap = `axionia-seo-aeo` (multi-fichiers FR+EN). Ce skill = validation uniquement. »

## LOCK-16 — `schema-markup`

- **Fichier** : `schema-markup/SKILL.md`
- **Description avant (tronquée)** : « When the user wants to add, fix, or optimize schema markup and structured data on their site... For AI search optimization, see ai-seo. »
- **Phrase ajoutée** : « [LOCK-16] Sur AxionIA, génération JSON-LD = `axionia-seo-aeo`. Ce skill = validation Schema.org uniquement. »

## LOCK-17a — `seo-page`

- **Fichier** : `seo-page/SKILL.md`
- **Description avant (tronquée, format YAML `>`)** : « Deep single-page SEO analysis covering on-page elements, content quality, technical meta tags, schema, images, and performance... »
- **Phrase ajoutée** : « [LOCK-17] Sur AxionIA, perf budgets = `axionia-performance` (LCP<1.8s strict, INP<80ms, CLS<0.05). »

## LOCK-17b — `seo-drift`

- **Fichier** : `seo-drift/SKILL.md`
- **Description avant (tronquée, format YAML `>`)** : « SEO drift monitoring: capture baselines of SEO-critical elements, detect changes, and track regressions over time. Git for SEO... »
- **Phrase ajoutée** : « [LOCK-17] Sur AxionIA, perf budgets = `axionia-performance` (LCP<1.8s strict, INP<80ms, CLS<0.05). »

## LOCK-18 — `analytics-tracking`

- **Fichier** : `analytics-tracking/SKILL.md`
- **Description avant (tronquée)** : « When the user wants to set up, improve, or audit analytics tracking and measurement... For A/B test measurement, see ab-test-setup. »
- **Phrase ajoutée** : « [LOCK-18] Sur AxionIA, analytics = Plausible self-hosted UNIQUEMENT. GA4/GTM/Mixpanel/Segment/Amplitude INTERDITS sans validation Will. »

## LOCK-19 — `paid-ads`

- **Fichier** : `paid-ads/SKILL.md`
- **Description avant (tronquée)** : « When the user wants help with paid advertising campaigns on Google Ads, Meta (Facebook/Instagram), LinkedIn, Twitter/X, or other ad platforms... For landing page optimization, see page-cro. »
- **Phrase ajoutée** : « [LOCK-19] Sur AxionIA, LinkedIn Ads prioritaire (B2B décideurs premium). Pas de Meta/TikTok grand public. »

## LOCK-20 — `owasp-security`

- **Fichier** : `owasp-security/SKILL.md`
- **Description avant (tronquée)** : « Use when reviewing code for security vulnerabilities, implementing authentication/authorization, handling user input, or discussing web application security. Covers OWASP Top 10:2025, ASVS 5.0, LLM Top 10 (2025), and Agentic AI security (2026). »
- **Phrase ajoutée** : « [LOCK-20] Sur AxionIA, valeurs effectives CSP/headers/secrets dans `axionia-deployment`. Ce skill = checklist OWASP Top 10/ASVS 5.0. »

## LOCK-21 — `test-driven-development`

- **Fichier** : `test-driven-development/SKILL.md`
- **Description avant (tronquée)** : « Use when implementing any feature or bugfix, before writing implementation code »
- **Phrase ajoutée** : « [LOCK-21] Sur AxionIA, stack tests = Vitest + Playwright + axe-core (cf. `axionia-testing`). Patterns Next.js 15 spécifiques. »

## LOCK-22 — Skills Phase 1 sans Stripe/inscription/app mobile

Phrase ajoutée (commune à 8 skills) : « [LOCK-22] Sur AxionIA Phase 1 (vitrine B2B sans abonnement Stripe, sans inscription utilisateur, sans app mobile), ce skill ne s'invoque PAS automatiquement. Phase 2+ ré-évaluer. Voir `docs/_NO-STRIPE.md`. » (Variantes mineures par skill : `community-marketing` mentionne « sans utilisateurs récurrents app », `revops` mentionne « sans CRM intégré », `referral-program` mentionne « sans tracking affiliés intégré », `aso-audit` mentionne « sans app mobile ».)

- `signup-flow-cro/SKILL.md` — desc avant : « When the user wants to optimize signup, registration, account creation, or trial activation flows... For lead capture forms (not account creation), see form-cro. »
- `paywall-upgrade-cro/SKILL.md` — desc avant : « When the user wants to create or optimize in-app paywalls, upgrade screens, upsell modals, or feature gates... For pricing decisions, see pricing-strategy. »
- `onboarding-cro/SKILL.md` — desc avant : « When the user wants to optimize post-signup onboarding, user activation, first-run experience, or time-to-value... For ongoing email sequences, see email-sequence. »
- `churn-prevention/SKILL.md` — desc avant : « When the user wants to reduce churn, build cancellation flows, set up save offers, recover failed payments, or implement retention strategies... For in-app upgrade paywalls, see paywall-upgrade-cro. »
- `revops/SKILL.md` — desc avant : « When the user wants help with revenue operations, lead lifecycle management, or marketing-to-sales handoff processes... For pricing decisions, see pricing-strategy. »
- `community-marketing/SKILL.md` — desc avant : « Build and leverage online communities to drive product growth and brand loyalty... "community flywheel." »
- `referral-program/SKILL.md` — desc avant : « When the user wants to create, optimize, or analyze a referral program, affiliate program, or word-of-mouth strategy... For launch-specific virality, see launch-strategy. »
- `aso-audit/SKILL.md` — desc avant : « When the user wants to audit or optimize an App Store or Google Play listing... Use when the user shares an App Store or Google Play URL and wants to improve it. »

## LOCK-23 — Skills méta surdimensionnés en solo

Phrase ajoutée (commune aux 4 skills) : « [LOCK-23] Sur AxionIA solo (Will), ce skill est utile mais peut être surdimensionné. Invoquer seulement quand pertinent. » (Variantes mineures : `subagent-driven-development` ajoute « (gros plans multi-tâches indépendantes) », `writing-skills` ajoute « (création/édition de nouveaux skills uniquement) ».)

- `subagent-driven-development/SKILL.md` — desc avant : « Use when executing implementation plans with independent tasks in the current session »
- `dispatching-parallel-agents/SKILL.md` — desc avant : « Use when facing 2+ independent tasks that can be worked on without shared state or sequential dependencies »
- `using-git-worktrees/SKILL.md` — desc avant : « Use when starting feature work that needs isolation from current workspace or before executing implementation plans - ensures an isolated workspace exists via native tools or git worktree fallback »
- `writing-skills/SKILL.md` — desc avant : « Use when creating new skills, editing existing skills, or verifying skills work before deployment »

---

## Récapitulatif

| LOCK      | Nb skills modifiés | Skills concernés                                                                                                                 |
| --------- | -----------------: | -------------------------------------------------------------------------------------------------------------------------------- |
| LOCK-01   |                  1 | web-design-guidelines                                                                                                            |
| LOCK-02   |                  1 | ui-ux-pro-max                                                                                                                    |
| LOCK-03   |                  1 | frontend-design                                                                                                                  |
| LOCK-04   |                  1 | copywriting                                                                                                                      |
| LOCK-05   |                  1 | copy-editing                                                                                                                     |
| LOCK-06   |                  1 | content-strategy                                                                                                                 |
| LOCK-07   |                  1 | page-cro                                                                                                                         |
| LOCK-08   |                  1 | form-cro                                                                                                                         |
| LOCK-09   |                  1 | popup-cro                                                                                                                        |
| LOCK-10   |                  1 | email-sequence                                                                                                                   |
| LOCK-11   |                  1 | cold-email                                                                                                                       |
| LOCK-12   |                  1 | seo-audit-marketing                                                                                                              |
| LOCK-13   |                  1 | ai-seo                                                                                                                           |
| LOCK-14   |                  1 | seo-hreflang                                                                                                                     |
| LOCK-15   |                  1 | seo-sitemap                                                                                                                      |
| LOCK-16   |                  1 | schema-markup                                                                                                                    |
| LOCK-17   |                  2 | seo-page, seo-drift                                                                                                              |
| LOCK-18   |                  1 | analytics-tracking                                                                                                               |
| LOCK-19   |                  1 | paid-ads                                                                                                                         |
| LOCK-20   |                  1 | owasp-security                                                                                                                   |
| LOCK-21   |                  1 | test-driven-development                                                                                                          |
| LOCK-22   |                  8 | signup-flow-cro, paywall-upgrade-cro, onboarding-cro, churn-prevention, revops, community-marketing, referral-program, aso-audit |
| LOCK-23   |                  4 | subagent-driven-development, dispatching-parallel-agents, using-git-worktrees, writing-skills                                    |
| **Total** |             **34** | —                                                                                                                                |

## Notes

- Les skills `_archive/seo-schema/` et `_archive/seo-flow/` n'ont PAS été touchés (déjà archivés).
- Les 18 skills `axionia-*`, `superpowers/using-superpowers`, `claude-md-improver`, `claude-automation-recommender` n'ont PAS été cadenassés (canon AxionIA propre, ou skills méta consentis).
- Aucune modification du corps des SKILL.md — uniquement la ligne `description:` (ou bloc YAML `>`) du frontmatter.
- Toutes les descriptions modifiées restent ≤ 1024 caractères.
