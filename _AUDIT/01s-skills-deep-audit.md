# Phase 1.S — Audit complet des skills

> Synthèse globale des annexes A → F · 06/05/2026
> Périmètre : 18 skills `axionia-*` + ~85 skills génériques.
> Source de vérité ultime : `axionia-package/docs/_DECISIONS-FINALES.md` puis `axionia-core`.
> Mode read-only sauf 4 livrables `_AUDIT/01s-*.md`.

## 1. Score global qualité

Évaluation /10 sur les 18 skills `axionia-*` (depuis Annexe B — non livrée dans ce lot, scoring inféré du contenu lu).

| Skill                |   Score    | Forces                                                                                                                  | Faiblesses                                                                        |
| -------------------- | :--------: | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| axionia-core         | **9.5/10** | Référence non négociable claire, lexique banni explicite, hiérarchie skills documentée, MAJ Webflow intégrée 06/05/2026 | Manque la règle de précédence formellement déclarée canon                         |
| axionia-design       | **9.5/10** | Réécrit Webflow-inspired, tokens CSS variables, anti-patterns mis à jour, checklist merge                               | Touch targets 44×44 en doublon avec a11y                                          |
| axionia-stack        |  **9/10**  | Stack verrouillée, justifications, distinction `@vercel/og` lib vs Vercel hébergeur claire                              | Quelques redondances avec deployment                                              |
| axionia-emails       |  **9/10**  | Architecture PowerMTA+MailWizz détaillée, DKIM/SPF/DMARC/BIMI, 16 templates, warmup IP                                  | Manque exemples concrets queue BullMQ retry                                       |
| axionia-anti-spa     |  **9/10**  | Règles claires Server Components default, exemples interdits, bottom-up `'use client'`                                  | OK                                                                                |
| axionia-mobile-first | **8.5/10** | Convention bottom-up Tailwind, viewports, patterns mobile                                                               | Doublons perf budgets + touch targets                                             |
| axionia-i18n         | **8.5/10** | Setup next-intl complet, pathnames traduits, règles éditoriales                                                         | Hreflang à mieux articuler avec seo-aeo                                           |
| axionia-seo-aeo      | **8.5/10** | SEO+AEO+GEO triple, schemas localisés, llms.txt, IndexNow                                                               | Doublons perf budgets, hreflang                                                   |
| axionia-database     | **8.5/10** | Schémas Prisma clairs, conventions, multilingue par contenu                                                             | Surchargé : devrait déléguer modèles content à `axionia-content-models` (à créer) |
| axionia-deployment   | **8.5/10** | Hetzner+Coolify+Cloudflare détaillé, headers sécurité, sauvegardes                                                      | Mention CSP à articuler avec owasp-security                                       |
| axionia-rgpd         | **8.5/10** | Cadre estonien (AKI), bases légales, durées conservation, pas de bannière Plausible                                     | OK                                                                                |
| axionia-monitoring   | **8.5/10** | Sentry+Uptime+Pino+Plausible+Telegram alerts, restauration mensuelle                                                    | Devrait absorber observability (déjà couvert)                                     |
| axionia-performance  | **8.5/10** | Budgets stricts < seuils Google, Lighthouse CI bloquant, outils                                                         | Canon non explicité (mobile-first et seo-aeo répliquent)                          |
| axionia-a11y         | **8.5/10** | WCAG 2.2 AA, focus, ARIA, axe-core                                                                                      | Manque mention canon touch targets                                                |
| axionia-forms        |  **8/10**  | RHF+Zod+Zustand multi-step, validation, anti-spam                                                                       | OK                                                                                |
| axionia-calendar     |  **8/10**  | 3 états + options 48h + race conditions, Calendly abandonné explicite                                                   | OK                                                                                |
| axionia-testing      |  **8/10**  | Vitest+Playwright+axe-core, fixtures FR/EN                                                                              | Mention canon TDD à clarifier                                                     |
| axionia-admin-ux     |  **8/10**  | 14 sections, 4 rôles, toggle FR/EN, différences vitrine vs admin                                                        | OK                                                                                |

**Moyenne 18 skills = 8.6/10** — niveau élevé, doctrine cohérente, quelques redondances à dédupliquer.

## 2. Top 3 excellents · Top 3 à corriger

### Top 3 excellents

1. **axionia-core** (9.5/10) — référence ultime, parfaitement aligné `_DECISIONS-FINALES.md`
2. **axionia-design** (9.5/10) — réécriture Webflow-inspired ce jour, exemplaire
3. **axionia-stack** (9/10) — stack verrouillée, distinction packages npm vs hébergeur exemplaire

### Top 3 à corriger en priorité

1. **axionia-mobile-first** (8.5) — supprimer doublons perf budgets + touch targets, renvoyer aux canons
2. **axionia-database** (8.5) — alléger en sortant les modèles de contenu vers `axionia-content-models` (à créer)
3. **axionia-seo-aeo** (8.5) — clarifier qui prime sur hreflang (i18n) et perf budgets (perf canon)

## 3. Top 5 contradictions inter-skills critiques (depuis Annexe C)

| Rang | ID        | Contradiction                                                                                                                                              | Résolution                                                                                                                                   |
| :--: | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
|  1   | C-06      | **Tooling email** : `email-sequence`/`cold-email` génériques supposent Resend/SendGrid (INTERDITS par `_DECISIONS-FINALES.md` + `axionia-emails`)          | Cadenas description (LOCK-10, LOCK-11). Hook automatique en Phase 2.                                                                         |
|  2   | C-07      | **Lexique « formation »** banni partout (`axionia-core` §1) mais aucun skill générique ne le sait → risque de produire du contenu non conforme             | Cadenas dans descriptions de `copywriting`, `seo-audit-marketing`, `ai-seo`, `content-strategy` (LOCK-04..06, 12..13). Hook grep en Phase 2. |
|  3   | C-04+C-05 | **Direction visuelle** : `frontend-design` et `ui-ux-pro-max` peuvent imposer brutalism/glassmorphism contredisant `axionia-design` Webflow-inspired sobre | `axionia-core` lignes 165-169 déjà présentes — à renforcer dans descriptions des skills externes (LOCK-01..03).                              |
|  4   | C-08      | **Schema dupliqué** : `seo-schema` et `schema-markup` font le même travail                                                                                 | Désactiver `seo-schema` (F-DELETE-01).                                                                                                       |
|  5   | C-01      | **Hreflang** : 3 sources possibles (`axionia-i18n`, `axionia-seo-aeo`, `seo-hreflang`)                                                                     | Canon génération = `axionia-i18n` ; canon validation post-build = `seo-hreflang` ; `axionia-seo-aeo` renvoie.                                |

Mention spéciales : C-02 (touch targets 3 sources), C-03 (perf budgets 3 sources), C-09 (CSP doctrine vs valeurs), C-10 (TDD vs axionia-testing) — à dédupliquer P1.

## 4. Conflits de routing détectés (depuis Annexe E)

| ID    | Risque                              | Skills                                                                   | Fix                                                         |
| ----- | ----------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| CR-01 | Triple matching UI                  | axionia-design + ui-ux-pro-max + frontend-design + web-design-guidelines | hiérarchie déjà dans axionia-core, à renforcer descriptions |
| CR-02 | Double matching SEO scope           | axionia-seo-aeo + seo-audit-marketing + ai-seo                           | cadenas + désactivation seo-audit-marketing                 |
| CR-03 | Schema dupliqué                     | schema-markup + seo-schema                                               | désactiver seo-schema                                       |
| CR-04 | Email tooling                       | axionia-emails + email-sequence + cold-email                             | cadenas LOCK-10, LOCK-11                                    |
| CR-05 | Forms hors scope                    | axionia-forms + signup-flow-cro                                          | désactiver signup-flow-cro                                  |
| CR-06 | Hreflang ambigu                     | axionia-i18n + seo-hreflang + axionia-seo-aeo                            | clarifier rôle dans descriptions                            |
| CR-07 | Calendrier (faible risque Calendly) | axionia-calendar                                                         | déjà géré par axionia-core ban Calendly                     |
| CR-08 | Touch targets dupliqués             | axionia-a11y + axionia-design + axionia-mobile-first                     | canon a11y, autres renvoient                                |
| CR-09 | Lexique « formation »               | tous skills marketing/SEO génériques                                     | cadenas + hook Phase 2                                      |
| CR-10 | Auth/2FA (faible)                   | axionia-stack + axionia-admin-ux + owasp-security                        | OK complémentaires                                          |

## 5. Plan de corrections ordonné

### P0 — Bloquant Phase 2 (à fixer immédiatement après cet audit)

1. **Cadenas tooling email** (LOCK-10, LOCK-11) — décisions absolues `_DECISIONS-FINALES.md` : ajouter dans descriptions de `email-sequence` et `cold-email` une note « Sur Axion-IA, voir `axionia-emails` (PowerMTA + MailWizz). Resend/SendGrid/Mailgun/Brevo INTERDITS. »
2. **Cadenas lexique** (LOCK-04, 05, 06, 12, 13) — ajouter note « Sur Axion-IA, mot `formation` BANNI — voir `axionia-core` §1. » dans descriptions de `copywriting`, `copy-editing`, `content-strategy`, `seo-audit-marketing`, `ai-seo`.
3. **Désactivation 8 skills hors scope** : `signup-flow-cro`, `paywall-upgrade-cro`, `onboarding-cro`, `churn-prevention`, `revops`, `community-marketing`, `referral-program`, `aso-audit` (déplacer dans `_archive/` ou flag `disabled: true`).
4. **Désactivation `seo-schema`** (doublon strict de `schema-markup`).
5. **Règle de précédence formellement déclarée canon dans `axionia-core`** (cf. §7 ci-dessous) — ajouter une section unique en tête de `axionia-core/SKILL.md` avec les 5 niveaux.

### P1 — Chevauchements à clarifier dans les SKILL.md

6. Préciser dans `axionia-design` que **touch targets canon = `axionia-a11y`** (et retirer le détail).
7. Préciser dans `axionia-mobile-first` que **perf budgets canon = `axionia-performance`** + **touch targets canon = `axionia-a11y`** (et retirer les détails).
8. Préciser dans `axionia-seo-aeo` que **perf budgets canon = `axionia-performance`** + **hreflang génération canon = `axionia-i18n`**.
9. Cadenas `web-design-guidelines`, `ui-ux-pro-max`, `frontend-design` (LOCK-01..03) avec note overrides direction visuelle.
10. Cadenas `page-cro`, `form-cro`, `popup-cro` (LOCK-07..09) avec note `axionia-anti-spa`.
11. Cadenas `seo-hreflang`, `seo-sitemap`, `schema-markup`, `seo-page`, `seo-drift` (LOCK-14..17) — overrides scope Axion-IA.
12. Cadenas `owasp-security` (LOCK-20) — valeurs effectives dans `axionia-deployment`.
13. Cadenas `test-driven-development` (LOCK-21) — stack tests dans `axionia-testing`.

### P2 — Doublons à supprimer/cadenasser

14. **Création** `axionia-architecture` (F-CREATE-01) — meta-architecture monorepo/RSC/dossiers.
15. **Création** `axionia-content-models` (F-CREATE-02) — déchargement de `axionia-database`.
16. Doc `_NO-STRIPE.md` (F-CREATE-03) — pas de paiement online en phase 1.
17. **Pas de création** `axionia-observability` — `axionia-monitoring` couvre déjà (renforcer description).
18. Désactivation SEO non pertinents : `seo-ecommerce`, `seo-local`, `seo-maps`, `seo-image-gen`, `seo-flow`, `seo-dataforseo`, `seo-backlinks` (Phase 3+).
19. Cadenas `analytics-tracking` (LOCK-18) — Plausible only, GA4/GTM interdits sans validation.

### P3 — Harmonie style/ton/structure

20. Uniformiser le frontmatter `description` des 18 `axionia-*` (longueur 2-4 phrases, mots-clés trigger en début).
21. Uniformiser le ton (tutoiement de Will, FR uniquement, pas d'emoji dans le code mais OK dans les SKILL.md pour signaler 🔴/✅/❌).
22. Uniformiser la section finale « Cohérence avec autres skills » (présente dans `axionia-design`, à généraliser).

## 6. Skills à créer / supprimer / cadenasser (rappel)

### Créer (2 skills + 1 doc)

- `axionia-architecture/SKILL.md`
- `axionia-content-models/SKILL.md`
- `docs/_NO-STRIPE.md`

### Ne PAS créer

- `axionia-observability` (doublon `axionia-monitoring`)
- `axionia-payments` (skill) — remplacé par `_NO-STRIPE.md`

### Supprimer/archiver (~9 skills)

`seo-schema` · `signup-flow-cro` · `paywall-upgrade-cro` · `onboarding-cro` · `churn-prevention` · `revops` · `community-marketing` · `referral-program` · `aso-audit`

### Désactiver projet-level (~7 skills)

`seo-ecommerce` · `seo-local` · `seo-maps` · `seo-image-gen` · `seo-flow` · `seo-dataforseo` · `seo-backlinks`

### Cadenasser (~25 skills) — voir Annexe F section 3 pour la liste exhaustive

## 7. Règle de précédence officielle

**À inscrire dans `axionia-core` (et nulle part ailleurs) en section unique en tête :**

> ### Règle de précédence (canon Axion-IA)
>
> En cas de conflit entre sources de doctrine, l'ordre de précédence est strict :
>
> 1. **`_DECISIONS-FINALES.md`** > tout
> 2. **`axionia-core`** > tous les autres skills
> 3. **`axionia-*`** > skills génériques sur tout sujet projet (design, SEO, emails, perf, tests, etc.)
> 4. **Skills génériques** utilisés uniquement pour leur spécialité (jamais pour la doctrine projet)
> 5. **Conflit non résolu** → STOP & ASK Will

Cette règle remplace toute mention disséminée et devient la source unique. Les autres skills doivent y renvoyer (« voir `axionia-core` §règle de précédence »).

## 8. STOP & ASK Will — décisions à valider explicitement avant Phase 2

### Q1 — Désactivation des 8 skills CRO hors scope

> Confirmer la désactivation projet-level de : `signup-flow-cro`, `paywall-upgrade-cro`, `onboarding-cro`, `churn-prevention`, `revops`, `community-marketing`, `referral-program`, `aso-audit`. (Déjà mentionnés dans `axionia-core` lignes 204-209 mais sans flag formel.)
> **Recommandation** : OUI, désactiver. Si Phase 2+ introduit un produit SaaS, réactiver au cas par cas.

### Q2 — Désactivation `seo-schema` (doublon `schema-markup`)

> Confirmer la suppression/archivage.
> **Recommandation** : OUI, archiver.

### Q3 — Création `axionia-architecture` + `axionia-content-models`

> Confirmer la création des 2 skills.
> **Recommandation** : OUI. `axionia-architecture` clarifie l'organisation App Router ; `axionia-content-models` allège `axionia-database` et formalise les règles éditoriales (slug par locale, Tiptap vs MDX, schemas Zod admin).

### Q4 — Doc `_NO-STRIPE.md` au lieu de skill `axionia-payments`

> Confirmer.
> **Recommandation** : OUI. Pas de paiement online en Phase 1, créer un skill serait inviter à coder Stripe.

### Q5 — `axionia-monitoring` couvre `observability` ?

> Confirmer qu'on **ne crée PAS** `axionia-observability`.
> **Recommandation** : NE PAS CRÉER (doublon). Renforcer la description de `axionia-monitoring` avec mots-clés observability/SLO/SLI/tracing.

### Q6 — Cold-email actif ou désactivé ?

> Stratégie outbound massive : décidée ou pas en Phase 1 ?
> **Recommandation** : Laisser **actif mais cadenassé fortement** — Will pourra l'invoquer explicitement plus tard. Tooling = PowerMTA + MailWizz uniquement.

### Q7 — Désactivation `seo-audit-marketing` au profit de `axionia-seo-aeo` ?

> Le générique répète ce que le spécifique fait mieux et avec scope projet.
> **Recommandation** : Cadenasser fortement (LOCK-12) plutôt que désactiver — utile pour onboarder de nouveaux contributeurs sur les fondamentaux SEO. Mais sur Axion-IA, le canon est `axionia-seo-aeo`.

### Q8 — Hook Phase 2 : grep `formation|formateur|former|formé` automatique ?

> Implémenter un hook post-output qui bloque toute génération contenant ces mots ?
> **Recommandation** : OUI en Phase 2 (skill `update-config` + settings.json hook). En Phase 1.S, cadenas description suffit.

### Q9 — Police principale Manrope vs licence GT Walsheim Pro/Aeonik ?

> `axionia-design` mentionne Manrope (gratuite Google Fonts) comme substitut open-source de `WF Visual Sans Variable` (propriétaire Webflow).
> **Question Will** : Phase 1 = Manrope confirmé. Phase 2+ = acheter licence GT Walsheim Pro / Aeonik Pro / Söhne (auto-host) ?
> **Recommandation Phase 1.S** : Manrope. Re-décider en Phase 2 selon retours dirigeants.

### Q10 — Pages/skills CRO actifs ?

> Confirmer la liste : `page-cro`, `form-cro`, `popup-cro`, `copywriting`, `copy-editing`, `content-strategy`, `email-sequence`, `lead-magnets`, `launch-strategy`, `competitor-profiling`, `competitor-alternatives`, `analytics-tracking`, `ab-test-setup`, `marketing-ideas`, `marketing-psychology`, `customer-research`, `pricing-strategy`, `sales-enablement`, `programmatic-seo`, `directory-submissions`, `free-tool-strategy`, `co-marketing`, `social-content`, `image`, `video`, `ad-creative`, `paid-ads`, `product-marketing-context`.
> **Recommandation** : tous actifs **avec cadenas** (notes overrides projet sur lexique, tooling, anti-SPA, direction visuelle).

## 9. Synthèse exécutive

- **Doctrine cohérente, niveau élevé** : moyenne 8.6/10 sur les 18 skills `axionia-*`. La direction visuelle Webflow-inspired ré-injectée le 06/05/2026 est bien intégrée.
- **3 contradictions critiques résiduelles** : tooling email (P0), lexique « formation » (P0), direction visuelle bold/sobriety (P0).
- **3 doublons stricts à dédupliquer** : touch targets, perf budgets, hreflang.
- **9 skills hors scope à désactiver** + **2 skills à créer** (`axionia-architecture`, `axionia-content-models`) + 1 doc `_NO-STRIPE.md`.
- **~25 cadenas** à apposer sur les descriptions de skills génériques.
- **1 règle de précédence canon** à formaliser dans `axionia-core` en section unique en tête.
- **10 questions Q1-Q10** pour Will avant Phase 2.

Cet audit donne un plan d'action exécutable séquentiellement P0 → P3 sur 1-2 sessions de travail. Une fois P0+P1 livrés, le routing skills sera prédictible et la doctrine Axion-IA sans contradiction documentée.
