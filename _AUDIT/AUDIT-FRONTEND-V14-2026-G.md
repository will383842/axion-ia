# Annexe G — Plan remédiation pré/post Sprint 15

## G.1 — Hot fix P0 contenu (~3h30, parallélisable Sprint 15)

| Ordre | ID         | Action                                                                                                                                                                         | Effort | Fichiers                                                                                                                                                                       |
| ----- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | **C-P0-3** | Remplacer `registrikood` + VAT EE placeholders par valeurs réelles                                                                                                             | 10 min | `src/content/legal.ts:40`                                                                                                                                                      |
| 2     | **C-P0-1** | Ajouter `dateModified?: string` sur BlogPost + CaseStudy interfaces. Exposer dans Article JSON-LD (`buildProductMetadata` + helpers seo). Renseigner les 8 articles existants. | 2h     | `src/content/transversal.ts:126`, `src/content/case-studies.ts:22`, `src/lib/seo.ts`, `src/app/[locale]/blog/[slug]/page.tsx`, `src/app/[locale]/cas-concrets/[slug]/page.tsx` |
| 3     | **C-P0-2** | Étendre bio Will dans ABOUT_TEAM : 150-200 mots (parcours, certifications, secteurs traités, prix/distinctions)                                                                | 1h     | `src/content/transversal.ts:42-43`                                                                                                                                             |

**Validation post-fix** :

```bash
pnpm i18n:check && pnpm anti-formation:check && pnpm typecheck && pnpm test
```

## G.2 — Hot fix P1 (≈ 4h30, recommandé avant Sprint 15 ou Sprint 16)

| ID         | Action                                                                                                                    | Effort |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- | ------ |
| **A-P1-1** | Ajouter rétro SESSION_LOG Sprints 1-4 + 6-9 (template = Sprint 5b)                                                        | 4-5h   |
| **A-P1-2** | Documenter dans `CHANGELOG-PIVOT-V3.md` les commits qui composent le pivot v3 (rebase atomisation risquée — préférer doc) | 1h     |
| **C-P1-1** | Générer `INDEXNOW_KEY` (32-128 hex), placer en `.env.production`, publier `{key}.txt` à racine `public/`                  | 15 min |
| **C-P1-2** | Ajouter `AggregateRating` global sur `/cas-concrets` (5 étoiles × N reviews)                                              | 30 min |
| **C-P1-3** | Ajouter `Organization.identifier` `{"@type":"PropertyValue","name":"registrikood","value":"…"}` (post C-P0-3)             | 10 min |
| **C-P1-4** | Étendre `robots.ts` avec règles explicites GPTBot, ClaudeBot, CCBot, PerplexityBot                                        | 5 min  |
| **C-P1-5** | Sitemap `lastModified` réel par contenu (intégration git ou champ explicite)                                              | 3h     |

## G.3 — Dettes P2 / P3 (Sprint 15+ ou Sprint 16)

### Cohérence (D)

| ID                      | Action                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------- |
| **D-P2-1**              | Consolider FaqAccordion / FaqBlock                                                  |
| **D-P2-2**              | Documenter déprécation `HouseCalendar` ; supprimer si plus utilisé                  |
| **D-P2-3** / **B-P2-2** | Brancher composant visuel `Breadcrumbs.tsx` sur transversales + légales (~20 pages) |
| **D-P2-4**              | Dédupliquer Organization JSON-LD (layout vs home page)                              |
| **D-P2-5**              | Câbler 5 forms aux endpoints email maison (Sprint 16+)                              |
| **D-P3-1**              | Auditer 6 composants UI orphelins (supprimer ou utiliser)                           |
| **D-P3-2**              | Décider sort de `<Hero>` standalone (utilisé 1× showcase)                           |
| **D-P3-3**              | Arbitrer vocabulaire `accompagnement` (1 occurrence)                                |

### Qualité (E)

| ID         | Action                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| **E-P2-1** | Ré-évaluer `reactCompiler` activation Sprint 17 (post-Babel/Turbopack stabilisation)                   |
| **E-P2-2** | Activer `<Image priority>` quand TeamGrid migre vers next/image (Sprint 5 backlog)                     |
| **E-P2-3** | Étendre couverture e2e (1 smoke par tunnel critique) + ajouter test `@a11y` axe-core (voir Annexe F.2) |
| **E-P3-1** | Étendre `size-limit` (budgets par page + CSS)                                                          |
| **E-P3-2** | Ajouter script `test:coverage` + CI artifact                                                           |

### Couverture (B)

| ID         | Action                                                           |
| ---------- | ---------------------------------------------------------------- |
| **B-P1-1** | Page `/maintenance` (acceptable si MAINTENANCE_MODE non utilisé) |
| **B-P2-3** | `scroll-behavior: smooth` global dans `globals.css` (1 ligne)    |

## G.4 — Pré-Sprint 15 checklist (recommandé)

Avant de démarrer Sprint 15 backend (Auth.js, Prisma migrations, BullMQ, email maison) :

- [ ] **Hot fix G.1** (3h30) — corrige les 3 P0 contenu
- [ ] **Smoke `verify:all`** : capturer log baseline (`pnpm verify:all > _AUDIT/baseline-pre-S15.log`)
- [ ] **Lighthouse baseline** sur 10 pages (voir Annexe F.1) — sauvegarder JSON
- [ ] **Push 22 commits → `origin/main`** (décision Will, working tree clean confirmé)
- [ ] **Tag** `v0.14-frontend-final` sur HEAD avant Sprint 15

## G.5 — Plan Sprint 15 (référence `PROMPT-CODAGE.md` §SPRINT 15)

Le verdict GO permet de démarrer Sprint 15 selon la séquence prévue :

1. **Sprint 15** : Auth.js v5 (login OTP magic link, 2FA TOTP), Prisma schema users + sessions
2. **Sprint 16** : Email maison (SMTP Hetzner, templates MJML, queue BullMQ)
3. **Sprint 17** : Server actions forms (5 forms câblés aux endpoints réels, Turnstile validation)
4. **Sprint 18-23** : Admin dashboard, calendrier prestation, paiement (à statuer mode)
5. **Pass B** : refactor + E2E coverage + Lighthouse réel + axe-core run + citability test

Les 4 audits frontend post-S14 (FRONTEND-DEEP-CHECK + FRONTEND-AUDIT-V14-2026 dont rapport présent + 2 audits restants) verrouillent la qualité avant chaque sprint backend.
