# Sync Snapshot — DOC-SYNC V14

- **Date** : 2026-05-07
- **HEAD axionia/** : `fd915187077c78f693f67d7364b8db908993b957`
- **Auteur** : Claude Opus 4.7 (1M context) · agent principal + 5 agents Explore
- **Mode** : lecture seule code, écriture autorisée uniquement docs `.md`

---

## 1. Réalité HEAD courante (consolidé 5 agents)

### 1.1 Routes (AGT-PAGES — `sync-pages.json`)

- **Total routes live** : **64** (cf. `sync-pages.json`)
- **Module Audit refactoré** : `/audit` listing + `/audit/flash` + `/audit/process` + `/audit/strategique-pme` + `/audit/strategique-eti` + `/audit/demande` (5 sous-pages)
- **Nouvelles routes éditoriales** : `/presse`, `/stack-ia`, `/comparaisons`, `/comparaisons/[slug]`, `/glossaire`, `/guide-ia`, `/methodologie`, `/accessibilite`, `/recherche`
- **Implémentation étendu** : `/implementation/par-fonction/[slug]`, `/implementation/par-techno`
- **i18n** : 61 pathnames typés FR/EN, 2 locales (FR canonical, EN miroir)

### 1.2 Content (AGT-CONTENT — `sync-content.json`)

- **11 modules** `src/content/*.ts` (+1 test stub `press.test.ts`)
- **138 entités** au total (FR↔EN paritaires 100%)
- **4 nouveaux modules depuis V1 mapping** : `press`, `stack-ia`, `comparaisons`, `automatisations`
- **i18n messages** : `fr.json` + `en.json` 168 clés chacun, 0 missing

### 1.3 Composants (AGT-COMPONENTS — `sync-components.json`)

- **85 composants** `.tsx` (55 server / 30 client)
- **Tests** : 12/85 (14% couverture composants)
- **Catégories** : sections (31), ui (21), marketing (9), nav (6), forms (6), calendar (3), layout (2), divers (7)
- **9 HeroSchemas** : Audit, Implementation, Interventions, Methodology, Detail, CaseStudies, Stack, Comparisons, Help
- **Nav** : Header (server, sans dropdown), Footer (single dense row), MobileNav drawer, LocaleSwitcher, NavLink, Breadcrumbs

### 1.4 Infra SEO/AEO/GEO (AGT-INFRA — `sync-infra.json`)

- **19 factories JSON-LD** dans `src/lib/seo.ts` (5 nouvelles : Person, FaqSpeakable, LocalBusiness, Place, ItemList — + HowTo, Dataset, QAPage, Review)
- **Sitemap-index Next 16** : `generateSitemaps()` + 6 sous-sitemaps (pages 0.6-1.0, blog 0.4-0.5, help 0.5-0.7, cas-concrets 0.5-0.6, comparaisons 0.5, implementation 0.6) avec hreflang alternates + lastModified
- **Robots** : disallow ciblé (`/api/`, `/_next/`, design/components/sections variantes locale) + sitemap pointer
- **LLMs** : `llms.txt` (4 sections) + `llms-full.txt` (6 sections avec FAQ + cas concrets), edge cache 1h/24h SWR
- **Stack** : Next 16.2.4, React 19.2.4, Prisma 5.22.0, Tailwind 4, TypeScript 5, Vitest 2.1.9, Playwright 1.59.1, NextAuth 5.0.0-beta.31, pnpm 10.33.4
- **CI** : 5 gates (A lint/typecheck/test, B build/e2e/lhci, C staging smoke, D nightly, E prod release)
- **CSS** : 46 tokens Editorial Premium Light + 8 classes custom + type scale 18px/15px Manrope + Fraunces serif italique terracotta

### 1.5 Git réalité (vérifié)

- **HEAD** : `fd91518 feat(seo+aeo): step A — perfection infrastructure 76% → ~95%`
- **1 commit ahead** de `origin/main` (le prompt prétendait 22 — la mémoire confirme que 22 commits Sprint 14.5-14.9 ont été pushés 2026-05-07)
- **Working tree** : 2 fichiers M non commités (`cas-concrets/[slug]/page.tsx` + `stack-ia/page.tsx`) + dossier `_AUDIT/` umbrella détecté `??`
- **ADRs commités** : 0001 stack, 0002 design pivot v3 (collision 18dd599 RÉSOLUE), 0003 lift formation ban, 0004 typography v3.1
- **ADRs proposés** (en `_AUDIT/`, non commités) : `adr-0003-navigation-mega-menu-PROPOSITION.md` (à renommer 0005), `adr-0004-pseo-villes-PROPOSITION.md` (à renommer 0006)

---

## 2. Matrice diff code ↔ docs

| #   | Doc                                                | Mention périmée                                                                                                                                             | Réalité HEAD                                                                                                       | Action proposée                                                                                                     | Priorité |
| --- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | `_AUDIT/02b-mapping-pages.md` L10                  | "61 templates × 2 langues ≈ 170 routes", L288 "TOTAL templates uniques ~75"                                                                                 | 64 routes live                                                                                                     | Réécrire récap volumétrique avec 64 routes                                                                          | **P0**   |
| 2   | `_AUDIT/02b-mapping-pages.md` L33-41               | Module 2 Audit `/audit/complet`, `/audit/departement`, `/audit/point-de-vente`, `/audit/cabinet`                                                            | Refactoré : `/audit/flash`, `/audit/process`, `/audit/strategique-pme`, `/audit/strategique-eti`, `/audit/demande` | Réécrire entière table Module 2 + notes                                                                             | **P0**   |
| 3   | `_AUDIT/02b-mapping-pages.md` (manquants)          | Pas de `/presse`, `/stack-ia`, `/implementation/par-fonction/[slug]`, `/implementation/par-techno`, `/comparaisons/[slug]` (ce dernier listé partiellement) | Pages live                                                                                                         | Ajouter section « Pages éditoriales » + sous-pages implementation                                                   | **P0**   |
| 4   | `axionia/docs/adr/0002-*.md`                       | Doublon historique 2 fichiers `0002-*.md`                                                                                                                   | RÉSOLU par commit `18dd599` (1 seul fichier)                                                                       | Aucune action — déjà fait ; documenter dans rapport                                                                 | ✅       |
| 5   | `_DECISIONS-FINALES.md` (axionia-package) L26      | "Next.js 15 App Router"                                                                                                                                     | Next.js 16.2.4                                                                                                     | Ajouter section « ADRs ratifiés depuis 2026-05-06 » + version stack à jour                                          | **P0**   |
| 6   | `_DECISIONS-FINALES.md` L98                        | "Word 'formation' dans tout le projet (banni)"                                                                                                              | ADR 0003 lift formation ban (2026-05-07)                                                                           | Lever la mention + référencer ADR 0003                                                                              | **P0**   |
| 7   | `_DECISIONS-FINALES.md` (charte)                   | "Webflow Blue + 6 secondaires + Manrope"                                                                                                                    | ADR 0002 pivot v3 Editorial Premium Light (mocha + terracotta + Fraunces serif italique + 18px body)               | Ajouter section ADRs 0002+0003+0004                                                                                 | **P0**   |
| 8   | `_AUDIT/PROMPT-CODAGE.md` Sprint 6 (L621-624)      | `/audit/complet`, `/audit/departement`, `/audit/point-de-vente`, `/audit/cabinet`                                                                           | Refactor                                                                                                           | Réécrire Sprint 6 + ajouter Sprint 14.5→14.9 livrés                                                                 | **P1**   |
| 9   | `_AUDIT/02-PLAN.md`                                | "M2 Webflow Blue + secondaires" + "M4 routes audit obsolètes" + Sprints 14.5-14.9 absents                                                                   | ADR 0002+0004, Sprints livrés et pushés origin/main                                                                | Append annexe « Sprint 14.5→14.9 livrés post-M14 » + sync M2/M4                                                     | **P1**   |
| 10  | Skill `axionia-architecture/SKILL.md`              | Liste de routes pré-V1, pas de /presse, /stack-ia, /comparaisons, /glossaire, etc.                                                                          | 64 routes live                                                                                                     | Réécriture intégrale arborescence                                                                                   | **P1**   |
| 11  | Skill `axionia-content-models/SKILL.md`            | Pas de press, stack-ia, comparaisons, automatisations                                                                                                       | 11 modules content                                                                                                 | Ajouter 4 sections + helpers                                                                                        | **P1**   |
| 12  | Skill `axionia-seo-aeo/SKILL.md`                   | "factories Organization/Service/Offer/FAQPage/Article/BreadcrumbList/Person/Review" + sitemap 10 sous-fichiers                                              | 19 factories + sitemap-index 6 sous-sitemaps Next 16                                                               | Réécrire chapitre factories + sitemap                                                                               | **P1**   |
| 13  | Skill `axionia-design/SKILL.md`                    | "Webflow-inspired + Webflow Blue + Manrope unique"                                                                                                          | ADR 0002 v3 + ADR 0004 typo 18px                                                                                   | Réécriture intégrale                                                                                                | **P1**   |
| 14  | Skill `axionia-stack/SKILL.md`                     | "Next.js 15"                                                                                                                                                | Next.js 16.2.4, NextAuth 5.0.0-beta.31, pnpm 10.33.4                                                               | Sync versions                                                                                                       | **P2**   |
| 15  | 10 prompts `_AUDIT/PROMPT-*.md`                    | "75 templates", anciennes routes audit, "anti-formation gate"                                                                                               | Périmé                                                                                                             | Sweep regex global                                                                                                  | **P2**   |
| 16  | `axionia/Design.md` chapitre 3.2                   | (déjà sync sweep 2026-05-07 fait)                                                                                                                           | OK ADR 0004 v3.1                                                                                                   | Aucune action                                                                                                       | ✅       |
| 17  | Mémoire `axionia_progress.md`                      | Dernier commit listé = sweep AEO/GEO                                                                                                                        | + commit `fd91518` step A SEO/AEO 76→95%                                                                           | Append delta                                                                                                        | **P2**   |
| 18  | ADR 0005 (mega-menu) en `_AUDIT/`                  | Statut PROPOSITION non committé                                                                                                                             | 8 STOP & ASK Will validés en bloc 2026-05-07                                                                       | Renommer + commit dans `axionia/docs/adr/0005-navigation-mega-menu.md` (status: proposed)                           | **P3**   |
| 19  | ADR 0006 (pSEO villes) en `_AUDIT/`                | Statut PROPOSITION non committé                                                                                                                             | Idem — Q2-Q3-Q6-Q7 validés Will                                                                                    | Renommer + commit `axionia/docs/adr/0006-pseo-villes.md` (status: proposed)                                         | **P3**   |
| 20  | `axionia/CHANGELOG.md`                             | Inexistant                                                                                                                                                  | —                                                                                                                  | Initialiser skeleton (sera rempli Sprint 21)                                                                        | **P3**   |
| 21  | `_AUDIT/PROMPT-DOC-SYNC-V14.md` § Constat          | "22 commits ahead non pushés"                                                                                                                               | 1 commit ahead seulement (Sprints 14.5-14.9 pushés 2026-05-07)                                                     | Note dans rapport — pas d'édition du prompt                                                                         | ℹ️       |
| 22  | `axionia-package/docs/_NO-STRIPE.md`               | Référencé dans le prompt                                                                                                                                    | INEXISTANT                                                                                                         | Note dans rapport (ban Stripe est implicite dans `_DECISIONS-FINALES.md`)                                           | ℹ️       |
| 23  | `Axion-IA_Dossier_FINAL_ABSOLU_v10.1/CLAUDE.md` v6 | "Next.js 15", "formation banni", charte Webflow                                                                                                             | Bible historique 06/05/2026                                                                                        | NE PAS TOUCHER — source gelée. Ajouter une note unique en frontmatter renvoyant aux ADRs 0002-0004 ? **À arbitrer** | ❓       |

---

## 3. Plan de mise à jour priorisé

### P0 (impact maximal — ~30-45 min)

1. **`_AUDIT/02b-mapping-pages.md`** — réécriture complète (récap, Module 2 Audit, sections éditoriales, sous-pages implementation)
2. **`Axion-IA_Dossier_FINAL_ABSOLU_v10.1/axionia-package/docs/_DECISIONS-FINALES.md`** — ajouter section « ADRs ratifiés depuis 2026-05-06 » (0002+0003+0004) + lever « formation banni » + sync stack version Next.js 16.2.4
3. **Documenter dans le rapport** : ADR 0002 doublon résolu (commit `18dd599`), 1 commit ahead (pas 22), `_NO-STRIPE.md` inexistant

### P1 (cohérence projet — ~30-45 min)

4. **`_AUDIT/PROMPT-CODAGE.md`** v3.0 → v3.1 : Sprint 6 refactor + Sprints 14.5-14.9 livrés (Sprint 14.5 pivot v3, 14.6 presse, 14.7 typo v3.1, 14.8 AEO/GEO, 14.9 audit Header/Nav)
5. **`_AUDIT/02-PLAN.md`** : append annexe Sprints livrés + sync M2 (ADR 0002) + M4 (routes audit refactor)
6. **Skill `axionia-architecture/SKILL.md`** : réécriture arborescence (64 routes)
7. **Skill `axionia-content-models/SKILL.md`** : 4 nouveaux modules content
8. **Skill `axionia-seo-aeo/SKILL.md`** : 19 factories + sitemap-index Next 16

### P2 (polish + sweep — ~30 min)

9. **Skill `axionia-design/SKILL.md`** : doctrine v3 Editorial Premium Light + ADR 0004 typo
10. **Skill `axionia-stack/SKILL.md`** : versions stack à jour
11. **10 prompts `_AUDIT/PROMPT-*.md`** : sweep "75 templates", anciennes routes audit, anti-formation
12. **Mémoire `axionia_progress.md`** : append commit `fd91518` step A

### P3 (nice-to-have — ~15-20 min)

13. **ADR 0005** (mega-menu) : renommer et commiter `axionia/docs/adr/0005-navigation-mega-menu.md` status proposed
14. **ADR 0006** (pSEO villes) : renommer et commiter `axionia/docs/adr/0006-pseo-villes.md` status proposed
15. **`axionia/CHANGELOG.md`** : skeleton initial (rempli Sprint 21)

---

## 4. Ce qui NE SERA PAS modifié (lecture seule strict)

- Tout fichier sous `axionia/src/`, `axionia/public/`, `axionia/prisma/`, `axionia/tests/`, `axionia/scripts/`, `axionia/messages/`, `axionia/content/` — **interdits en écriture**.
- `Axion-IA_Dossier_FINAL_ABSOLU_v10.1/CLAUDE.md` v6 — **bible historique gelée**. Mention unique dans rapport « source historique, ADRs 0002-0004 + Sprint 14.5-14.9 prévalent en cas de conflit ».

---

## 5. Sortie attendue Phase 3+4

- Tous les `.md` mis à jour avec citations `file_path:line_number` du code source HEAD
- `_AUDIT/DOC-SYNC-REPORT-V14.md` final avec : verdict global, liste des docs modifiées, audit qualité (positifs/négatifs/recos), commandes `git add` + Conventional Commits prêtes à exécuter (1 commit par catégorie : `docs(audit)`, `docs(skills)`, `docs(adr)`, `docs(memory)`)
