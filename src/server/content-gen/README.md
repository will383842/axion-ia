# Content Generator V1 — Architecture overview

> Sprint 1 livré 2026-05-14. Voir `_AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md` pour l'historique complet.

## Structure (§ 4.1bis master prompt)

```
src/server/content-gen/
├── lib/                       # Helpers partagés
│   ├── retry.ts               # withRetry exp 10s/30s/60s
│   ├── cost-tracker.ts        # assertCostCapAvailable + trackCost atomic
│   ├── config-reader.ts       # readProviderConfig DB + cache memo 60s
│   └── __tests__/             # Vitest specs
├── providers/                 # 4 providers IA + router
│   ├── IProvider.ts           # Interface abstraite + GenerationRequest/Response
│   ├── openai.ts              # GPT-4o streaming + retry + cost
│   ├── anthropic.ts           # Claude prompt caching ephemeral
│   ├── perplexity.ts          # Sonar + citations + search_recency
│   ├── unsplash.ts            # Stock images free-only (doctrine v3 CGU)
│   ├── provider-router.ts     # Fallback chain + circuit breaker in-memory V0
│   ├── health-check.ts        # Snapshot global admin
│   └── __tests__/
├── quality/                   # 6 modules quality
│   ├── plagiarism.ts          # Shingling 5-gram + Jaccard
│   ├── doctrine-check.ts      # Anti-SIREN + naming + banned + ratio AxionIA
│   ├── readability.ts         # Flesch-Kincaid FR
│   ├── seo-score.ts           # 13 critères pondérés /100 + intent-aware
│   ├── dedup-guard.ts         # Levenshtein + topic fingerprint
│   ├── search-intent-validator.ts  # Alignement structurel par intent
│   └── __tests__/
├── images/                    # Image pipeline
│   └── image-optimizer.ts     # sharp AVIF/WebP/JPG 320/768/1280w
├── kb-client.ts               # KB V4 READ-ONLY via @/lib/knowledge/*
├── kb-health.ts               # Hard gate ≥ 50 entries + assertKbReady
└── README.md                  # Ce fichier
```

## Sub-folders associés

```
prisma/seeds/content-gen/      # 7 seeds idempotents
prisma/migrations/             # add_content_gen_core (à appliquer Will)
scripts/content-gen/           # CI scripts (isolation-check, etc.)
docs/content-gen/              # UNSPLASH-COMPLIANCE.md + README ci-après
src/lib/seo-content-gen-factories.ts  # 10 factories JSON-LD
src/app/[locale]/(admin)/[adminPrefix]/content-gen/  # Admin UI (Sprint 3)
```

## Decision tree provider routing (§ 7.1)

```
GenerationRequest.role
│
├── "text"    → openai (primary) → anthropic (fallback si OpenAI 503/429)
├── "rerank"  → openai
├── "image"   → openai (V1 — V2 gpt_image)
├── "data"    → perplexity (no fallback — source unique)
└── "stock_image" → unsplash (free only — Unsplash+ exclu doctrine v3)
```

## Garde-fous (§ 0.4)

| Garde-fou        | Module                                  | Comportement                                              |
| ---------------- | --------------------------------------- | --------------------------------------------------------- |
| Cost cap mensuel | `lib/cost-tracker.ts`                   | throw `cost_cap_reached` non-retryable si > monthlyCapUsd |
| Retry exp        | `lib/retry.ts`                          | 3 tentatives 10s/30s/60s, skip si non-retryable           |
| Circuit breaker  | `providers/provider-router.ts`          | 5 failures / 30s → open 60s + half-open                   |
| Idempotence      | `ContentGenJob.idempotencyKey`          | hash(type + input + templateId)                           |
| Kill switch      | `Setting.CONTENT_GEN_KILL_SWITCH` (env) | bloque tout en < 5s                                       |
| KB ready gate    | `kb-health.ts assertKbReady`            | ≥ 50 entries publiées + ratio canonical ≥ 60%             |
| Doctrine check   | `quality/doctrine-check.ts`             | anti-SIREN + naming + banned phrases                      |
| Dedup pré-IA     | `quality/dedup-guard.ts`                | Levenshtein 0.85 + topic fingerprint                      |

## Coûts V1 (budget $380/mois)

| Provider    | Cap mensuel    | Model default                                    |
| ----------- | -------------- | ------------------------------------------------ |
| OpenAI text | $200           | gpt-4o ($2.50/$10/1M)                            |
| Anthropic   | $100           | claude-sonnet-4-6 ($3/$15/1M + cache $0.30 read) |
| Perplexity  | $80            | sonar-pro ($3/$15/1M + $0.005/search)            |
| Unsplash    | $0 (free tier) | unsplash-api-v1 (50/h quota)                     |

## Conformité Unsplash CGU (doctrine v3)

✅ Unsplash gratuit autorisé (notre cas = automation sélection, pas dataset ML/training)
❌ Unsplash+ exclu (clause §3 "par/pour IA quelle qu'elle soit")
✅ Filtre `premium: false` strict + defense in depth
✅ Trigger `/photos/:id/download` (CGU API §6)
✅ Attribution photographer + UTM `axion-ia` obligatoire
✅ Audit trail dans `ContentMetric.imageMetadata`

Voir `docs/content-gen/UNSPLASH-COMPLIANCE.md` v3 pour analyse juridique complète.

## Tests Vitest (35+ verts au Sprint 1)

```bash
pnpm test src/server/content-gen          # 27 tests
pnpm test src/lib/__tests__/seo-content-gen-factories.spec.ts  # 10 tests
```

## Référence

- Master prompt : `_AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md` (v2.5)
- Plan day-by-day : `_AUDIT/SPRINT-1-DAY-BY-DAY.md` (v2.5)
- Compliance Unsplash : `docs/content-gen/UNSPLASH-COMPLIANCE.md` (v3)
- Skill files (megapack) : `AxionIA_Dossier_FINAL_ABSOLU_v10.1/axionia-megapack-skills/.claude/skills/axionia-content-generator/`
