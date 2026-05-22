# Fl-04 — Admin création campagne via preset

**HEAD audité** : 81f6ea0e
**Score** : 24 / 25
**Verdict** : 🟢 GO PROD

## Chaîne traçée

| Étape | Fichier | Ligne | Verdict |
|---|---|---|---|
| Templates page V2 | `src/app/[locale]/(admin)/[adminPrefix]/content-gen/coverage/presets/_v2/CampaignPresetsV2.tsx` | 52-128 | OK |
| **6 presets D-P5-1** (FALLBACK + DB) | idem | 43-50 (`FALLBACK_PRESETS` = `pme-audits`, `interventions-weekly`, `tpe-burst`, `eti-pilier`, `cities-paris`, `rss-daily`) | **EXACT 6 presets** |
| Source DB-first puis fallback | idem | 56-67 (`prisma.campaignTemplate.findMany({ where: { isActive: true } })`) | OK |
| **Prisma model `CampaignTemplate`** | `prisma/schema.prisma` | 3616-3630 (`@@map("campaign_templates")` + index slug + isActive) | OK |
| Card preset → CTA `Utiliser ce preset` (Link `coverage/new?preset=…`) | `CampaignPresetsV2.tsx` | 116-121 | OK |
| **Wizard pré-rempli depuis preset** | `coverage/new/_v2/CoverageNewV2.tsx` | 70-78 (`prisma.campaignTemplate.findUnique({where:{slug:sp.preset}})`) | OK |
| `presetDefaults` calculés depuis `config.verticals` / `config.types` / `config.batchSize` / `config.anchorVilleSlug` | idem | 79-100 (typeDistribution répartie équitablement entre N types) | OK |
| Inputs `defaultValue={presetDefaults?.…}` (name / serviceSector / totalTargetCount / anchorVilleSlugs / typeDistribution) | idem | 252-313 | OK |
| Banner "Preset actif : X" + bouton "Retirer preset" | idem | 192-199 | OK UX |
| **Server action `createCampaign`** | `src/server/actions/content-gen/coverage.ts` | 173-259 | OK |
| Validation typeDistribution sum=100 / audienceMix sum=100 / banned types `landing_ville`/`blog_from_rss` si editorial | idem | 181-193 | OK |
| Validation cron récurrent + startDate futur / endDate | idem | 196-216 | OK |
| INSERT `CoverageCampaign` DB avec `createdBy: session.userId` | idem | 219-240 | OK |
| `logActivity` SOC2 | idem | 242-257 | OK |
| `listCampaignTemplates` exposé pour autres wizards | idem | 700-713 | OK |

## Findings P0/P1/P2

| Niveau | Item | Référence |
|---|---|---|
| **P1** | Le `FALLBACK_PRESETS` est utilisé tant que la DB n'est pas seedée. En prod il faut s'assurer que `prisma/seed-campaign-templates.ts` (ou équivalent) a été exécuté pour persister les 6 presets en DB (sinon admin voit fallback statique sans `id` Prisma → pas de relation FK possible côté futurs jobs). | `CampaignPresetsV2.tsx:55-67` |
| **P2** | `(prisma as any).campaignTemplate` typage `any` dans `coverage.ts:703` + `presets/_v2:58` + `new/_v2:74` — cast forcé suggère que le client Prisma n'a pas été régénéré ou le model est nouveau. Vérifier `prisma generate` à jour. | `coverage.ts:702-705` |

## Verdict détaillé

Création campagne via preset complète et conforme D-P5-1 (6 presets exact slug-match : `pme-audits`, `interventions-weekly`, `tpe-burst`, `eti-pilier`, `cities-paris`, `rss-daily`). Model Prisma `CampaignTemplate` câblé, wizard pré-rempli, server action `createCampaign` avec validation, SOC2 log. Score 24/25 (−1 P1 : action Will à confirmer = seed des 6 presets en DB prod).
