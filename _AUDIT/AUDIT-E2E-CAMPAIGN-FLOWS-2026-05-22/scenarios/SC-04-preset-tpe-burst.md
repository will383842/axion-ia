# SC-04 — Preset `tpe-burst` (toutes-verticales-general)

**Mode** : code-level — **Verdict** : 🟢 OK (code)

## Étapes prévues

1. Sélection preset `tpe-burst` depuis liste templates
2. Wizard pré-rempli : audienceMix orienté TPE (≥60%), batchSize "burst" (élevé)
3. Renommer + `totalTargetCount=1`

## Cartographie code

- Seed : `seed-campaign-templates.ts:19-132` (slug `tpe-burst`)
- Listing : `listCampaignTemplates` `coverage.ts:778-791`
- Pré-remplissage : `CoverageNewV2.tsx:70-84` defaults complets

## Invariants

- ✅ Preset isActive=true seedé
- ✅ Verticale par défaut couverte par registry generators
- ✅ AudienceMix sanitized server-side

## Verdict 🟢 OK (code)

Preset burst seedé. Aucune divergence détectée par rapport au pattern SC-02.
