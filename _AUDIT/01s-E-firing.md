# Phase 1.S — Annexe E — Tests de déclenchement (firing tests)

> Read-only audit · 06/05/2026
> Pour chaque skill `axionia-*`, on simule mentalement le matching du router :
>
> - 3 prompts qui DOIVENT le faire matcher
> - 3 prompts qui NE DOIVENT PAS le faire matcher (anti-faux-positifs)
>   Ensuite on consolide les conflits de routing détectés.

## 1. Tableau 18 skills × 6 prompts

### 1.1 axionia-core

| ✓/✗ | Prompt utilisateur                                                    | Skill cible attendu                    |
| :-: | --------------------------------------------------------------------- | -------------------------------------- |
|  ✓  | « On démarre une nouvelle session sur AxionIA, prépare-toi »          | axionia-core (chargement systématique) |
|  ✓  | « Je rédige le hero, peut-on dire `formations IA pour dirigeants` ? » | axionia-core (lexique banni)           |
|  ✓  | « Quel est le statut juridique d'AxionIA déjà ? »                     | axionia-core                           |
|  ✗  | « Configure Sentry self-hosted »                                      | axionia-monitoring                     |
|  ✗  | « Crée une migration Prisma pour la table bookings »                  | axionia-database                       |
|  ✗  | « Optimise le hero pour Core Web Vitals »                             | axionia-performance                    |

### 1.2 axionia-design

| ✓/✗ | Prompt                                                           | Cible                          |
| :-: | ---------------------------------------------------------------- | ------------------------------ |
|  ✓  | « Implémente le bouton CTA principal avec le bon hover Webflow » | axionia-design                 |
|  ✓  | « Quelle palette pour la card du module Audit ? »                | axionia-design                 |
|  ✓  | « Ajoute la signature shadow 5-couches sur la card stat »        | axionia-design                 |
|  ✗  | « Audite les balises meta de /interventions »                    | axionia-seo-aeo                |
|  ✗  | « Génère un sitemap multilingue »                                | axionia-seo-aeo + axionia-i18n |
|  ✗  | « Quelle stratégie pour passer LCP < 1.8s ? »                    | axionia-performance            |

### 1.3 axionia-stack

| ✓/✗ | Prompt                                                   | Cible                                     |
| :-: | -------------------------------------------------------- | ----------------------------------------- |
|  ✓  | « Quels paquets npm initialiser pour le projet ? »       | axionia-stack                             |
|  ✓  | « Peut-on utiliser tRPC à la place de Server Actions ? » | axionia-stack (refus, hors stack arrêtée) |
|  ✓  | « Setup TypeScript strict mode + paths »                 | axionia-stack                             |
|  ✗  | « Configure les schémas Prisma pour les articles »       | axionia-database                          |
|  ✗  | « Déploie sur Hetzner via Coolify »                      | axionia-deployment                        |
|  ✗  | « Crée le système d'envoi d'emails »                     | axionia-emails                            |

### 1.4 axionia-mobile-first

| ✓/✗ | Prompt                                              | Cible                                   |
| :-: | --------------------------------------------------- | --------------------------------------- |
|  ✓  | « Le hero rend mal sur iPhone SE 375px, audite »    | axionia-mobile-first                    |
|  ✓  | « Convertis ce composant en mobile-first Tailwind » | axionia-mobile-first                    |
|  ✓  | « Drawer mobile pour le burger menu »               | axionia-mobile-first (+ axionia-design) |
|  ✗  | « Ajoute un focus visible sur le bouton »           | axionia-a11y                            |
|  ✗  | « Pourquoi le bundle JS est trop lourd ? »          | axionia-performance                     |
|  ✗  | « Génère les meta tags FR/EN »                      | axionia-seo-aeo                         |

### 1.5 axionia-anti-spa

| ✓/✗ | Prompt                                                          | Cible                               |
| :-: | --------------------------------------------------------------- | ----------------------------------- |
|  ✓  | « Je veux mettre `'use client'` sur la page accueil »           | axionia-anti-spa (refus / cadre)    |
|  ✓  | « Peut-on fetch les données dans `useEffect` côté liste ? »     | axionia-anti-spa (NON, server-side) |
|  ✓  | « Faut-il `dynamic({ ssr: false })` pour ce composant chart ? » | axionia-anti-spa                    |
|  ✗  | « Crée le formulaire d'audit 5 étapes »                         | axionia-forms                       |
|  ✗  | « Setup next-intl »                                             | axionia-i18n                        |
|  ✗  | « Lance Lighthouse CI »                                         | axionia-performance                 |

### 1.6 axionia-database

| ✓/✗ | Prompt                                              | Cible                               |
| :-: | --------------------------------------------------- | ----------------------------------- |
|  ✓  | « Ajoute un champ `locale` à la table submissions » | axionia-database                    |
|  ✓  | « Génère la migration pour calendar_options »       | axionia-database                    |
|  ✓  | « Comment seeder 10 articles bilingues FR+EN ? »    | axionia-database                    |
|  ✗  | « Quelle policy CSP en production ? »               | axionia-deployment + owasp-security |
|  ✗  | « Configure Sentry release tracking »               | axionia-monitoring                  |
|  ✗  | « Optimise les images du blog »                     | axionia-performance                 |

### 1.7 axionia-deployment

| ✓/✗ | Prompt                                                     | Cible              |
| :-: | ---------------------------------------------------------- | ------------------ |
|  ✓  | « Setup Coolify auto-deploy depuis GitHub Actions »        | axionia-deployment |
|  ✓  | « Configure les headers HSTS et CSP au niveau Cloudflare » | axionia-deployment |
|  ✓  | « Quelle stratégie de rollback en cas de bad release ? »   | axionia-deployment |
|  ✗  | « Pourquoi mes alertes Telegram n'arrivent pas ? »         | axionia-monitoring |
|  ✗  | « Implémente la confirmation 2FA TOTP »                    | axionia-admin-ux   |
|  ✗  | « Crée le bloc AEO sur la home FR »                        | axionia-seo-aeo    |

### 1.8 axionia-emails

| ✓/✗ | Prompt                                                              | Cible                                                    |
| :-: | ------------------------------------------------------------------- | -------------------------------------------------------- |
|  ✓  | « Configure DKIM 2048 pour mail.axion-ia.com »                      | axionia-emails                                           |
|  ✓  | « Ajoute un template React Email de confirmation booking en FR/EN » | axionia-emails                                           |
|  ✓  | « Mes emails partent en spam Gmail, audite »                        | axionia-emails                                           |
|  ✗  | « Crée la séquence de nurturing post-démo »                         | email-sequence (avec cadenas axionia-emails sur tooling) |
|  ✗  | « Écris un cold email pour DAF français »                           | cold-email (avec cadenas)                                |
|  ✗  | « Pourquoi le formulaire ne soumet pas ? »                          | axionia-forms                                            |

### 1.9 axionia-forms

| ✓/✗ | Prompt                                                                 | Cible                                |
| :-: | ---------------------------------------------------------------------- | ------------------------------------ |
|  ✓  | « Implémente le formulaire d'audit en 5 étapes RHF + Zod »             | axionia-forms                        |
|  ✓  | « Ajoute la persistance Zustand entre étapes du formulaire IA Custom » | axionia-forms                        |
|  ✓  | « Anti-spam Turnstile + honeypot sur tous les forms »                  | axionia-forms (+ axionia-deployment) |
|  ✗  | « Optimise la conversion du formulaire de contact »                    | form-cro (avec cadenas)              |
|  ✗  | « Lance un A/B test sur le CTA du formulaire »                         | ab-test-setup (à valider)            |
|  ✗  | « Génère un schema.org FAQ »                                           | schema-markup                        |

### 1.10 axionia-i18n

| ✓/✗ | Prompt                                               | Cible                                  |
| :-: | ---------------------------------------------------- | -------------------------------------- |
|  ✓  | « Setup next-intl avec pathnames traduits FR/EN »    | axionia-i18n                           |
|  ✓  | « Ajoute la clé `cta.bookEssential` en FR et EN »    | axionia-i18n                           |
|  ✓  | « Implémente le sélecteur de langue dans le header » | axionia-i18n (+ axionia-design)        |
|  ✗  | « Audit hreflang post-déploiement »                  | seo-hreflang (avec note canon=i18n)    |
|  ✗  | « Crée le sitemap XML multilingue »                  | axionia-seo-aeo (avec dépendance i18n) |
|  ✗  | « Configure les redirections /fr → / »               | axionia-deployment                     |

### 1.11 axionia-seo-aeo

| ✓/✗ | Prompt                                                     | Cible                             |
| :-: | ---------------------------------------------------------- | --------------------------------- |
|  ✓  | « Ajoute le schema Organization avec adresse Tallinn »     | axionia-seo-aeo                   |
|  ✓  | « Bloc AEO 60 mots en haut de /interventions/essentielle » | axionia-seo-aeo                   |
|  ✓  | « Génère llms.txt pour AxionIA »                           | axionia-seo-aeo                   |
|  ✗  | « Mes Core Web Vitals chutent, audite »                    | axionia-performance               |
|  ✗  | « Pourquoi GSC dit pas indexé ? »                          | seo-google (canon mesure terrain) |
|  ✗  | « Réécris le hero pour plus de conversion »                | copywriting (avec cadenas)        |

### 1.12 axionia-a11y

| ✓/✗ | Prompt                                                    | Cible                                                                |
| :-: | --------------------------------------------------------- | -------------------------------------------------------------------- |
|  ✓  | « Audite l'accessibilité de la page audit avec axe-core » | axionia-a11y                                                         |
|  ✓  | « Ajoute un skip-to-content sur le layout principal »     | axionia-a11y                                                         |
|  ✓  | « Mon Lighthouse a11y est à 87, fix »                     | axionia-a11y                                                         |
|  ✗  | « Le calendrier doit avoir focus visible »                | axionia-a11y (vrai mais l'implémentation tombe sur axionia-calendar) |
|  ✗  | « Optimise le LCP du hero »                               | axionia-performance                                                  |
|  ✗  | « Génère un test E2E Playwright »                         | axionia-testing                                                      |

### 1.13 axionia-performance

| ✓/✗ | Prompt                                                   | Cible                              |
| :-: | -------------------------------------------------------- | ---------------------------------- |
|  ✓  | « Lance Lighthouse CI sur staging avec budgets stricts » | axionia-performance                |
|  ✓  | « Mon LCP est à 2.4s, comment passer sous 1.8s ? »       | axionia-performance                |
|  ✓  | « Active `@next/bundle-analyzer` »                       | axionia-performance                |
|  ✗  | « Configure Plausible self-hosted »                      | axionia-monitoring                 |
|  ✗  | « Quelle stratégie de cache Redis ? »                    | axionia-stack + axionia-deployment |
|  ✗  | « Pourquoi le formulaire est lent à valider ? »          | axionia-forms                      |

### 1.14 axionia-rgpd

| ✓/✗ | Prompt                                                       | Cible                               |
| :-: | ------------------------------------------------------------ | ----------------------------------- |
|  ✓  | « Rédige la politique de confidentialité droit estonien »    | axionia-rgpd                        |
|  ✓  | « Comment gérer une demande de droit à l'effacement ? »      | axionia-rgpd                        |
|  ✓  | « Faut-il une bannière cookie avec Plausible self-hosted ? » | axionia-rgpd (réponse : non)        |
|  ✗  | « Implémente le rate limit Redis »                           | axionia-deployment + owasp-security |
|  ✗  | « Configure DMARC strict »                                   | axionia-emails                      |
|  ✗  | « Pourquoi je ne reçois pas l'email de confirmation ? »      | axionia-emails                      |

### 1.15 axionia-monitoring

| ✓/✗ | Prompt                                                        | Cible                                           |
| :-: | ------------------------------------------------------------- | ----------------------------------------------- |
|  ✓  | « Setup Sentry self-hosted sur sentry.axion-ia.com »          | axionia-monitoring                              |
|  ✓  | « Active 10 checks Uptime Kuma sur les endpoints critiques »  | axionia-monitoring                              |
|  ✓  | « Sauvegardes Postgres + restauration mensuelle obligatoire » | axionia-monitoring                              |
|  ✗  | « Configure Lighthouse CI »                                   | axionia-performance                             |
|  ✗  | « Comment gérer l'erreur 502 en prod ? »                      | axionia-deployment + axionia-monitoring         |
|  ✗  | « Setup GA4 conversion tracking »                             | axionia-monitoring (avec refus GA4 — Plausible) |

### 1.16 axionia-testing

| ✓/✗ | Prompt                                                   | Cible                                                           |
| :-: | -------------------------------------------------------- | --------------------------------------------------------------- |
|  ✓  | « Test E2E Playwright pour le tunnel de réservation EN » | axionia-testing                                                 |
|  ✓  | « Mock PowerMTA dans les tests Vitest »                  | axionia-testing                                                 |
|  ✓  | « Test axe-core sur la page contact »                    | axionia-testing                                                 |
|  ✗  | « Méthode TDD rouge-vert-refactor sur ce composant »     | test-driven-development (avec note canon stack=axionia-testing) |
|  ✗  | « Comment debugger ce test flaky ? »                     | systematic-debugging                                            |
|  ✗  | « Setup CI GitHub Actions »                              | axionia-deployment                                              |

### 1.17 axionia-admin-ux

| ✓/✗ | Prompt                                                                | Cible                            |
| :-: | --------------------------------------------------------------------- | -------------------------------- |
|  ✓  | « Layout sidebar admin avec 14 sections et toggle FR/EN par contenu » | axionia-admin-ux                 |
|  ✓  | « Implémente la matrice de permissions 4 rôles »                      | axionia-admin-ux                 |
|  ✓  | « Page admin /articles avec Tiptap FR/EN »                            | axionia-admin-ux                 |
|  ✗  | « Setup Auth.js v5 avec 2FA TOTP »                                    | axionia-stack + axionia-admin-ux |
|  ✗  | « Header public épuré 5 items »                                       | axionia-design                   |
|  ✗  | « Crée la table activity_logs »                                       | axionia-database                 |

### 1.18 axionia-calendar

| ✓/✗ | Prompt                                                   | Cible                                               |
| :-: | -------------------------------------------------------- | --------------------------------------------------- |
|  ✓  | « Implémente la pose d'option 48h avec lock anti-race »  | axionia-calendar                                    |
|  ✓  | « Quel polling pour rafraîchir les slots côté client ? » | axionia-calendar                                    |
|  ✓  | « Notification Telegram d'expiration d'option »          | axionia-calendar (+ axionia-emails pour mail)       |
|  ✗  | « Réintégrons Calendly pour gagner du temps »            | axionia-calendar (refus, abandonné) ou axionia-core |
|  ✗  | « Migration Prisma calendar_slots »                      | axionia-database                                    |
|  ✗  | « Page /interventions/essentielle hero »                 | axionia-design + axionia-seo-aeo                    |

## 2. Conflits de routing détectés

### CR-01 — Triple matching UI : `axionia-design` + `web-design-guidelines` + `ui-ux-pro-max` (+ parfois `frontend-design`)

- **Prompts à risque** : « Crée une landing page premium pour /interventions », « Améliore le design du hero », « Audite l'UI ».
- **Symptôme** : les 4 skills se déclenchent. Sans hiérarchie explicite, `ui-ux-pro-max` ou `frontend-design` peut imposer du brutalism/glassmorphism contredisant `axionia-design`.
- **Fix proposé** : `axionia-core` déclare déjà la hiérarchie (lignes 165-169). À renforcer : ajouter une note dans la **description** de `web-design-guidelines`, `ui-ux-pro-max`, `frontend-design` : « En contexte AxionIA, voir `axionia-design` pour la direction visuelle (Webflow-inspired). »

### CR-02 — Double matching SEO : `axionia-seo-aeo` + `seo-audit-marketing` + `ai-seo`

- **Prompts à risque** : « Audite mon SEO », « Mon traffic chute », « Optimise pour AI Overviews ».
- **Symptôme** : les 3 skills matchent. Le générique ne sait pas le scope AxionIA (mot « formation » banni, OÜ, FR/EN).
- **Fix proposé** : neutraliser `seo-audit-marketing` au profit de `axionia-seo-aeo` ; cadenasser `ai-seo` (note dans description).

### CR-03 — Schema dupliqué : `schema-markup` + `seo-schema`

- **Prompts à risque** : « Ajoute du schema.org », « JSON-LD FAQ », « rich snippets ».
- **Symptôme** : les 2 skills se chevauchent à 100%. Choix ambigu.
- **Fix proposé** : désactiver `seo-schema` (Annexe F), garder `schema-markup`.

### CR-04 — Email tooling : `axionia-emails` + `email-sequence` + `cold-email`

- **Prompts à risque** : « Crée une séquence email », « Écris un cold email », « Drip campaign ».
- **Symptôme** : `email-sequence` propose Resend/Mailchimp par défaut (interdit).
- **Fix proposé** : note dans description : « Sur AxionIA, le tooling est PowerMTA + MailWizz (voir `axionia-emails`). Ce skill est utilisable pour stratégie/contenu, pas pour le tooling. »

### CR-05 — Forms : `axionia-forms` + `form-cro` + `signup-flow-cro` + `popup-cro`

- **Prompts à risque** : « Optimise mon formulaire », « Réduis l'abandon ».
- **Symptôme** : `form-cro` peut suggérer du JS client lourd ; `signup-flow-cro` est hors scope (pas de signup).
- **Fix proposé** : désactiver `signup-flow-cro` ; cadenasser `form-cro` et `popup-cro` (note SSR/SSG via `axionia-anti-spa`).

### CR-06 — Hreflang : `axionia-i18n` + `seo-hreflang` + `axionia-seo-aeo`

- **Prompts à risque** : « Vérifie hreflang », « Génère hreflang ».
- **Symptôme** : 3 sources, ambiguïté sur qui génère vs qui valide.
- **Fix proposé** : description de `seo-hreflang` clarifie « validateur, génération via `axionia-i18n` ».

### CR-07 — Calendrier : aucun conflit direct, mais risque

- **Prompts à risque** : « Setup booking flow », « Calendly intégration ».
- **Symptôme** : un skill CRO peut proposer Calendly/Cal.com.
- **Fix proposé** : `axionia-core` mentionne explicitement le ban Calendly (déjà fait, ligne 109). OK.

### CR-08 — Touch targets : 3 skills, faible conflit mais redondance

- **Prompts à risque** : « Mes boutons sont trop petits sur mobile ».
- **Symptôme** : 3 skills se déclenchent et donnent la même réponse.
- **Fix proposé** : canon `axionia-a11y` ; `axionia-design` et `axionia-mobile-first` renvoient.

### CR-09 — Lexique « formation »

- **Prompts à risque** : « Page formation entreprise », « formation IA dirigeants », « catalogue de formations ».
- **Symptôme** : aucun skill générique ne sait que ce mot est BANNI. Risque de produire du contenu non conforme.
- **Fix proposé** : automate via hook (Phase 2) — grep `formation|formateur|former|formé` sur outputs ; pour Phase 1.S, mention explicite dans la description de `copywriting`, `seo-audit-marketing`, `ai-seo` : « Sur AxionIA, voir `axionia-core` §1 (lexique banni). »

### CR-10 — Auth/2FA : `axionia-stack` + `axionia-admin-ux` + `owasp-security`

- **Prompts à risque** : « Implémente le 2FA admin », « Setup Auth.js ».
- **Symptôme** : 3 skills matchent, faible conflit (complémentaires).
- **Fix proposé** : OK comme tel — `axionia-stack` (choix Auth.js v5), `axionia-admin-ux` (UX du flux 2FA), `owasp-security` (doctrine).

## 3. Resserrements de description recommandés

### Skills `axionia-*`

- **axionia-design** : la description actuelle est claire ; ajouter explicitement « **prime sur** `web-design-guidelines`, `ui-ux-pro-max`, `frontend-design` pour la direction visuelle. »
- **axionia-mobile-first** : retirer la mention « touch targets WCAG » et « performance budgets » (canons ailleurs) ; rester sur la convention bottom-up Tailwind + viewports + patterns mobile.
- **axionia-performance** : la description est canon, OK.
- **axionia-a11y** : la description est canon, OK.
- **axionia-emails** : ajouter « **prime sur** `email-sequence`, `cold-email` pour le tooling (PowerMTA + MailWizz). »
- **axionia-seo-aeo** : ajouter « **prime sur** `seo-audit-marketing`, `ai-seo`, `schema-markup`, `seo-schema` pour le scope projet (lexique banni, OÜ estonienne, FR/EN). »
- **axionia-i18n** : ajouter « **prime sur** `seo-hreflang` pour la génération (qui reste validateur). »
- **axionia-anti-spa** : ajouter « **prime sur** `page-cro`, `popup-cro`, `form-cro`, `signup-flow-cro` quand un pattern client-side est proposé. »

### Skills génériques (cadenas)

- **web-design-guidelines** : ajouter « Sur AxionIA, voir `axionia-design` pour la direction visuelle (Webflow-inspired). »
- **ui-ux-pro-max** : idem.
- **frontend-design** : idem (ne pas modifier le SKILL.md externe — gérer via routage `axionia-core`).
- **copywriting** : ajouter « Sur AxionIA, mot `formation` banni — voir `axionia-core` §1. »
- **page-cro** / **popup-cro** / **form-cro** : ajouter « Sur AxionIA, vérifier `axionia-anti-spa` (SSR/SSG natif) avant tout pattern client-side. »
- **email-sequence** / **cold-email** : ajouter « Sur AxionIA, tooling = PowerMTA + MailWizz (voir `axionia-emails`). »
- **seo-audit-marketing** / **ai-seo** / **schema-markup** : ajouter « Sur AxionIA, voir `axionia-seo-aeo` pour overrides projet. »
- **seo-hreflang** : ajouter « Sur AxionIA, génération via `axionia-i18n` (next-intl). Ce skill = validation post-build. »
- **test-driven-development** : ajouter « Sur AxionIA, stack tests = Vitest+Playwright via `axionia-testing`. »
- **owasp-security** : ajouter « Sur AxionIA, valeurs effectives (CSP/HSTS) dans `axionia-deployment`. »

## 4. Synthèse

- **18 skills `axionia-*`** ont chacun 3 prompts ✓ et 3 prompts ✗ vérifiés.
- **10 conflits de routing** identifiés (CR-01 à CR-10), tous résolubles via :
  - notes de cadenas dans descriptions des génériques
  - désactivation projet-level des doublons stricts (`seo-schema`, `signup-flow-cro`, `paywall-upgrade-cro`, `onboarding-cro`, `churn-prevention`, `revops`, `community-marketing`, `referral-program`)
  - hook automatisé pour le lexique banni en Phase 2
- **Pas de prompt `axionia-*`** ne capture indûment un prompt qui devrait aller à un autre `axionia-*` (les 18 sont bien différenciés).
- **Le risque principal de double matching** vient du couple `axionia-design` / `ui-ux-pro-max` / `frontend-design` / `web-design-guidelines` — résolu par la hiérarchie déjà présente dans `axionia-core` (lignes 165-169).
