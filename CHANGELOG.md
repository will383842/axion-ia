# Changelog AxionIA

Tous les changements notables du sous-repo `axionia/` sont consignés ici.

Format inspiré de [Keep a Changelog 1.1](https://keepachangelog.com/en/1.1.0/) ; versionnage [SemVer 2.0.0](https://semver.org/spec/v2.0.0.html) à partir de la première release stable (Sprint 22 — déploiement prod).

## [Unreleased]

### Added

- DOC-SYNC V14 (2026-05-07) : matrice diff code ↔ docs + 5 sorties JSON (`_AUDIT/sync-*.json`) + `_AUDIT/sync-snapshot.md` + 9+ docs synchronisées. Cf. `_AUDIT/DOC-SYNC-REPORT-V14.md`.
- ADR 0005 — Navigation mega-menu (status: proposed) — issue de l'audit Header & Navigation 2026.
- ADR 0006 — pSEO villes/régions FR (status: proposed) — engagement scale + pipeline éditorial 80/20 LLM/Will.

### Sprints livrés

- **Sprint 14.9** (audit Header & Navigation 2026) — 2026-05-07.
- **Sprint 14.8** (AEO/GEO 2026 perfection) — commits `eda574b`, `5d9d527`, `c884acc`, `fd91518` step A 76% → 95%.
- **Sprint 14.7** (Visual rhythm A+B + 6 hero schemas + 17 pages + ADR 0004 typography v3.1) — commit `dbc39b3`.
- **Sprint 14.6** (Espace presse `/presse` + `content/press.ts`) — commit `38879bc`.
- **Sprint 14.5** (Pivot doctrine v3 « Editorial Premium Light » + ADR 0002) — 22 commits `5942d2f` → `941a8e1`.

### Changed

- `_AUDIT/02b-mapping-pages.md` v1 → v2 : 75 templates → 64 routes HEAD ; Module 2 Audit refactor (`/audit/{flash,process,strategique-pme,strategique-eti,demande}`) ; nouvelles pages éditoriales documentées.
- `axionia-package/docs/_DECISIONS-FINALES.md` : section ADRs ratifiés depuis 2026-05-06 ajoutée ; mention « formation banni » levée (ADR 0003) ; Next.js 15 → 16.2.4.
- `_AUDIT/PROMPT-CODAGE.md` : Sprint 6 réactualisé (refactor module Audit) + annexe Sprints 14.5 → 14.9 livrés.
- `_AUDIT/02-PLAN.md` : annexe Sprints intermédiaires livrés.
- 5 skills `axionia-architecture`, `axionia-content-models`, `axionia-seo-aeo`, `axionia-design`, `axionia-stack` : encart « SYNC 2026-05-07 (DOC-SYNC V14) » avec état HEAD.

### Removed

- ~~Mot « formation » banni partout~~ — gate CI retiré par ADR 0003 (2026-05-07). **Convention éditoriale 2026-05-08 (ADR 0008) supersedes** : « formation » doit être remplacé par « intervention coaching » partout (copy / slug / commit / meta / JSON-LD / content / seeds). Pas de gate CI ré-ajouté.

### Added (2026-05-08)

- ADR 0008 — Vocabulaire : « formation » → « intervention coaching » (`axionia/docs/adr/0008-vocabulary-intervention-coaching.md`). Sweep résiduel sur `src/content/*.ts` + `messages/*.json` à programmer Sprint 15+.

---

## Sprints 0-14 (récapitulatif)

Sprints livrés du 2026-05-06 au 2026-05-07 (cf. mémoire `axionia_progress.md` pour détail).

- **Sprint 14** (M7 — pages erreurs, sitemap dynamique, IndexNow) — commit `1135136`.
- **Sprint 11-13** (M5 — calendrier maison, RoiSimulator, forms multi-step) — commits `5a5ac6e`, `d6b9983`, `c3d748b`.
- **Sprint 10** (M6 — pages légales OÜ estonienne) — commit `9cc70d7`.
- **Sprint 9** (M6 — transversales `/a-propos` `/contact` `/faq` `/blog` `/centre-aide`) — commit `c99d66a`.
- **Sprint 8** (M6 — cas concrets) — commit `c99d66a`.
- **Sprint 7** (M4 — Module 3 Implementation 10 pages) — commit `f7bb430`.
- **Sprint 6** (M4 — Module 2 Audit, refactoré 2026-05-07) — commit `2dcad8b` puis refactor.
- **Sprint 5** (M4 — Module 1 Interventions 6 pages) — commit `2dcad8b`.
- **Sprint 4** (M2 — 11 composites sections) — commit `062b8df`.
- **Sprint 3** (M2 — 22 atoms UI shadcn customisés) — commit `5fd1dda`.
- **Sprint 2** (M3 — i18n next-intl + Header/Footer + sitemap + robots + llms.txt) — commit `8200548`.
- **Sprint 1** (M2 — design tokens Webflow Blue + Manrope/Inconsolata) — commit `fe000c6`.
- **Sprint 0** (M1 — Next.js 16.2.4 + Auth.js v5 beta + sous-repo Git + verify:all green) — commit `f52a2b4`.

> **Note** : ce skeleton initial sera étendu Sprint 21 avec sections `[Major.Minor.Patch] - YYYY-MM-DD` une fois les premières releases taguées (Sprint 22 cible).
