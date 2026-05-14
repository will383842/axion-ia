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

| Item                             | État              | Détail                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **a) Stack & infra**             | 🟡 partiel        | Next **16.2.4**, Prisma **^5.22.0**, BullMQ **^5.76.5**, Vitest **^2.1.9**, Playwright **^1.59.1**, `src/env.ts` (9953 bytes Zod), `src/lib/seo.ts` (35816 bytes, SITE_URL fallback OK), `src/content/regions.ts` + 13 fichiers `villes/data/`, layout admin `[adminPrefix]` OK                                                                                                                                                                                            |
| **a.1) Packages npm manquants**  | ⚠️ attendu        | `sharp`, `openai`, `@anthropic-ai/sdk`, `axios`, `isomorphic-dompurify`, `p-limit` absents — **installs planifiés Sprint 1 Day 1 step 15:00** (cf. SPRINT-1-DAY-BY-DAY § Day 1 16:30). PAS un fail.                                                                                                                                                                                                                                                                        |
| **a.2) Clés API IA**             | ⚠️ Will           | `.env.local` contient `NEXT_PUBLIC_SITE_URL`, `DATABASE_URL`, `REDIS_URL`. Manquent : `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY`, `UNSPLASH_ACCESS_KEY`, `VOYAGE_API_KEY`, `KB_INGEST_SECRET`, `KB_AUTO_PUBLISH`. **Conséquence** : autopilote BUILD continue (cf. auto-pilot.md § Garde-fous coûts : "Aucune génération de contenu pendant l'autopilote — l'autopilote BUILD l'outil, il ne RUN pas"). Les "1 call live" Day 2/5 seront mockés + logués. |
| **b) KB V4 prête**               | 🟢 codée          | 8 migrations KB-V4 appliquées (`kb_01_init_schema` → `kb_v4_annotations_collections`). 48 helpers dans `src/lib/knowledge/` (hmac, embeddings, audit-log, dedup-check, kill-switch, etc.). Models : `KnowledgeEntry` (ligne 1823), `KnowledgeTranslation` (1920), `KnowledgeEmbedding` (2220). **Embedding live** = stub déterministe SHA-256 (Voyage AI réel câblera quand `VOYAGE_API_KEY` fournie).                                                                     |
| **b.1) DB count published ≥ 50** | ⚠️ non vérifiable | Postgres local non démarré pour ce check. Mode `KB_BYPASS=true` accepté V0 transitoire (cf. § 11.5 master prompt). À re-vérifier quand DB up.                                                                                                                                                                                                                                                                                                                              |
| **c) Bugs SEO pré-existants**    | 🟢 fixés          | Commit `1fd1518 fix(seo): /sitemap.xml redirect 301 + force SITE_URL prod fallback (og:image)` confirmé dans git log. `src/lib/seo.ts` contient le fallback SITE_URL prod.                                                                                                                                                                                                                                                                                                 |
| **d) Manon Q13**                 | 🟢 résolu         | `axionia/public/auteurs/manon.png` (1 513 427 bytes, placé 2026-05-14 11:51). `_AUDIT/seeds-templates/manon-profile.md` (11 530 bytes) présent. Doctrine v2.1 = portrait IA disclosed + zéro réseau social.                                                                                                                                                                                                                                                                |
| **e) Git state**                 | 🟢 OK             | Branche **`main`**. WIP non-commités : `_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md`, `_AUDIT/SESSION-2026-05-13-KNOWLEDGE-BASE-CREATION.md` modifiés + 3 nouveaux \_AUDIT/ untracked → **à laisser intact** (consigne contrat § Phase 0 e).                                                                                                                                                                                                                                      |

### Verdict Phase 0 : 🟢 **PASS conditionnel — Sprint 1 démarrage autorisé**

**Notes opérationnelles** :

1. ✅ Push origin/main **AUTORISÉ** désormais (mémoire feedback persistante modifiée 2026-05-14, autopilote nécessite push réguliers pour deploy Coolify auto).
2. ⚠️ Live API calls IMPOSSIBLES sans `OPENAI_API_KEY` etc. → mocks pour tous les tests "live" planifiés Sprint 1 Day 2/5/6. Will fournira les clés quand prêt → switch automatique vers live.
3. ⚠️ `KB_BYPASS=true` recommandé jusqu'à vérification DB count. Le helper `kb-health.ts` codera la voie dégradée.
4. ⚠️ Source de vérité skill files : `AxionIA_Dossier_FINAL_ABSOLU_v10.1/axionia-megapack-skills/.claude/skills/axionia-content-generator/` (megapack — auto-pilot.md + 5 references + 3 checklists + 6 prompts). Le skill actif racine `.claude/skills/axionia-content-generator/SKILL.md` ne contient que SKILL.md mais référence le megapack. Pas de copie nécessaire pour Sprint 1.

### Checksum de lecture (6 points)

1. **`KbType` enum line 480** : ✅ 28 valeurs (16 legacy + 12 V4 factory) — `article`, `case_study`, ..., `automation_recipe`, `industry_use_case`, `comparison`, `implementation_playbook`, etc.
2. **`generateEmbedding` + dimension** : ✅ `voyage-3-lite`, `EMBEDDING_DIMENSION = 1024`. V1 stub déterministe SHA-256 jusqu'à wiring Voyage API réel.
3. **Format header HMAC** : ✅ `X-KB-Signature` (HMAC-SHA256 hex, body raw) + `X-Idempotency-Key` (UUID v4) obligatoires.
4. **Mapping ContentType → KbType § 11.0** : ✅ `landing_ville → industry_use_case`, `blog_article → article`, `blog_from_rss → news_brief`\*, `comparison → comparison`, `guide_pilier → implementation_playbook`, `faq_standalone → faq`, `qa_derived → faq`. ⚠️ **Note divergence** : `news_brief` n'existe PAS dans l'enum `KbType` (28 valeurs listées). À traiter Sprint 5 (mapping = `article` ou ajout enum value).
5. **16 alertes Telegram § 12.3bis** : ✅ Cost cap 80/100%, Provider down 5/30min, KB not ready, 5 jobs failed, Review, Batch done, LCP legacy, **LCP p75 > 2000ms**, **INP p75 > 200ms**, **CLS p75 > 0.1**.
6. **DAG inter-agents Day 1-3** : ✅ Phase 0 → AGT-A migrations + seeds (Day 1) → AGT-B providers (Day 1-2) ∥ AGT-E quality (Day 3) ∥ AGT-F SEO factories (Day 3). AGT-A bloque B/E/F (types Prisma requis).

---

## Sprint 1 — Foundations DB + Providers + Quality + SEO

_Démarré 2026-05-14, autopilote en cours._

Agents prévus : AGT-A (DB) + AGT-B (Providers) + AGT-E (Quality) + AGT-F (SEO)

GATE attendu :

- pnpm prisma migrate deploy ✅
- pnpm typecheck ✅
- pnpm test:unit src/server/content-gen/ ✅
- pnpm verify:all ✅
- 1 call OpenAI test ⚠️ (mocké tant que clés API absentes)
- Commit `feat(content-gen): foundations DB + providers + quality + seo`
- Push origin/main + Coolify auto-deploy ✅

### Sprint 1 Day 1 — 2026-05-14

| Heure     | Étape                                                                                                                                                                                                                                                                                                                                          | Statut    | Commit    |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------- |
| Phase 0   | reality-check stricte + log + memory feedback push autorisé                                                                                                                                                                                                                                                                                    | ✅ PASS   | `1411357` |
| AGT-A 1/N | 16 enums content-gen ajoutés (`ContentType`, `ContentGenJobStatus`, `LogLevel`, `IndexationTier`, `ExpansionMode`, `ProviderKey`, `ProviderRole`, `ReviewStatus`, `CoverageStatus`, `CoverageScope`, `OrganisationType`, `SearchIntent`, `TrustTier`, `WebVitalMetric`, `WebVitalRating`). `Locale` + `CompanySize` réutilisés existants.      | ✅ PASS   | `dab1918` |
| AGT-A 2/N | **À FAIRE** — 14 modèles content-gen + extensions Article/FAQ : ContentGenConfig, ProviderConfig, ContentTemplate, AuthorProfile, BannedPhrase, CoverageDistributionProfile, AudienceMixProfile, CoverageCampaign, ContentGenJob, GenerationLog, ReviewQueue, WebVitalSample, CostLedger, ContentMetric + ExternalReference + ContentCitation. | ⏸ pending | —         |
| AGT-A 3/N | Migration SQL + seeds idempotents (5 providers + 9 templates + 3 distribution profiles + 4 audience mix + Manon + banned phrases + RSS sources)                                                                                                                                                                                                | ⏸ pending | —         |
| AGT-B     | SDK installs (`pnpm add openai @anthropic-ai/sdk axios isomorphic-dompurify sharp p-limit` + dev `vitest @playwright/test`) + env.ts Zod patch (8 clés API)                                                                                                                                                                                    | ⏸ pending | —         |
| AGT-B     | Interface `IProvider` + 5 stubs providers + provider-router squelette                                                                                                                                                                                                                                                                          | ⏸ pending | —         |

GATE Day 1 attendu : 4 commits Conventional sur main + Prisma migration appliquée + Prisma generate + typecheck.

### État session 2026-05-14 (autopilote, fin de session)

**Livré (2 commits pushés sur `main`)** :

- ✅ `1411357 chore(content-gen): phase 0 reality-check ok + log Sprint 1 démarrage`
- ✅ `dab1918 feat(content-gen): add 16 enums foundations Sprint 1 Day 1 AGT-A`
- ✅ 622 tests Vitest existants verts à chaque commit (pre-hooks `verify:all`)
- ✅ Coolify auto-deploy déclenché sur chaque push (workflow GitHub Actions `deploy-coolify.yml`)
- ✅ Mémoire persistante feedback push **autorisée** (`~/.claude/projects/.../memory/feedback_commit_no_push.md`)
- ✅ MEMORY.md index aligné sur la nouvelle autorisation

**Bloqueurs Will** :

- ⚠️ **Clés API IA absentes** dans `.env.local` / Coolify : `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY`, `UNSPLASH_ACCESS_KEY`, `VOYAGE_API_KEY` (KB embedding réel), `KB_INGEST_SECRET`, `KB_AUTO_PUBLISH`. Sans elles, le « 1 call live » Day 2 sera mocké. Le BUILD lui-même n'est pas bloqué (l'autopilote BUILD l'outil, ne RUN pas la génération avant Sprint 2 Gate).

**Reprise session suivante** : invoquer la même phrase autopilote ; lire ce log ; pick up à **AGT-A 2/N** (14 modèles + extensions Article/FAQ). Effort estimé : 30-45 min focused pour pondre la suite (~400 lignes Prisma) + `prisma format / generate / typecheck` + commit + push.

**Prochain commit Conventional planifié** :
`feat(content-gen): prisma migration add_content_gen_core v1.7 — 14 models + Article/FAQ extensions`

---

_Les sprints 2 à 6 seront documentés ici au fur et à mesure._
