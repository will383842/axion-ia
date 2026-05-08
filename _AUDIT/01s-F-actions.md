# Phase 1.S — Annexe F — Actions skills (créer / supprimer / cadenasser)

> Read-only audit · 06/05/2026
> Action plan exécutable en Phase 1.S+ (avant Phase 2).

## 1. Skills MANQUANTS à créer

Selon le prompt-maître Phase 1.S §7 : `axionia-architecture`, `axionia-content-models`, `axionia-payments` (ou doc « no-stripe »), `axionia-observability` (peut être déjà couvert par `axionia-monitoring`).

### F-CREATE-01 — `axionia-architecture` ✅ À CRÉER

| Champ                | Valeur                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Path                 | `.claude/skills/axionia-architecture/SKILL.md`                                                                                                                                                                                                                                                                                                                                            |
| Description proposée | « Architecture macro d'AxionIA : monorepo structure, conventions de dossiers Next.js 15 App Router, séparation public / `(public)` / `(admin)`, RSC vs Client boundaries, shared packages, lib/ vs app/, et patterns d'organisation. À charger pour toute discussion sur la structure du repo, le nommage des dossiers, l'organisation des routes, ou la séparation des préoccupations. » |
| Justification        | Aujourd'hui ces conventions sont éparpillées entre `axionia-stack` (lib/UI choices), `axionia-anti-spa` (RSC/Client), `axionia-admin-ux` (admin layout), CLAUDE.md §17 (conventions). Un skill unique de meta-architecture est utile pour Phase 4.                                                                                                                                        |
| Dépendances          | `axionia-stack`, `axionia-anti-spa`, `axionia-i18n` (App Router avec [locale])                                                                                                                                                                                                                                                                                                            |

### F-CREATE-02 — `axionia-content-models` ✅ À CRÉER

| Champ                | Valeur                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Path                 | `.claude/skills/axionia-content-models/SKILL.md`                                                                                                                                                                                                                                                                                                                                                                                                    |
| Description proposée | « Modèles de contenu AxionIA : articles de blog, FAQ, cas concrets, témoignages, articles centre d'aide, auteurs, tags, catégories. À charger pour toute création/modification de contenu structuré, gestion du multilingue FR/EN par contenu (champ vs table de traduction), slugs uniques, MDX vs Tiptap, schemas Zod côté admin, et règles éditoriales. Complémentaire de `axionia-database` (schémas BDD) et `axionia-admin-ux` (UI éditeur). » |
| Justification        | `axionia-database` porte tout aujourd'hui (tables + champs + multilingue) — surcharge. `axionia-admin-ux` traite l'UI éditeur. Il manque la **règle métier de modélisation** (slug par locale ? table de traduction ? Tiptap vs MDX ? renderers FAQ ?).                                                                                                                                                                                             |
| Dépendances          | `axionia-database`, `axionia-admin-ux`, `axionia-i18n`                                                                                                                                                                                                                                                                                                                                                                                              |

### F-CREATE-03 — `axionia-payments` ⚠️ DOC « NO-STRIPE » plutôt que skill

| Champ           | Valeur                                                                                                                                                                                                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Path            | `axionia-package/docs/_NO-STRIPE.md` (pas de SKILL.md)                                                                                                                                                                                                                                                                     |
| Justification   | Phase 1 d'AxionIA n'a **aucun paiement en ligne** (devis humain Telegram + facturation manuelle). Créer un skill « payments » serait inviter à coder Stripe. **Recommandation** : doc explicite `_NO-STRIPE.md` qui acte « pas de paiement online en phase 1 », à invoquer par `axionia-core` si quelqu'un demande Stripe. |
| Contenu doc     | Listing des décisions : pas de Stripe, pas de paywall, devis human-in-the-loop, prix HT en €, TVA EE en sus selon résidence client, facture manuelle générée admin.                                                                                                                                                        |
| Skill à créer ? | **NON** en Phase 1. À reconsidérer si Phase 2+ introduit paiement online.                                                                                                                                                                                                                                                  |

### F-CREATE-04 — `axionia-observability` ❌ NE PAS CRÉER (doublon `axionia-monitoring`)

| Champ              | Valeur                                                                                                                                                                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Décision           | **NE PAS CRÉER**                                                                                                                                                                                                                                                     |
| Justification      | `axionia-monitoring` couvre déjà : Sentry (errors + tracing), Uptime Kuma (uptime + SSL), Pino (logs structurés), Plausible (analytics), Telegram alerts, sauvegardes Postgres + restauration mensuelle. Ajouter `axionia-observability` créerait un doublon strict. |
| Action recommandée | Renforcer la **description** de `axionia-monitoring` pour qu'elle déclenche aussi sur les mots-clés « observability », « tracing », « SLO », « SLI ».                                                                                                                |

## 2. Skills à SUPPRIMER ou ARCHIVER (redondants/inutiles AxionIA)

### F-DELETE-01 — `seo-schema` 🔁 doublon strict de `schema-markup`

- **Action** : déplacer dans `.claude/skills/_archive/seo-schema/` (ou ajouter `disabled: true` dans le frontmatter selon la convention du runner).
- **Raison** : description identique fonctionnellement, `schema-markup` est plus mature et mieux décrit.
- **Skill canon** : `schema-markup` (lui-même cadenassé pour scope AxionIA).

### F-DELETE-02 — `signup-flow-cro` ❌ hors scope projet

- **Action** : archiver.
- **Raison** : pas de signup public en phase 1 (uniquement formulaires de devis). `axionia-core` lignes 204-209 le mentionne déjà comme non pertinent.

### F-DELETE-03 — `paywall-upgrade-cro` ❌ hors scope

- **Action** : archiver.
- **Raison** : pas de paywall, pas de freemium, pas de SaaS.

### F-DELETE-04 — `onboarding-cro` ❌ hors scope

- **Action** : archiver.
- **Raison** : pas de produit à activer post-inscription.

### F-DELETE-05 — `churn-prevention` ❌ hors scope

- **Action** : archiver.
- **Raison** : pas d'abonnement Stripe, pas de churn classique.

### F-DELETE-06 — `revops` ❌ hors scope

- **Action** : archiver.
- **Raison** : pas de CRM/MQL/SQL en phase 1, ticket via Telegram tag-based.

### F-DELETE-07 — `community-marketing` ❌ hors scope

- **Action** : archiver.
- **Raison** : Discord/Slack incompatible avec positionnement McKinsey/Roland Berger premium B2B.

### F-DELETE-08 — `referral-program` ❌ hors scope

- **Action** : archiver.
- **Raison** : peu pertinent ticket 290-50k€ premium B2B (les décideurs ne s'inscrivent pas via referral link).

### F-DELETE-09 — `aso-audit` ❌ hors scope

- **Action** : archiver.
- **Raison** : pas d'application mobile.

### F-DELETE-10 — `seo-ecommerce` ❌ hors scope

- **Action** : archiver.
- **Raison** : pas d'e-commerce, pas de Google Shopping.

### F-DELETE-11 — `seo-local` / `seo-maps` ❌ hors scope

- **Action** : archiver les deux.
- **Raison** : cabinet UE distant, pas de magasin physique avec adresse client-facing.

### F-DELETE-12 — `seo-image-gen` ❌ dépendance manquante

- **Action** : archiver (ou laisser inactif).
- **Raison** : nécessite extension MCP `nanobanana` non installée.

### F-DELETE-13 — `seo-dataforseo` ❌ dépendance payante

- **Action** : archiver tant que pas de compte DataForSEO.
- **Raison** : nécessite MCP DataForSEO payant.

### F-DELETE-14 — `seo-flow` ⚠️ peu actionnable

- **Action** : archiver.
- **Raison** : méta-pointeurs vers repo externe FLOW framework, peu opérationnel.

### F-DELETE-15 — `seo-backlinks` ⚠️ phase ultérieure

- **Action** : archiver pour Phase 1, réactiver Phase 3+ (post-lancement).
- **Raison** : audit backlinks pertinent seulement quand le site existe et a un historique.

### F-DELETE-16 — `cold-email` ⚠️ stratégie outbound non décidée

- **Action** : laisser actif **mais cadenasser fortement** (voir §3).
- **Raison** : Will pourrait vouloir utiliser plus tard. Mais le tooling Resend/SendGrid est INTERDIT.

## 3. Skills à GARDER mais CADENASSER

Cadenas = **ajouter dans la description du SKILL.md** une note du style :

> « Sur AxionIA, voir `axionia-X` pour les overrides projet (lexique, tooling, direction visuelle). »

### F-LOCK-01 — `web-design-guidelines`

> Note à ajouter : « Sur AxionIA, voir `axionia-design` pour la direction visuelle (Webflow-inspired) qui prime sur les recommandations génériques radius/shadow/gradient. »

### F-LOCK-02 — `ui-ux-pro-max`

> Note : « Sur AxionIA, la direction visuelle est arrêtée (Webflow-inspired sobre B2B). Utilisable uniquement pour : font pairings (à filtrer Manrope+Inconsolata), spacing scale, contrastes, technical patterns. **PAS** pour glassmorphism/brutalism/claymorphism/neumorphism — bannis. »

### F-LOCK-03 — `frontend-design`

> Description externe non modifiable directement. Cadenas via mention dans `axionia-core` lignes 161 + 165-169 (déjà présent). À renforcer en Phase 2 via hook qui injecte un préambule.

### F-LOCK-04 — `copywriting`

> Note : « Sur AxionIA, le mot `formation` est BANNI (utiliser `intervention`). Voir `axionia-core` §1 lexique banni. La société est OÜ estonienne — pas de SIREN/SIRET. Toutes les chaînes via next-intl FR+EN. »

### F-LOCK-05 — `copy-editing`

> Note identique à `copywriting`.

### F-LOCK-06 — `content-strategy`

> Note : « Sur AxionIA, lexique banni : `formation`. Voir `axionia-core` §1. Les contenus structurés (blog, FAQ, cas concrets, centre d'aide) sont régis par `axionia-content-models` et `axionia-database`. »

### F-LOCK-07 — `page-cro`

> Note : « Sur AxionIA, vérifier `axionia-anti-spa` (SSR/SSG natif obligatoire) avant tout pattern client-side ou A/B test JS. Direction visuelle = `axionia-design`. Lexique = `axionia-core`. »

### F-LOCK-08 — `form-cro`

> Note : « Sur AxionIA, voir `axionia-forms` pour la stack RHF+Zod+Zustand+shadcn. Pas de pattern client-side qui dégrade SSR (`axionia-anti-spa`). »

### F-LOCK-09 — `popup-cro`

> Note : « Sur AxionIA, glassmorphism interdit (`axionia-design`), JS client lourd interdit (`axionia-anti-spa`). Préférer Server-rendered modals + CSS `dialog` natif. »

### F-LOCK-10 — `email-sequence`

> Note : « Sur AxionIA, le tooling email est PowerMTA + MailWizz self-hosted (voir `axionia-emails`). **Resend / SendGrid / Mailgun / Brevo / Mailchimp INTERDITS.** Templates React Email FR+EN obligatoires. »

### F-LOCK-11 — `cold-email`

> Note identique à `email-sequence`. **Plus** : « Stratégie outbound massive non validée par Will en Phase 1. À utiliser uniquement sur demande explicite. »

### F-LOCK-12 — `seo-audit-marketing`

> Note : « Sur AxionIA, voir `axionia-seo-aeo` pour les overrides projet (lexique `formation` banni, OÜ estonienne, FR+EN, sitemap multi-fichier, bloc AEO 50-80 mots, llms.txt). »

### F-LOCK-13 — `ai-seo`

> Note identique à `seo-audit-marketing`. **Plus** : « llms.txt sur AxionIA respecte le lexique banni. »

### F-LOCK-14 — `schema-markup`

> Note : « Sur AxionIA, voir `axionia-seo-aeo` pour les schemas localisés FR/EN AxionIA-specific (Organization OÜ Tallinn, Service par module, FAQPage, Article bilingue). Ce skill = générateur générique JSON-LD. »

### F-LOCK-15 — `seo-page` / `seo-drift`

> Note : « Sur AxionIA, scope défini par `axionia-seo-aeo`. Lexique banni `axionia-core`. Hreflang généré par `axionia-i18n`. »

### F-LOCK-16 — `seo-hreflang`

> Note : « Sur AxionIA, génération hreflang via `axionia-i18n` (next-intl + sitemap multi-fichier). Ce skill = validation post-build uniquement. »

### F-LOCK-17 — `seo-sitemap`

> Note : « Sur AxionIA, structure sitemap multi-fichier × 2 langues définie dans `axionia-seo-aeo` et `axionia-i18n`. »

### F-LOCK-18 — `analytics-tracking`

> Note : « Sur AxionIA, analytics = Plausible self-hosted RGPD-friendly (voir `axionia-monitoring`). **GA4 / GTM / Mixpanel / Segment INTERDITS** sans validation explicite Will. »

### F-LOCK-19 — `ab-test-setup`

> Note : « Sur AxionIA, A/B tests autorisés uniquement en SSR ou cookie-based pour respecter `axionia-anti-spa`. Tracking via Plausible custom events. Phase 1 = pas d'A/B test (volume insuffisant). »

### F-LOCK-20 — `owasp-security`

> Note : « Sur AxionIA, valeurs effectives (CSP, HSTS, X-Frame-Options, CSRF tokens, rate limit) configurées dans `axionia-deployment`. Ce skill = doctrine OWASP Top 10. »

### F-LOCK-21 — `test-driven-development`

> Note : « Sur AxionIA, stack tests = Vitest + Playwright + axe-core via `axionia-testing` (canon). Ce skill = méthode rouge-vert-refactor générique. »

### F-LOCK-22 — `brainstorming` / `writing-plans` / `executing-plans` / `subagent-driven-development`

> Note : « Sur AxionIA, ces skills s'invoquent **sous** la cadence du PROMPT-MAITRE (Phases 0 → N), pas en remplacement. Voir `_DECISIONS-FINALES.md` et `axionia-core`. »

### F-LOCK-23 — `claude-md-improver` / `claude-automation-recommender`

> OK tels quels, aucune modification (déjà mentionnés dans `axionia-core` lignes 162-163 avec usage prescrit).

## 4. Décision sur les ~27 skills SEO du mégapack

### À garder ACTIFS (8 skills)

| Skill           | Rôle                                        | Note overrides                                |
| --------------- | ------------------------------------------- | --------------------------------------------- |
| `seo-schema`    | ❌ — voir F-DELETE-01                       | (doublon `schema-markup`)                     |
| `schema-markup` | ✅ générateur JSON-LD                       | LOCK-14                                       |
| `seo-hreflang`  | ✅ validateur i18n SEO                      | LOCK-16                                       |
| `seo-sitemap`   | ✅ générateur/audit sitemap                 | LOCK-17                                       |
| `seo-page`      | ✅ analyse single URL                       | LOCK-15                                       |
| `seo-drift`     | ✅ baseline/diff post-deploy                | LOCK-15                                       |
| `seo-google`    | ✅ APIs Search Console / GA4 organic / CrUX | (à activer post-lancement quand GSC connecté) |
| `ai-seo`        | ✅ GEO/AEO/LLMO                             | LOCK-13                                       |

### À DÉSACTIVER projet-level (10+ skills)

| Skill                                                                                                                      | Raison                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `seo-ecommerce`                                                                                                            | F-DELETE-10                                                                              |
| `seo-local`                                                                                                                | F-DELETE-11                                                                              |
| `seo-maps`                                                                                                                 | F-DELETE-11                                                                              |
| `seo-backlinks`                                                                                                            | F-DELETE-15 (Phase 3+)                                                                   |
| `seo-dataforseo`                                                                                                           | F-DELETE-13 (compte payant)                                                              |
| `seo-image-gen`                                                                                                            | F-DELETE-12 (MCP nanobanana absent)                                                      |
| `seo-flow`                                                                                                                 | F-DELETE-14                                                                              |
| `seo-audit-marketing`                                                                                                      | doublon `axionia-seo-aeo` — désactiver ou cadenasser fortement                           |
| `seo-audit-technical`                                                                                                      | doublon partiel `axionia-seo-aeo` — cadenasser ou désactiver                             |
| `seo-content`                                                                                                              | doublon `axionia-seo-aeo` + `copywriting` cadenassé — cadenasser                         |
| `seo-cluster`, `seo-competitor-pages`, `seo-geo`, `seo-images`, `seo-plan`, `seo-programmatic`, `seo-sxo`, `seo-technical` | À évaluer cas par cas — beaucoup sont génériques utiles ; cadenasser pour scope AxionIA. |

## 5. Décision sur les 38 skills CRO/marketing

### À garder ACTIFS (cadenassés)

| Skill                       | Note                                             |
| --------------------------- | ------------------------------------------------ |
| `page-cro`                  | LOCK-07                                          |
| `form-cro`                  | LOCK-08                                          |
| `popup-cro`                 | LOCK-09                                          |
| `copywriting`               | LOCK-04                                          |
| `copy-editing`              | LOCK-05                                          |
| `content-strategy`          | LOCK-06                                          |
| `email-sequence`            | LOCK-10                                          |
| `lead-magnets`              | OK (PDF guides IA gratuits) — cadenasser lexique |
| `launch-strategy`           | OK (utile lancement site) — cadenasser lexique   |
| `competitor-profiling`      | OK                                               |
| `competitor-alternatives`   | OK (pages comparatives futures)                  |
| `analytics-tracking`        | LOCK-18                                          |
| `ab-test-setup`             | LOCK-19                                          |
| `marketing-ideas`           | OK (inspiration)                                 |
| `marketing-psychology`      | OK                                               |
| `customer-research`         | OK                                               |
| `pricing-strategy`          | OK (utile pour ajustement grille tarifaire)      |
| `sales-enablement`          | OK (one-pagers, battle cards)                    |
| `programmatic-seo`          | OK (pages multi-secteurs futures)                |
| `directory-submissions`     | OK (backlinks utiles)                            |
| `free-tool-strategy`        | OK (simulateur ROI peut s'inscrire dedans)       |
| `co-marketing`              | OK                                               |
| `social-content`            | OK (LinkedIn surtout)                            |
| `image`                     | OK (génération images)                           |
| `video`                     | OK                                               |
| `ad-creative`               | OK (futur LinkedIn Ads)                          |
| `paid-ads`                  | OK (futur)                                       |
| `product-marketing-context` | OK (utile au démarrage projet)                   |

### À DÉSACTIVER projet-level (8 skills)

| Skill                 | Raison                                    |
| --------------------- | ----------------------------------------- |
| `signup-flow-cro`     | F-DELETE-02                               |
| `paywall-upgrade-cro` | F-DELETE-03                               |
| `onboarding-cro`      | F-DELETE-04                               |
| `churn-prevention`    | F-DELETE-05                               |
| `revops`              | F-DELETE-06                               |
| `community-marketing` | F-DELETE-07                               |
| `referral-program`    | F-DELETE-08                               |
| `aso-audit`           | F-DELETE-09                               |
| `cold-email`          | LOCK-11 (laisser actif mais cadenas fort) |

## 6. Récapitulatif chiffré

| Catégorie                                 |                                Nombre |
| ----------------------------------------- | ------------------------------------: |
| Skills `axionia-*` actuels                |                                    18 |
| Skills `axionia-*` à créer                | **+2** (architecture, content-models) |
| Skills `axionia-*` finaux                 |                                **20** |
| Skills génériques actuels (estimé)        |                                   ~85 |
| Skills à archiver/désactiver              |  **~17** (8 SEO + 8 CRO + seo-schema) |
| Skills à cadenasser (notes overrides)     |                               **~25** |
| Skills inchangés (utilisables tels quels) |                                 reste |
| Doc à créer (pas SKILL.md)                |                   1 (`_NO-STRIPE.md`) |

## 7. Ordre d'exécution recommandé (post-Phase 1.S)

1. **Cadenas P0** : email tooling (LOCK-10, LOCK-11), lexique `formation` (LOCK-04, 05, 06), direction visuelle (LOCK-01, 02), tooling email (LOCK-10).
2. **Désactivation P0** : 8 skills hors scope (signup-flow, paywall, onboarding, churn, revops, community, referral, aso) + `seo-schema` (doublon).
3. **Création P1** : `axionia-architecture` + `axionia-content-models`.
4. **Cadenas P1** : reste des locks (anti-SPA dans CRO, hreflang, schemas, etc.).
5. **Doc P1** : `_NO-STRIPE.md`.
6. **Désactivation P2** : SEO non pertinents (ecommerce, local, maps, backlinks, dataforseo, image-gen, flow).
7. **Audit Phase 2** : valider que le routing produit les résultats attendus sur 30 prompts AxionIA (Annexe E).
