# 00 — Reality Check (Phase 0)

> Phase 0 séquentielle — inventaire factuel pour calibrer les phases parallèles.
> SHA HEAD figé pour toutes les phases suivantes.

## 1. Repo

| Item                                      | Valeur                                                                                                                                                                                                                                                |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Working dir                               | `C:\Users\willi\Documents\Projets\Axion-IA\axionia`                                                                                                                                                                                                   |
| Sub-repo                                  | `axionia/` (sous-folder du parent `Axion-IA/`, repo distinct)                                                                                                                                                                                         |
| **SHA HEAD `main` au lancement**          | **`98e0b0f5767c2c78f744269ee1abcb1a5d7e78db`**                                                                                                                                                                                                        |
| **SHA effectivement audité Phases 4-5-6** | `4cdfbe441c8f6140d04c3fdb4eecab271ca7592a` (branche `feat/image-bank-v1`) — un agent Phase 2 a fait un `git checkout feat/image-bank-v1` en cours d'audit, image-bank V1 merged-into-working-tree à partir de mi-Phase 1. Documenté dans la synthèse. |
| Remote `origin`                           | `https://github.com/will383842/axion-ia.git`                                                                                                                                                                                                          |
| Branches actives                          | `main`, `feat/image-bank-v1` (local, 0 push), `feature/booking-v1`, `feature/kb-foundations`, `fix/content-gen-v1-pass-b-s6.1`, `sprint-s0-pre-content-gen`                                                                                           |

### 20 derniers commits main

```
98e0b0f feat(content-gen): segmentation 3 secteurs (interventions/audits/implementations)
7562788 feat(seo): article jsonld plafond 2026 — abstract + citations + isBasedOn + mentions
eb9adfc feat(aeo): well-known security.txt + ai-policy.json + middleware exclude
12757b3 fix(csp): autorise speculation rules hash en mode strict admin
0bf4654 fix(seo): aligner sitemap + robots.txt + hreflang sur en locale désactivé
8c78d8d fix(prisma): install openssl + libc6-compat au runner stage
1b452b9 ci(lhci): retire /en de la liste lhci urls (en disabled 2026-05-16)
82e5fad feat(i18n): disable en locale temporairement via env flag + 301 mapping fr
8d4b9d2 docs: adr 0026 build externalisation ghcr + agents.md stubs documentation
a861d70 ci(deploy): externalise build sur GH Actions + GHCR (Option F.1 recovery)
```

## 2. Inventaire fichiers stratégiques

| Métrique                           | Valeur                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| Pages (`page.tsx`)                 | **210** (main) → +6 image-bank sur `4cdfbe4`                                  |
| Routes API (`route.ts`)            | **21** (main) → 34 sur `4cdfbe4` (image-bank)                                 |
| Server Actions (`"use server"`)    | **43** (main) → +N image-bank sur `4cdfbe4`                                   |
| Workers BullMQ                     | **21** (main, hors `__tests__`) → +4 image-bank workers sur `4cdfbe4`         |
| Models Prisma                      | **74** (main) → **85** sur `4cdfbe4` (10 image-bank + 1 Country)              |
| Migrations Prisma                  | **20**                                                                        |
| Tests `.test.ts`/`.spec.ts` (src/) | **70**                                                                        |
| Sub-sitemaps                       | 1 dynamique (`sitemap.ts`) + 2 statiques XML + exporters knowledge stub-aware |
| ADRs                               | **26** (`docs/adr/0001-0026`) + 2 propositions `_AUDIT/adr-*`                 |

### Workers BullMQ (main)

```
booking-crons-worker, content-fact-check-worker, content-gen-worker,
content-google-indexing-worker, content-indexnow-worker, content-keyword-sync-worker,
content-monitoring-worker, content-news-lifecycle-worker, content-orchestrator-worker,
content-psi-monitor-worker, content-publish-worker, content-qa-extract-worker,
content-quality-improver-worker, content-rss-fetch-worker, content-similarity-monitor-worker,
content-tier-lifecycle-worker, content-web-vitals-monitor-worker, email-worker,
option-expiration-worker, option-reminder-worker, retention-purge-worker
```

→ 21 workers main, +4 image-bank workers sur `4cdfbe4`.

## 3. Audits passés (3 derniers mois)

| Audit                              | Date       | Verdict                            |
| ---------------------------------- | ---------- | ---------------------------------- |
| Content-Gen V1 Autopilot           | 2026-05-15 | 🟢 GO PROD CONDITIONAL (354/410)   |
| A5 Runbooks ops                    | 2026-05-15 | 🟢 OPS READY (47.5/50)             |
| Content-gen Pass B officiel v1.0.3 | 2026-05-15 | 🟢 GO PROD CONDITIONAL (175.5/200) |
| D5+D6 DR + Backups                 | 2026-05-15 | 🟡 DR PARTIEL (57/100)             |
| Image-Bank V1 Verification         | 2026-05-16 | 🟡 CONDITIONAL (909/1000)          |
| Audit final 2026-05-09 (Sprint 24) | 2026-05-09 | 🟢 CONDITIONAL GO PROD (~96/100)   |

## 4. Snapshot prod

`https://axion-ia.com/` → HTTP 307 → `/fr` ✅. Headers prod : HSTS preload, COEP/COOP, x-frame-options DENY, CSP avec nonce.

⚠️ **CSP contient `'unsafe-inline'` et `'unsafe-eval'` sur script-src** — investigué Phase 1.D : compromis SSG documenté (`csp.ts:60-73`, incident 2026-05-09), pas une faille. Validé par audit.

## 5. 5 priorités déjà visibles avant phases //

| #   | Sujet                                               | Phase responsable     |
| --- | --------------------------------------------------- | --------------------- |
| 1   | CSP `unsafe-inline/eval` (justifié ou pas)          | 1.D Sécurité          |
| 2   | Workflow `deploy-coolify.yml` modifié uncommit      | 5.C CI/CD             |
| 3   | EN locale désactivé — vérifier proxy.ts 301 partout | 3.A Routes + 3.B Nav  |
| 4   | 17 629 routes SSG — build externalisé GHCR tient    | 1.B Scalabilité + 5.C |
| 5   | DocuSeal webhook + GSC keyword worker TODOs         | 4.A + 5.B             |

## 6. Conventions livrables

- Tous les livrables sous `axionia/_AUDIT/PLATFORM-PERFECTION-2026-05-16/`
- Chemin:ligne pour chaque finding
- ≤ 800 lignes / 30 KB par fichier
- AUCUN edit hors `_AUDIT/PLATFORM-PERFECTION-2026-05-16/`

---

**Phase 0 terminée. Phases 1-5 ont produit 25 livrables (01→25). Phase 6 synthèse séquentielle.**
