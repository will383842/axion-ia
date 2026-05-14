# Phase 0 — Pré-requis check

**Date** : 2026-05-14
**Mode** : 🚫 AUDIT-ONLY strict
**Statut** : ✅ TOUS PRÉSENTS — feu vert lancement 8 agents

## Bloc A — Spec master + plan (5/5)

| Fichier | Présent | Taille | Mtime |
|---|---|---|---|
| `_AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md` | ✅ | 277 KB | 2026-05-14 09:01 |
| `_AUDIT/PROMPT-CONTENT-FACTORY-SPEC.md` | ✅ | 26 KB | 2026-05-08 |
| `_AUDIT/SPRINT-1-DAY-BY-DAY.md` | ✅ | 18 KB | 2026-05-14 |
| `_AUDIT/SEEDS-PREPARATION-GUIDE.md` | ✅ | 4 KB | 2026-05-14 |
| `_AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md` | ✅ | 1.4 KB | 2026-05-13 |

## Bloc B — Skill Claude Code (16/16)

- `.claude/skills/axionia-content-generator/SKILL.md` ✅ (11 KB)
- `.claude/skills/axionia-content-generator/README.md` ✅ (1.5 KB)
- `.claude/skills/axionia-content-generator/auto-pilot.md` ✅ (6.4 KB)
- `prompts/` : blog-article, comparatif, faq-standalone, guide-pilier, landing-ville, qa-derived (6/6) ✅
- `checklists/` : exit-v1, seo-aeo-60-items, web-vitals (3/3) ✅
- `references/` : doctrine-axionia, kb-doctrine, manon-person (3/3) ✅
- `templates/landing-ville-template.tsx.md` ✅

## Bloc C — Seeds pré-remplis (10/10 + 2 extra)

- ✅ `manon-profile.md` (9.8 KB)
- ✅ `rss-sources.json` (7.8 KB)
- ✅ `coverage-distribution-profiles.json` (3.5 KB)
- ✅ `audience-mix-profiles.json` (4.9 KB)
- ✅ `banned-phrases.json` (11.7 KB)
- ✅ `keyword-templates.csv` (14.7 KB) — v2.1 dynamique
- ✅ `blog-titles.csv` (50.8 KB)
- ✅ `unsplash-search-queries.json` (11.4 KB)
- ✅ `synonym-groups.json` (15 KB)
- ✅ `external-references.json` (19.8 KB)
- ➕ EXTRA : `image-prompts.json` (11.7 KB) — non listé § 0.4, à confirmer si OK
- ➕ EXTRA : `keywords.csv.OBSOLETE-v2.1.bak` (71 KB) — héritage v2.0 retiré

## Bloc D — Existant repo

- `prisma/schema.prisma` ✅ (présent à la racine, audit corrélation = AGT-VC2)

## Idempotence

`_AUDIT/VERIFICATION-FINALE-AVANT-CODAGE/` créé fraîchement (aucun livrable préexistant). Pas de skip.

## Verdict Phase 0

✅ GO — Lancement des 8 agents AGT-VC1 → AGT-VC8 autorisé.
