# 🎯 PROMPT MAÎTRE — Axion-IA · Audit total → Plan → Frontend → Backend

> 📌 **Lire d'abord [`_AUDIT/SYNC-NOTICE-2026-05-07.md`](./SYNC-NOTICE-2026-05-07.md)** : HEAD `fd91518` (post-Sprint 14.5-14.9). Sprints 0-14 + 14.5-14.9 livrés/pushés. Lift formation ban (ADR 0003), pivot doctrine v3 (ADR 0002), typography v3.1 (ADR 0004), 64 routes templates (vs 75 v1).
>
> Version 1.1 · 2026-05-06 · Auteur : Will + Claude Opus 4.7
> À coller tel quel dans une nouvelle session Claude Code lancée sur `C:\Users\willi\Documents\Projets\Axion-IA`.

---

Tu es l'architecte principal du projet **Axion-IA** (`C:\Users\willi\Documents\Projets\Axion-IA`). Ta mission est de livrer un site **parfait** : zéro incohérence, zéro régression SEO/AEO, mobile-first absolu, accessible WCAG 2.2 AA, conforme à toutes les décisions du **06/05/2026**. Tu travailles en mode **auto** avec validations courtes (« OUI / CONTINUE / STOP »).

> ⚠️ Source de vérité ultime : `Axion-IA_Dossier_FINAL_ABSOLU_v10.1/axionia-package/docs/_DECISIONS-FINALES.md`. En cas de conflit avec un autre fichier, ce document fait foi. Le `RAPPORT_AUDIT_v10.1.md` indique 404/404 checks verts au 06/05/2026 — toute régression doit être tracée.

---

## PHASE 0 — Préambule obligatoire (ne rien coder avant)

1. Charger systématiquement le skill **`axionia-core`**.
2. Lire **intégralement** :
   - `Axion-IA_Dossier_FINAL_ABSOLU_v10.1/CLAUDE.md`
   - `Axion-IA_Dossier_FINAL_ABSOLU_v10.1/axionia-package/docs/_DECISIONS-FINALES.md`
   - `Axion-IA_Dossier_FINAL_ABSOLU_v10.1/axionia-package/docs/25-Stack-Technique-v3.md`
   - `Axion-IA_Dossier_FINAL_ABSOLU_v10.1/axionia-package/docs/13-Infrastructure-v2.md`
   - `Navigation-Complete-Axion-IA.md` (sitemap + user flows)
   - `RAPPORT_AUDIT_v10.1.md`
   - Les 9 wireframes-briefs `Wireframes-Briefs-Axion-IA/00-08*.md`
3. Convertir et lire les **33 fichiers `.docx`** du dossier (utilise `python-docx` via Bash ou un script Node `mammoth`). Synthétise chaque doc en une fiche de 10 lignes max.
4. **Inventorier le mégapack de skills livré avec le projet** (88 skills) :
   - Path : `Axion-IA_Dossier_FINAL_ABSOLU_v10.1/axionia-megapack-skills/.claude/skills/`
   - **8 skills `axionia-*`** : core, design, mobile-first, stack, i18n, seo-aeo, forms, database.
   - **80 skills tiers** organisés en 5 familles (cf. `README.md` du mégapack) :
     - 🔵 Workflow (~14, pack superpowers) : `using-superpowers`, `brainstorming`, `writing-plans`, `executing-plans`, `subagent-driven-development`, `dispatching-parallel-agents`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `requesting-code-review`, `receiving-code-review`, `finishing-a-development-branch`, `using-git-worktrees`, `writing-skills`.
     - 🟣 SEO complet (~22) : `seo`, `seo-audit-marketing`, `seo-audit-technical`, `seo-page`, `seo-plan`, `seo-content`, `seo-cluster`, `seo-schema`, `seo-sitemap`, `seo-hreflang`, `seo-images`, `seo-image-gen`, `seo-local`, `seo-maps`, `seo-geo`, `seo-google`, `seo-dataforseo`, `seo-drift`, `seo-ecommerce`, `seo-flow`, `seo-sxo`, `seo-technical`, `seo-backlinks`, `seo-competitor-pages`, `seo-programmatic`, `ai-seo`, `schema-markup`, `programmatic-seo`, `site-architecture`.
     - 🟠 CRO / marketing (~30) : `page-cro`, `form-cro`, `popup-cro`, `signup-flow-cro`, `paywall-upgrade-cro`, `onboarding-cro`, `churn-prevention`, `copywriting`, `copy-editing`, `content-strategy`, `cold-email`, `email-sequence`, `ad-creative`, `paid-ads`, `lead-magnets`, `launch-strategy`, `directory-submissions`, `referral-program`, `co-marketing`, `community-marketing`, `customer-research`, `competitor-profiling`, `competitor-alternatives`, `marketing-ideas`, `marketing-psychology`, `pricing-strategy`, `product-marketing-context`, `revops`, `sales-enablement`, `social-content`, `analytics-tracking`, `ab-test-setup`, `aso-audit`, `free-tool-strategy`, `image`, `video`.
     - 🔴 Sécurité : `owasp-security`.
5. Lister les skills `axionia-*` **chargés en session** (12 attendus) et **comparer** au mégapack (8 présents). Détecter les 4 skills `axionia-*` cités en session mais absents du mégapack (probablement : `axionia-anti-spa`, `axionia-deployment`, `axionia-emails`, `axionia-a11y`) → vérifier leur source (`~/.claude/skills/` global ?) et trancher en PHASE 1.S où est leur canon.
6. **Recenser le repo `awesome-design-md-main/`** (60+ DESIGN.md de marques premium B2B : Stripe, Linear, Vercel, Notion, Sentry, Posthog, Mintlify, Cal, Cursor, Sanity, Webflow, Resend, Supabase, Mistral, x.ai, Cohere, Apple, Figma, Tesla, etc.). C'est de l'inspi visuelle exploitable pour fabriquer le `DESIGN.md` Axion-IA en Phase 2 (charte couleurs reportée → tokens neutres + parti pris validé via mix de design systems premium).

> Sortie de la phase 0 : un fichier `_AUDIT/00-fiches-lecture.md` regroupant les fiches docx (33) + wireframes (9) + docs racine (3) + inventaire mégapack (88 skills, ventilation 5 familles, écart session/mégapack chiffré) + index `awesome-design-md` (60+ marques classées par pertinence Axion-IA).

---

## PHASE 1 — Audit transversal documentaire

Effectuer chaque vérification ci-dessous, fichier par fichier, ligne par ligne. Tableau croisé en sortie.

### 1.A · Audit fichier-par-fichier

Pour chaque fichier (33 docx, 9 wireframes, CLAUDE.md, Navigation, \_DECISIONS-FINALES, 13-Infra, 25-Stack) :

- **Conformité aux 25 catégories** déjà passées en v10.1 (domaine, OÜ, URLs canoniques, header/footer, mobile-first, charte reportée, mot « formation » banni, etc.).
- **Détection de toute dérive** depuis la v10.1.
- **Citation `file_path:line_number`** pour chaque écart.

> Livrable : `_AUDIT/01-audit-coherence.md`

---

## PHASE 1.S — Audit complet du système de skills

> Livrable global : `_AUDIT/01s-skills-deep-audit.md` + 6 annexes ci-dessous. Aucune ligne de code n'est écrite avant validation Will.

### 1.S.1 · Inventaire exhaustif

Pour **chaque** skill visible dans la session (axionia-\* **ET** génériques), produire une fiche normalisée :

- `name`, `path` exact, `description` (verbatim), `allowed-tools`, `model`, taille en lignes.
- Date dernière modif (git log si versionné).
- Triggers explicites (mots-clés FR + EN) + triggers négatifs/exclusions.
- Dépendances : autres skills cités, fichiers projet cités.
- Annexe → `_AUDIT/01s-A-inventaire.md`.

### 1.S.2 · Audit qualité intrinsèque (par skill)

Grille **obligatoire** appliquée à chaque skill, scorée 0/1 :

1. Frontmatter complet et valide (`name`, `description` ≤ 1024 car., pas de typo).
2. Description **actionable** — décrit _quand_ charger, pas seulement _quoi_.
3. Règles **testables** (chaque assertion peut être vérifiée mécaniquement).
4. Aucune ambiguïté (« si possible », « idéalement », « éventuellement » → red flag).
5. Exemples concrets ✅ et anti-exemples ❌ présents pour les règles non triviales.
6. Pas de duplication interne (la même règle énoncée 2× dans le même fichier).
7. Pas de référence à un fichier/path qui n'existe plus.
8. Pas de citation périmée par rapport à `_DECISIONS-FINALES.md` (06/05/2026).
9. Style cohérent (FR, ton directif, listes plutôt que prose, ≤ 200 lignes utiles).
10. Pas de fuite secret/clé API/URL interne.

Sortie : tableau **score / 10** par skill + plan de correction. Annexe → `_AUDIT/01s-B-qualite.md`.

### 1.S.3 · Matrice de cohérence inter-skills

Matrice **N×N** sur les 12 skills `axionia-*` **et** sur tous les skills génériques pertinents (`page-cro`, `copywriting`, `web-design-guidelines`, `seo-audit-marketing`, `seo-schema`, `ai-seo`, `schema-markup`, `analytics-tracking`, `brainstorming`, `owasp-security`, `verification-before-completion`, `executing-plans`, `writing-plans`, `subagent-driven-development`, `test-driven-development`, `systematic-debugging`).

Cellules :

- ✅ **complémentaires** — préciser qui fait quoi.
- 🔁 **redondants** — la règle est dans les deux ; choisir le canon, supprimer l'autre.
- ⚠️ **chevauchent** — préciser qui prime + l'écrire dans les deux skills.
- ❌ **contradictoires** — résolution immédiate, source de vérité = `axionia-core` puis `_DECISIONS-FINALES.md`.

Cas explicites à instruire **obligatoirement** (chacun a un risque réel de conflit) :

- `axionia-design` ↔ `web-design-guidelines` (génériques peuvent suggérer gradients/glassmorphism interdits chez Axion-IA).
- `axionia-seo-aeo` ↔ `seo-audit-marketing` / `ai-seo` / `schema-markup` / `seo-schema` / `seo-page` (les génériques ne savent pas que `formation` est banni, que la société est OÜ, ni les URLs canoniques FR/EN).
- `axionia-stack` ↔ choix par défaut des skills génériques (un skill `copywriting` peut conseiller Resend/Mailchimp, interdits).
- `axionia-emails` ↔ `email-sequence` / `cold-email` (génériques supposent ESP type Resend ; Axion-IA = PowerMTA + MailWizz maison).
- `axionia-forms` ↔ `form-cro` / `signup-flow-cro` / `popup-cro` (les génériques peuvent pousser des patterns SPA interdits par `axionia-anti-spa`).
- `axionia-i18n` ↔ `seo-hreflang` (qui prime sur la génération hreflang).
- `axionia-mobile-first` ↔ `axionia-design` ↔ `axionia-a11y` (touch targets 44×44 et focus visible : trois fois mentionné, doit être canon une seule fois).
- `axionia-anti-spa` ↔ tous les skills génériques de marketing CRO qui supposent du JS client.
- `axionia-database` ↔ futur `axionia-content-models` (qui définit les schémas FR/EN suffixe vs JSONB).
- `owasp-security` ↔ `axionia-deployment` (headers CSP, qui les définit ?).
- `brainstorming` / `writing-plans` / `executing-plans` ↔ ce prompt maître (cadence et checkpoints).

Annexe → `_AUDIT/01s-C-matrice.md` (CSV + Mermaid).

### 1.S.4 · Audit harmonie & conventions

Vérifier que **tous** les skills `axionia-*` partagent :

- Même ton (directif, FR, tu/vous cohérent — trancher).
- Même vocabulaire métier (« intervention » jamais « formation », « OÜ estonienne », « Implémentation IA », « Cas concrets »).
- Mêmes conventions de citation des fichiers projet (`docs/_DECISIONS-FINALES.md` plutôt que numéros de doc qui peuvent bouger).
- Même structure de SKILL.md (titre, contexte, règles, exemples ✅/❌, anti-patterns, checklist finale).
- Mêmes ancres pour les triggers (mots-clés FR + EN).
- Aucun emoji décoratif (sauf marqueurs ✅/❌/⚠️ structurés).

Annexe → `_AUDIT/01s-D-harmonie.md`.

### 1.S.5 · Tests de déclenchement (skill firing)

Pour chaque skill, écrire **3 prompts utilisateur synthétiques** qui _doivent_ le faire matcher et **3 qui doivent l'exclure**. Lancer mentalement le router pour vérifier :

- Aucun skill ne « capture » un prompt qui devrait aller à un autre.
- Pas de double matching parasite (`axionia-design` + `web-design-guidelines` simultanément sans hiérarchie).

Sortie : table de vérité 12 skills × 6 prompts. Annexe → `_AUDIT/01s-E-firing.md`.

### 1.S.6 · Règle de priorité (skill precedence)

Inscrire dans `axionia-core` **et nulle part ailleurs** la règle de précédence officielle :

1. `_DECISIONS-FINALES.md` > tout.
2. `axionia-core` > tous les autres skills.
3. `axionia-*` > skills génériques sur tout sujet projet.
4. Skills génériques utilisés uniquement pour leur spécialité (ex. `owasp-security` pour la check-list OWASP, mais `axionia-deployment` tranche les headers réels).
5. En cas de conflit non résolu → STOP & ASK Will.

Cette règle est unique, citée par référence dans tous les autres skills, jamais dupliquée.

### 1.S.7 · Skills manquants & doublons à supprimer

- Liste des skills manquants à créer : `axionia-architecture`, `axionia-testing`, `axionia-admin-console`, `axionia-content-models`, `axionia-payments` ou doc « no-stripe », `axionia-observability`, `axionia-performance`, **`axionia-anti-spa`**, **`axionia-deployment`**, **`axionia-emails`**, **`axionia-a11y`** (ces 4 derniers s'ils ne sont effectivement pas dans le mégapack — à confirmer phase 0 §5).
- Liste des skills à **supprimer ou archiver** parce que redondants avec un `axionia-*` (ex. neutraliser `web-design-guidelines` si présent global, neutraliser `seo-audit-marketing` au profit de `axionia-seo-aeo` sur le scope projet, etc.).
- Liste des skills à **garder mais cadenasser** par une note dans leur description (« sur Axion-IA, voir `axionia-X` pour les overrides »).
- **Décision sur les 22 skills SEO du mégapack** : lesquels garder actifs sur Axion-IA (à mon avis : `seo-schema`, `seo-hreflang`, `seo-sitemap`, `seo-page`, `seo-drift`, `seo-google`, `ai-seo`, `schema-markup`), lesquels désactiver projet-level (`seo-ecommerce`, `seo-local`, `seo-maps`, `seo-backlinks`, `seo-dataforseo` si pas de compte → trancher).
- **Décision sur les 30 skills CRO/marketing** : actifs (`page-cro`, `form-cro`, `popup-cro`, `signup-flow-cro` non applicable car pas de signup public, `copywriting`, `copy-editing`, `content-strategy`, `email-sequence`, `lead-magnets`, `launch-strategy`, `competitor-profiling`, `competitor-alternatives`, `analytics-tracking`, `ab-test-setup`), désactiver les inutiles à un site vitrine B2B premium (`paywall-upgrade-cro`, `onboarding-cro`, `churn-prevention`, `aso-audit`, `cold-email` selon stratégie outbound).

Annexe → `_AUDIT/01s-F-actions.md`.

### 1.S.8 · Sortie finale phase 1.S

- Score global qualité (moyenne /10 sur les 12 skills `axionia-*`).
- Liste **ordonnée** des corrections à appliquer (P0 contradictions, P1 chevauchements, P2 doublons, P3 harmonie).
- **STOP & ASK Will** : valider la règle de précédence + la liste des skills à créer/supprimer/cadenasser **avant** d'écrire le moindre composant React.

---

## PHASE 2 — Plan d'implémentation maître + Skill `axionia-architecture`

### 2.0 · Créer `DESIGN.md` Axion-IA (avant tout code visuel)

À la racine du futur repo Next.js. Source de vérité visuelle du projet (la charte couleurs étant officiellement reportée — cf. doc 02 — il faut un parti pris défendable et révocable).

Procédure :

1. Lire **8 à 12 DESIGN.md** sélectionnés dans `awesome-design-md-main/awesome-design-md-main/design-md/` parmi les marques premium B2B alignées au positionnement « McKinsey/Roland Berger sobriété » : **stripe, linear.app, vercel, notion, sentry, mintlify, cal, cursor, sanity, posthog, supabase, mistral.ai**. (Éviter les marques grand public émotionnelles : ferrari, lamborghini, nike, etc.)
2. Extraire pour chacun : palette, typographie, scale d'espacement, motion principles, verbes de marque, anti-patterns visuels.
3. Synthétiser un `DESIGN.md` Axion-IA :
   - Tokens CSS variables provisoires (charte officielle reportée → noter explicitement « provisoire, valider avec Will »).
   - Typographie (probable : Inter ou Geist + une serif pour les titres ?).
   - Spacing scale (4-8-12-16-24-32-48-64-96).
   - Motion principles (ease-out 200-300ms, `prefers-reduced-motion` strict).
   - Anti-patterns Axion-IA (pas de gradients gratuits, pas de glassmorphism, 80 % blanc dominant, jamais d'emoji décoratif, jamais de stock photo).
   - Photographic style (B&W ou desaturé léger pour humains, geometric abstract sinon).
4. Mettre à jour `axionia-design` pour pointer vers ce `DESIGN.md` comme source unique des tokens.

> **STOP & ASK Will** : valider le `DESIGN.md` avant tout composant.

### 2.A · Créer le skill `axionia-architecture`

Sous `~/.claude/skills/axionia-architecture/SKILL.md`. Il doit contenir :

- Arborescence Next.js 15 App Router complète (`/app/[locale]/...`, `/components`, `/lib`, `/server`, `/messages`, `/prisma`, `/emails`, `/scripts`, `/tests`).
- Conventions : Server Components par défaut, `'use client'` justifié, dossiers `_components` privés, `(group)` pour layouts, route handlers vs server actions, naming kebab-case URLs / PascalCase components / camelCase fns.
- Frontière server/client codifiée (zéro fetch dans `useEffect`, `generateMetadata` partout).
- Pattern de feature : `feature/{intervention,audit,implementation,blog,…}` avec `schemas.ts` Zod, `actions.ts` (server actions), `components/`, `queries.ts` Prisma.
- Définition stricte du « Definition of Done » d'une page : SEO + a11y + i18n + tests + Lighthouse.

### 2.B · Plan d'implémentation `_AUDIT/02-PLAN.md`

Découpé en jalons (M1…Mn), chacun avec : objectif · prérequis · livrables · DoD · estimation · risques.

- M1 — Setup repo + stack
- M2 — Design tokens + composants UI atomiques shadcn
- M3 — Header/Footer + Layout `[locale]` + i18n
- M4 — Pages publiques (par module, ordre ci-dessous)
- M5 — Formulaires multi-step + Calendrier maison + Simulateur ROI
- M6 — Pages transversales + légales + blog templates
- M7 — Schémas SEO/AEO/JSON-LD + sitemap + robots + llms.txt + IndexNow
- M8 — Backend : Prisma + Auth.js + server actions + BullMQ + email maison
- M9 — Console admin (14 sections)
- M10 — Tests E2E + Lighthouse CI + sécurité (OWASP/Turnstile/CSP)
- M11 — Déploiement Hetzner + Coolify + Cloudflare + monitoring

### 2.C · Mapping page-par-page (≈170 routes)

Fichier `_AUDIT/02b-mapping-pages.md`. Pour **chaque** route du Navigation-Complete :

- Slug FR + EN
- Type (listing, produit, transversal, légal, admin, système)
- Server Components requis
- Données (Prisma / static MDX / messages i18n)
- JSON-LD à émettre
- États spéciaux (vide, erreur, loading)
- Composants partagés réutilisés
- Page de référence dans les wireframes-briefs

> **STOP & ASK** : valider le plan avant Phase 3.

---

## PHASE 3 — Frontend de bout en bout

> ⛓️ Charger systématiquement avant tout fichier React/TSX : `axionia-core` + `axionia-anti-spa` + `axionia-mobile-first` + `axionia-design` + `axionia-i18n` + `axionia-a11y` + `axionia-seo-aeo`.

### 3.0 · Setup

- `pnpm create next-app@latest` Next.js 15 App Router + TS strict.
- Installer : Tailwind v4, shadcn/ui, RHF, Zod, TanStack Query, Zustand, motion, lucide-react, next-intl 3, Auth.js v5, Tiptap, React Email, Nodemailer, `@t3-oss/env-nextjs`, `@vercel/og`.
- Husky + Commitlint + ESLint + Prettier + `eslint-plugin-jsx-a11y` + axe-core (dev) + Lighthouse CI.
- Vitest + Playwright + `@axe-core/playwright`.
- Prisma 5 init (mais pas de migration runtime cette phase).
- `messages/fr.json` + `messages/en.json` (clés vides initiales).

### 3.1 · Design tokens & composants atomiques

- Variables CSS (charte reportée → tokens neutres `--ink-*`, `--bg-*`, `--accent-*` avec valeurs provisoires documentées).
- Boutons, inputs, card, dialog, sheet, dropdown, tooltip, badge, alert — version shadcn customisée.
- Composant `<I18nLink>`, `<LocaleSwitcher>`, `<SkipToContent>`.
- Tests Vitest sur chaque composant atomique.

### 3.2 · Header + Footer + Layout racine

- Header **5 items** sans dropdown : Interventions · Audit · Implémentation · Cas concrets · CTA central « Réserver une intervention · 490 € » + sélecteur FR·EN.
- Footer 5 zones (Identité · Services · Ressources · Entreprise · Légal), Blog dans Ressources.
- Skip-to-content + focus visible + touch targets 44×44.
- Layout `app/[locale]/layout.tsx` avec `generateMetadata`, hreflang FR↔EN, JSON-LD `Organization` + `WebSite` + `BreadcrumbList`.

### 3.3 · Pages publiques (à coder dans cet ordre exact)

Pour **chaque** page : (1) wireframe-brief de référence, (2) `generateMetadata`, (3) JSON-LD adapté, (4) version FR + EN via next-intl, (5) Server Component par défaut, (6) test Playwright golden path + a11y axe, (7) Lighthouse mobile ≥ 95 perf/SEO/a11y.

1. **Accueil** `/[locale]` (cf. wireframe `02-Page-Accueil.md`).
2. **Module 1 — Interventions** : `/interventions` (listing) → `/interventions/essentielle` (page phare, conversion principale) → `/equipes` → `/managers` → `/conference` → `/dirigeants`.
3. **Module 2 — Audit** : `/audit` → `/complet` → `/departement` → `/point-de-vente` → `/cabinet`.
4. **Module 3 — Implémentation IA** (10 écrans listés Navigation-Complete §1.2 module 3).
5. **Cas concrets** : listing + template `[slug]`.
6. **Pages transversales** : À propos (doc 30), Guide d'utilisation (doc 32), Blog listing + template article + catégories, Page essentielle (cf. wireframe 03), Sous-catégories (doc 20), Pages dédiées (docs 11+21).
7. **Pages légales** (6 pages — doc 28 + doc 31, mentions OÜ estonienne, jamais de SIREN).
8. **Calendrier maison** (wireframe 04, doc 24) — composant + page de réservation autonome.
9. **Simulateur ROI** (wireframe 05, doc 23).
10. **Formulaires multi-step** (wireframe 06) : audit 5 étapes, implémentation 4 étapes, contact, newsletter, réservation. Chargement skill `axionia-forms`.
11. **Pages système** : 404, 500, maintenance, robots/sitemap/llms.txt/IndexNow.

### 3.4 · Validation par module (à chaque fin de module)

- `pnpm test`, `pnpm test:e2e`, `pnpm lhci autorun` sur les pages du module.
- Rapport `_AUDIT/03-frontend-progress.md` mis à jour.
- **STOP & ASK** entre chaque module pour validation Will.

> **Fin de Phase 3** : aucune route ne doit dépendre du backend pour s'afficher (mocks via fixtures Zod). On doit pouvoir naviguer tout le site, FR + EN, sans erreur, sans `'use client'` injustifié, sans console error.

---

## PHASE 4 — Backend de bout en bout

> ⛓️ Charger : `axionia-database` + `axionia-stack` + `axionia-emails` + `axionia-forms` + `axionia-deployment` + `owasp-security`.

### 4.1 · Données

- Schéma Prisma exhaustif (tables doc 09 + 09b + 09c) : `submissions`, `bookings`, `articles`, `faqs`, `testimonials`, `case_studies`, `help_articles`, `calendar_options`, `users`, + jointures.
- Champs FR/EN suffixés `_fr`/`_en` ou JSONB `i18n`. Trancher dans le skill `axionia-database` et appliquer.
- Migrations versionnées + seeders FR/EN.
- FTS Postgres (tsvector + GIN) sur articles + case studies + help.
- Backups : script `scripts/db-backup.sh` cron quotidien vers Storage Box.

### 4.2 · Auth & sécurité

- Auth.js v5 (admin uniquement) + 2FA TOTP.
- Middleware rate-limit Redis sur formulaires (BullMQ + Upstash-style local).
- Cloudflare Turnstile sur tous les forms publics.
- Headers : CSP stricte, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy.
- OWASP Top 10 + ASVS 5.0 — passe complète via skill `owasp-security`.

### 4.3 · Server actions + API

Une server action par feature (audit/intervention/implementation/contact/newsletter/booking) :

- Validation Zod côté serveur identique au client.
- Persistence Prisma.
- Enqueue BullMQ : email confirmation + Telegram tag-based.
- Idempotence + erreurs typées + télémétrie Sentry.

### 4.4 · Email maison

- Templates React Email FR + EN pour : confirmation soumission audit, confirmation réservation, notification interne, newsletter double-opt-in, relance.
- Nodemailer pointant sur PowerMTA local (port interne).
- DKIM 2048 + SPF strict + DMARC `p=quarantine` puis `reject` une fois warmup ok.
- Job warmup IP (skill `axionia-emails`).
- Webhooks bounce/complaint → marquer `users.email_status`.

### 4.5 · Console admin (14 sections — doc 08)

Sous `/[ADMIN_URL_PREFIX]` (variable env). Auth obligatoire. Charger skill `axionia-admin-console` (à créer phase 1.S.7).

- Dashboard, Soumissions, Réservations, Articles (Tiptap), FAQs, Témoignages, Cas concrets, Help center, Calendrier, Utilisateurs admin, Logs, Email campaigns (MailWizz iframe), Paramètres, Audit log.

### 4.6 · Tests backend

- Vitest sur server actions, queries, validators.
- Playwright sur flux end-to-end : soumission audit → email reçu (Mailpit local) → admin voit la ligne.

> **STOP & ASK** : démo des flux complets avant Phase 5.

---

## PHASE 5 — Déploiement, monitoring, finalisation

- VPS Hetzner CX32 + Coolify (compose).
- Cloudflare proxy + WAF + cache rules + Turnstile siteverify.
- Caddy/Traefik SSL auto.
- Plausible + Sentry self-hosted + Uptime Kuma.
- GitHub Actions : lint + typecheck + test unit + build + Lighthouse CI + Playwright + déploiement Coolify webhook.
- Backups Postgres horaire + sync Storage Box.
- Runbook `_AUDIT/05-runbook.md` (rollback, restauration backup, rotation DKIM, incident emails).

---

## RÈGLES TRANSVERSES — non négociables

- ❌ Mot « formation » / « formateur » / « former » — bannis partout (skill `axionia-core`).
- ✅ Mobile-first absolu — toute classe Tailwind écrite mobile d'abord.
- ✅ Société estonienne (OÜ) — aucun SIREN/SIRET/RCS, fiscalité estonienne EE, langues FR (principal) + EN.
- ✅ FR rédigé en premier, EN s'adapte. Tout texte via `next-intl`, **jamais en dur**.
- ✅ Server Components par défaut, `'use client'` uniquement justifié en commentaire.
- ✅ `generateMetadata` sur **chaque** page, hreflang systématique, JSON-LD adapté.
- ✅ Lighthouse mobile ≥ 95 (perf, SEO, a11y, best-practices) sur **chaque** page produit.
- ✅ A11y : focus visible, `prefers-reduced-motion` respecté, contrastes AA, touch targets 44×44, aria-\* corrects.
- ✅ Charte couleurs reportée → tokens neutres provisoires, jamais de couleur en dur.
- ✅ Aucune dépendance Stripe / Resend / Vercel / SaaS payant non listé dans `_DECISIONS-FINALES.md`.
- ✅ Commits atomiques + Conventional Commits + PR par jalon, jamais `--no-verify`.

---

## LIVRABLES OBLIGATOIRES

| Phase | Livrable                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------ |
| 0     | `_AUDIT/00-fiches-lecture.md`                                                                    |
| 1     | `_AUDIT/01-audit-coherence.md`                                                                   |
| 1.S   | `_AUDIT/01s-skills-deep-audit.md` + annexes A→F                                                  |
| 2     | `DESIGN.md` racine + Skill `axionia-architecture` + `_AUDIT/02-PLAN.md` + `02b-mapping-pages.md` |
| 3     | Frontend complet + `_AUDIT/03-frontend-progress.md`                                              |
| 4     | Backend complet + `_AUDIT/04-backend-progress.md`                                                |
| 5     | Déploiement live + `_AUDIT/05-runbook.md`                                                        |

---

## CADENCE DE TRAVAIL

1. **Mode auto** — exécute, ne demande que pour décisions structurantes ou actions destructrices.
2. **Checkpoint à la fin de chaque phase** : un rapport ≤ 200 mots + question fermée « OUI / CONTINUE / STOP ».
3. **TaskList tenue à jour** (TaskCreate/TaskUpdate) — une tâche par jalon, sous-tâches par page/skill.
4. **Sauvegardes mémoire** automatiques pour décisions structurelles (autorisé par Will).
5. **Aucune fonctionnalité non spécifiée** dans les docs n'est ajoutée sans demande explicite.

> **Démarre maintenant par la PHASE 0**. Confirme-moi en 5 lignes max ce que tu vas lire et reviens avec `_AUDIT/00-fiches-lecture.md`.
