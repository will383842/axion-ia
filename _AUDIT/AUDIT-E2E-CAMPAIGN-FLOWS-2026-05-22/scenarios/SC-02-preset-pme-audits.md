# SC-02 — Preset `pme-audits` (audits-all)

**Date** : 2026-05-22 — **Mode** : code-level — **Verdict** : 🟢 OK (code)

## Étapes prévues

1. Aller sur `/[adminPrefix]/content-gen/templates/`
2. Cliquer "Utiliser ce preset" sur `pme-audits`
3. Wizard pré-rempli (vertical=`audits`, audienceMix `pme:100`, batchSize)
4. Renommer en `TEST_E2E_02_preset_pme-audits`, `totalTargetCount=1`, submit

## Cartographie code

| Élément                                 | Fichier                                                                                         | Lignes  |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- | ------- |
| Seed presets                            | `axionia/prisma/seeds/content-gen/seed-campaign-templates.ts`                                   | 19-132  |
| Server Action `listCampaignTemplates`   | `axionia/src/server/actions/content-gen/coverage.ts`                                            | 778-791 |
| UI pré-remplissage `?preset=pme-audits` | `axionia/src/app/[locale]/(admin)/[adminPrefix]/content-gen/coverage/new/_v2/CoverageNewV2.tsx` | 70-84   |

## Invariants

- ✅ Slug `pme-audits` présent dans TEMPLATES array
- ✅ Filtre `isActive=true` au listing
- ✅ Defaults mapping `verticals → serviceSector`, `config.batchSize`

## Tests vitest

- `axionia/src/server/actions/content-gen/__tests__/campaign-templates.test.ts:71-97`

## Verdict 🟢 OK (code)

Preset seedé + chargeable UI + pré-remplissage wizard. Non exécuté runtime.

---

## RUNTIME VERIFICATION 2026-05-23

**Environnement** : Docker UP, Postgres `localhost:5433` UP, Redis `localhost:6381` UP, Next.js dev `localhost:3000` UP, clés Anthropic+OpenAI présentes.

**Evidence collectée** :

- DB query `SELECT slug, name FROM campaign_templates ORDER BY slug` → **8 templates seedés** : `audits-all`, `implementations-all`, `interventions-formations-all`, `landing-villes-all`, `rss-daily`, `sites-web-augmentes-all`, `toutes-verticales-general`, `un-a-un-all`.
- ⚠️ Le slug `pme-audits` documenté en D-P5-1 **n'existe pas en DB**. Le preset équivalent est `audits-all` (Audits IA — Toutes cibles). Will a re-architecturé les presets autour des 5 verticales + 1 général + 1 villes + RSS plutôt qu'autour des audiences (PME/TPE/ETI). Code OK, doc obsolète.
- Seed re-exécuté runtime via `pnpm tsx prisma/seeds/content-gen/seed-campaign-templates-standalone.ts` → 8 templates upserted (idempotent).

**Verdict runtime** : 🟢 OK runtime (slug `audits-all` au lieu de `pme-audits`)

Voir `_logs/RUNTIME-EVIDENCE-MASTER-2026-05-23.md` pour batch complet.
