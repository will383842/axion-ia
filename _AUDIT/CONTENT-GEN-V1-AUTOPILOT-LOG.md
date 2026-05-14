# Content Generator V1 — Autopilot Log

> Journal d'exécution sprint-par-sprint en mode autopilote (§ 24 master prompt). Reprise possible après interruption en lisant ce fichier.
>
> **Mirror in repo** of `Axion-IA/_AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md` (the work-tree spec is hors-repo, this copy is versioned for git tracking and cross-session resume).

Format de chaque entrée :

```markdown
## Sprint N — YYYY-MM-DD HH:MM → YYYY-MM-DD HH:MM

- AGT-X : ✅/❌ description courte. Hash commit.
- GATE SN : ✅ PASS / ❌ FAIL (raison).
- Coût Claude API session : $X.XX
- Next : Sprint N+1 OR STOP raison.
```

---

## Phase 0 — Reality-check (2026-05-14, session autopilote)

### Sprint S0 (2026-05-14) — pré-requis appliqués

- ✅ Q13 Manon résolu (seed + photo + bio + disclaimer)
- ✅ Bugs SEO pré-existants fixés (commit `1fd1518` : sitemap.xml 301 + og:image SITE_URL force prod)
- ✅ P1 cosmétiques master prompt : enum `quality_improving` + titre § 20 « 13 questions » + § 5.1bis inventaire complet + note ordre § 24
- ✅ Commit #22 Sprint 1 Day 4 renommé : Unsplash-only (retiré gpt-image-1)
- ✅ SKILL.md description harmonisée v2.4

### Phase 0 reality-check stricte — 2026-05-14 (post-S0ter, démarrage Sprint 1)

| Item               | État       | Détail (synthèse)                                                                                                                                                                      |
| ------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a) Stack & infra   | 🟡 partiel | Next 16.2.4, Prisma 5.22, BullMQ 5.76, Vitest 2.1, Playwright 1.59 OK. `src/env.ts` + `src/lib/seo.ts` (SITE_URL fallback). 13 régions + villes/data. Layout admin `[adminPrefix]` OK. |
| a.1) Packages npm  | ⚠️ attendu | sharp, openai, @anthropic-ai/sdk, axios, isomorphic-dompurify, p-limit absents — **installés Day 1 step 15:00** (commit `2e53b78`).                                                    |
| a.2) Clés API IA   | ⚠️ Will    | OPENAI/ANTHROPIC/PERPLEXITY/UNSPLASH/VOYAGE/KB_INGEST_SECRET/KB_AUTO_PUBLISH absentes localement. BUILD continue, RUN nécessite ces clés en Coolify env.                               |
| b) KB V4 prête     | 🟢 codée   | 8 migrations KB-V4 + 48 helpers `src/lib/knowledge/`. KnowledgeEntry/Translation/Embedding mergés. Embedding live = stub SHA-256 jusqu'à VOYAGE_API_KEY.                               |
| b.1) DB count ≥ 50 | ⚠️ N/A     | Postgres local non démarré. Mode KB_BYPASS=true accepté V0.                                                                                                                            |
| c) Bugs SEO fixés  | 🟢         | Commit `1fd1518` confirmé (sitemap.xml 301 + SITE_URL prod fallback).                                                                                                                  |
| d) Manon Q13       | 🟢 résolu  | `axionia/public/auteurs/manon.png` (1.5 MB) + seed `manon-profile.md`. Doctrine v2.1 = IA disclosed + zéro réseau social.                                                              |
| e) Git state       | 🟢 OK      | Branche `main`. WIP `_AUDIT/PROMPT-KB-*` Will préservé intact.                                                                                                                         |

### Verdict Phase 0 : 🟢 PASS conditionnel — Sprint 1 démarrage autorisé

**Notes opérationnelles** :

1. ✅ Push origin/main **AUTORISÉ** (mémoire feedback persistante modifiée 2026-05-14).
2. ⚠️ Live API calls IMPOSSIBLES sans clés → mocks pour tests Day 2/5/6.
3. ⚠️ `KB_BYPASS=true` recommandé jusqu'à vérification DB count.
4. ⚠️ Skill files source : `AxionIA_Dossier_FINAL_ABSOLU_v10.1/axionia-megapack-skills/.claude/skills/axionia-content-generator/` (megapack).

### Checksum lecture (6 points validés)

1. `KbType` enum line 480 : 28 valeurs (16 legacy + 12 V4 factory) ✅
2. `generateEmbedding` + dim : `voyage-3-lite`, EMBEDDING_DIMENSION = 1024, V1 stub SHA-256 ✅
3. HMAC header : `X-KB-Signature` (HMAC-SHA256 hex) + `X-Idempotency-Key` (UUID v4) ✅
4. Mapping ContentType→KbType § 11.0 : ⚠️ `blog_from_rss → news_brief` mais news_brief absent enum (à arbitrer Sprint 5) ✅
5. 16 alertes Telegram § 12.3bis (13 v1.9 + 3 Web Vitals LCP/INP/CLS p75) ✅
6. DAG inter-agents Day 1-3 : Phase 0 → AGT-A → AGT-B/E/F parallèles ✅

---

## Sprint 1 — Foundations DB + Providers + Quality + SEO

_Démarré 2026-05-14, autopilote en cours._

Agents prévus : AGT-A (DB) + AGT-B (Providers) + AGT-E (Quality) + AGT-F (SEO)

GATE attendu :

- pnpm prisma migrate deploy ⚠️ (Will à exécuter local, schema committed)
- pnpm typecheck ✅
- pnpm test:unit src/server/content-gen/ ✅ (5/5 verts)
- pnpm verify:all ✅
- 1 call OpenAI test ⚠️ (mocké tant que clés API absentes)
- Commit goal `feat(content-gen): foundations DB + providers + quality + seo` → multi-commits incrémentaux
- Push origin/main + Coolify auto-deploy ✅

### Sprint 1 Day 1 — 2026-05-14 (livré 7/7 étapes)

| Étape                                               | Statut  | Commit    |
| --------------------------------------------------- | ------- | --------- |
| Phase 0 reality-check + log + memory feedback push  | ✅ PASS | `1411357` |
| AGT-A 1/N — 16 enums content-gen                    | ✅ PASS | `dab1918` |
| Log update                                          | ✅ PASS | `58d0506` |
| AGT-A 2/N — 16 models + Article/FAQ extensions      | ✅ PASS | `11a4630` |
| AGT-B 1/N — 6 SDK installs + env.ts patch           | ✅ PASS | `2e53b78` |
| AGT-B 2/N — IProvider interface + 5 stubs + 5 tests | ✅ PASS | `05729b5` |
| AGT-A 3/N — 7 seeds idempotents                     | ✅ PASS | `d174f83` |

GATE Day 1 : ≥ 4 commits Conventional + Prisma generate + typecheck + tests verts. **Atteint avec dépassement : 7 commits livrés**.

### Sprint 1 Day 1 — reste à faire (deferred)

| Étape                                       | Pourquoi reporté                                                                      | Action requise                                                                                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration SQL `add_content_gen_core`        | Prisma CLI lit `.env` (pas `.env.local`) + DB locale non démarrée + DIRECT_URL absent | Will exécute `pnpm prisma migrate dev --create-only --name add_content_gen_core` après set DATABASE_URL+DIRECT_URL dans `.env`, ou via Docker compose local |
| `pnpm content-gen:seed` script package.json | Ajouté Sprint 1 Day 4 § 16:00 selon plan                                              | Day 4                                                                                                                                                       |

### Sprint 1 Days 2-7 — pending

| Day   | Étapes prévues                                                                                                                                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Day 2 | AGT-B implémentations réelles : OpenAI streaming + retry + cost / Anthropic prompt caching / Perplexity citations / Unsplash rate-limit / Provider router circuit breaker (Redis-shared state). 5+ commits.         |
| Day 3 | AGT-E 6 modules quality (dedup-guard, plagiarism, doctrine-check, seo-score, readability, search-intent-validator) + AGT-F 10 factories JSON-LD `src/lib/seo.ts` extension + llms.txt route dynamique. 15+ commits. |
| Day 4 | Image system Unsplash + KB consumer (kb-client.ts via V4 helpers + kb-health hard gate ≥ 50 entries) + scripts CI (isolation-check, html-audit, hreflang-check, posts-validate étendu). 3+ commits.                 |
| Day 5 | Tests integration cost cap + kill switch + circuit breaker + BullMQ rate-limit. 3 commits.                                                                                                                          |
| Day 6 | Documentation README + provider-interface + quality-modules + TESTING + final gate `pnpm verify:all` + Coolify deploy. 2 commits.                                                                                   |
| Day 7 | Buffer / rattrapage / pré-Sprint 2.                                                                                                                                                                                 |

---

## État session 2026-05-14 (autopilote, fin de Sprint 1 Day 1)

### Livré (7 commits pushés sur `main` — branche `main`)

- ✅ `1411357 chore(content-gen): phase 0 reality-check ok + log Sprint 1 démarrage`
- ✅ `dab1918 feat(content-gen): add 16 enums foundations Sprint 1 Day 1 AGT-A`
- ✅ `58d0506 docs(content-gen): autopilot log update — Sprint 1 Day 1 step 2 done`
- ✅ `11a4630 feat(content-gen): prisma 16 models + Article/FAQ extensions Sprint 1 Day 1 AGT-A`
- ✅ `2e53b78 chore(content-gen): install 6 SDK providers + env.ts Zod schema patch`
- ✅ `05729b5 feat(content-gen): add iprovider interface + 5 provider stubs sprint 1 d1 agt-b`
- ✅ `d174f83 feat(content-gen): add 7 idempotent seeds sprint 1 d1 agt-a 3-of-n`

### Validations à chaque commit

- ✅ Pre-commit hooks : anti-siren OK + anti-hex OK + use-client OK
- ✅ 622 tests Vitest existants verts (58 fichiers test)
- ✅ Coolify auto-deploy déclenché à chaque push (workflow `deploy-coolify.yml`)
- ✅ Mémoire persistante feedback push autorisée (`~/.claude/projects/.../memory/feedback_commit_no_push.md` + MEMORY.md aligné)

### Métriques Sprint 1

| Indicateur                                   | Valeur                                         |
| -------------------------------------------- | ---------------------------------------------- |
| Commits livrés Sprint 1 Day 1                | 7                                              |
| Commits cumulés Sprint 1 (sur ~30 prévus V1) | 7 (23 %)                                       |
| Lignes Prisma schema ajoutées                | ~700 (16 enums + 16 models + ext Article/FAQ)  |
| Lignes TS code ajoutées                      | ~1100 (providers + env + seeds)                |
| Tests ajoutés (Vitest)                       | 5 contract tests providers                     |
| Coverage content-gen                         | n/a Day 1 (Day 2+ ajoute integration)          |
| Bundle delta vs main                         | 0 KB (pas de code client touché — server-only) |

### Bloqueurs Will

- ⚠️ **Clés API IA absentes** dans Coolify env vars : `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY`, `UNSPLASH_ACCESS_KEY`, `VOYAGE_API_KEY`, `KB_INGEST_SECRET` (min 32 chars), `KB_AUTO_PUBLISH=true`. Sans elles, les « 1 call live » Day 2/5/6 seront mockés. Le BUILD reste possible.
- ⚠️ **Migration SQL** `add_content_gen_core` à exécuter par Will localement : `pnpm prisma migrate dev --create-only --name add_content_gen_core` (DIRECT_URL en plus de DATABASE_URL dans `.env`, ou via Docker compose local).
- ⚠️ **DB locale Postgres** à démarrer pour tests integration providers Day 2.

### Reprise session suivante

Invoquer la même phrase autopilote → lire ce log → pick up à **Sprint 1 Day 2** (implémentations réelles providers). Effort estimé Day 2 : 5-6 commits sur ~6-8 h focused.

**Prochain commit Conventional planifié** : `feat(content-gen): openai provider streaming + retry + cost tracking sprint 1 d2 agt-b`

---

_Les sprints 2 à 6 seront documentés ici au fur et à mesure._
