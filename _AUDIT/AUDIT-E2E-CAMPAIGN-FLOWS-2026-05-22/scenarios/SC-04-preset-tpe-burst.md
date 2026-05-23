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

---

## RUNTIME VERIFICATION 2026-05-23

**Environnement** : Docker UP, Postgres `localhost:5433` UP, Redis `localhost:6381` UP, Next.js dev `localhost:3000` UP, clés Anthropic+OpenAI présentes.

**Evidence collectée** :

- DB query : slug `tpe-burst` **absent**. Pas d'équivalent direct (la notion de burst n'existe plus comme preset).
- Le comportement burst (cadence rapide) est désormais configurable via `config.batchSize` sur n'importe quel template.

**Verdict runtime** : 🟡 PARTIAL runtime (preset retiré, fonctionnalité accessible via config)

Voir `_logs/RUNTIME-EVIDENCE-MASTER-2026-05-23.md` pour batch complet.
