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
