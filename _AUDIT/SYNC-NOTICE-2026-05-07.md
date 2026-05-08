# 📌 SYNC NOTICE — 2026-05-07 (DOC-SYNC V14)

> **Note transverse** référencée par tous les prompts `_AUDIT/PROMPT-*.md` antérieurs au 2026-05-07. À lire avant d'exécuter un de ces prompts.

## Évolutions HEAD post-publication initiale (06/05/2026)

Le code Axion-IA a évolué entre 2026-05-06 et 2026-05-07 (`axionia/` HEAD `fd91518`, ~30 commits dont 22 pushés `origin/main` en Sprint 14.5-14.9). Plusieurs prompts ont été rédigés AVANT ces livrables et contiennent des mentions désormais inexactes.

### Mentions susceptibles d'être périmées

| Mention dans un prompt antérieur                                                                          | Réalité HEAD `fd91518`                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| « 75 templates », « 61 templates », « 170 routes »                                                        | **64 routes templates** live (cf. `_AUDIT/02b-mapping-pages.md` v2 + `_AUDIT/sync-pages.json`)                                                                                                                                                                                             |
| Routes Module 2 Audit : `/audit/complet`, `/audit/departement`, `/audit/point-de-vente`, `/audit/cabinet` | **REFACTORÉ** : `/audit/flash`, `/audit/process`, `/audit/strategique-pme`, `/audit/strategique-eti`, `/audit/demande`                                                                                                                                                                     |
| « gate `anti-formation` », « mot formation BANNI »                                                        | Gate CI retiré 2026-05-07 (ADR 0003) MAIS **convention éditoriale 2026-05-08 (ADR 0008) impose le remplacement systématique « formation » → « intervention coaching »** dans copy / slug / commit / meta / JSON-LD / content / seeds / fixtures. ADR 0003 + ADR 0008 sont à lire ensemble. |
| « Webflow Blue `#146ef5` + 6 secondaires + Manrope unique »                                               | **ADR 0002 pivot v3 « Editorial Premium Light »** : ivoire chaud + sand + mocha + terracotta + sage + Webflow Blue **densifié** `#1a4dd9` + Fraunces serif italique signature `em.editorial`.                                                                                              |
| « `text-base` 16 px / body 16 px »                                                                        | **ADR 0004** : `text-base` **18 px** + `text-sm` **15 px** + lh body 1.7 + letter-spacing -0.005em (override Tailwind v4 defaults via `@theme`).                                                                                                                                           |
| « 4 factories JSON-LD » / « factories Organization/Service/FAQPage/Article/Breadcrumb/Person/Review »     | **19 factories** dont 5 nouvelles (Person, FaqSpeakable, LocalBusiness, Place, ItemList) cf. `src/lib/seo.ts` HEAD.                                                                                                                                                                        |
| « sitemap multi-fichier 10 sous-fichiers »                                                                | **Sitemap-index Next 16** via `generateSitemaps()` + 6 sous-sitemaps (`pages`, `blog`, `help`, `cas-concrets`, `comparaisons`, `implementation`) avec `alternates.languages` (hreflang) + `lastModified`.                                                                                  |
| « Next.js 15 »                                                                                            | **Next.js 16.2.4** (scaffold latest stable Sprint 0 + Next.js 16 convention `proxy.ts` au lieu de `middleware.ts`).                                                                                                                                                                        |
| « Sprint 14.5 working copy » / « pivot v3 working copy »                                                  | **Commités + pushés** `origin/main` 2026-05-07 (HEAD à 1 commit ahead seulement à ce jour).                                                                                                                                                                                                |
| « ADR 0002 doublon (2 fichiers `0002-*.md`) »                                                             | **RÉSOLU** par commit `18dd599` (1 seul fichier).                                                                                                                                                                                                                                          |
| « `'use client'` toléré uniquement... » + listes obsolètes                                                | 30/85 composants `'use client'` côté HEAD ; règle Server-first maintenue.                                                                                                                                                                                                                  |

### Sprints livrés depuis publication initiale (post-Sprint 14)

- **Sprint 14.5** Pivot doctrine v3 (ADR 0002) — 22 commits `5942d2f` → `941a8e1` pushés.
- **Sprint 14.6** Espace presse `/presse` + `content/press.ts` (22 entités) — commit `38879bc`.
- **Sprint 14.7** Visual rhythm A+B + 6 hero schemas + 17 pages + ADR 0004 typography v3.1 — commit `dbc39b3`.
- **Sprint 14.8** AEO/GEO 2026 perfection : sitemap-index + 5 nouvelles factories + Person `/a-propos` + `BlogPost.updatedAt` + `/llms-full.txt` — commits `eda574b`, `5d9d527`, `c884acc`, `fd91518`.
- **Sprint 14.9** Audit Header & Navigation 2026 → ADRs 0005 (mega-menu) + 0006 (pSEO villes) commités `proposed` — `axionia/docs/adr/0005-*.md` + `0006-*.md`.

### Sources de vérité actualisées

- **Routes** : `_AUDIT/02b-mapping-pages.md` v2 (2026-05-07).
- **Roadmap** : `_AUDIT/02-PLAN.md` § Annexe Sprints intermédiaires.
- **Sprints code** : mémoire `~/.claude/.../memory/axionia_progress.md`.
- **Doctrine visuelle** : `axionia/Design.md` racine + ADRs 0002 + 0004.
- **Stack** : `axionia/package.json` + `axionia/AGENTS.md` (Next 16 breaking changes).
- **JSON-LD + sitemap** : `axionia/src/lib/seo.ts` + `axionia/src/app/sitemap.ts`.
- **Cartographie pages/content/composants/infra** : `_AUDIT/sync-pages.json`, `sync-content.json`, `sync-components.json`, `sync-infra.json`.
- **Snapshot consolidé** : `_AUDIT/sync-snapshot.md`.
- **Rapport DOC-SYNC** : `_AUDIT/DOC-SYNC-REPORT-V14.md`.

### Comportement attendu lors de l'exécution d'un prompt antérieur

1. **Lire ce fichier en premier** avant de commencer.
2. **Substituer** les mentions périmées par les valeurs HEAD lors de la lecture (mentalement ou en commentant le prompt).
3. **Mettre à jour le prompt** uniquement si l'écart est bloquant pour l'audit en cours (sinon laisser et rapporter dans le verdict final).
4. **Citer** dans le rapport final les écarts rencontrés + cette notice comme source.

---

_Notice émise par DOC-SYNC V14 · agent principal Claude Opus 4.7 (1M context) · 2026-05-07._
