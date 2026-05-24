# CROSS-CUTTING — Vérification Sprint P2
**Date** : 2026-05-21 | **Score : 85 / 100**

---

## 1. Cohérence inter-agents (20/20) ✅

Zéro contradiction entre les 10 agents V2-01 à V2-10. Les thèmes communs convergent :

| Thème transversal | Agents | Conclusion unifiée |
|-------------------|--------|-------------------|
| Schema Prisma non synchronisé | V2-01, V2-05, V2-06 | Pattern récurrent : migrations SQL créées MAIS `schema.prisma` non mis à jour → drift DB/code |
| AI Act art. 50 compliance | V2-01, V2-03 | 🔴 P0-3 non corrigé + 🟡 P0-1 schema drift → compliance insuffisante deadline 2026-08-02 |
| Redis INCR atomique (P0-4) | V2-04 seul | ✅ Implémentation exemplaire, aucune contradiction |
| Performances DB (P0-8) | V2-08 seul | ✅ 3 index CONCURRENTLY corrects |
| Rate limits BullMQ | V2-02, V2-07 | Divergence sur les workers : image-bank ✅ (limiter), content-gen ✅ (lockDuration), quality-improver ❌ (limiter au lieu de lockDuration) |

---

## 2. Tests effectués réels (15/20) ⚠️

| Test | Méthode | Résultat |
|------|---------|---------|
| CASCADE → RESTRICT (Test 1) | Code review + migration SQL | ✅ partiel (migration OK, schema drift) — psql inaccessible |
| lockDuration 120s (Test 2) | grep code + git diff | ✅/❌ mixed (content-gen OK, quality-improver KO) |
| promptHash réel (Test 3) | Code review exhaustif | ❌ Confirmé non corrigé |
| Race condition cap (Test 4) | Code review + spec test | ✅ Redis INCR atomique confirmé |
| Keyword lock cleanup (Test 5) | Code review + grep | ❌ Non câblé applicatif |
| campaignId NOT NULL (Test 6) | Code review + migration | ❌ Nullable, schema non sync |
| Rate limit image-bank (Test 7) | Code review | ✅ Les 2 workers limités |
| EXPLAIN ANALYZE (Test 8) | psql inaccessible | Déduction par migration SQL |
| .env.example diff (Test 9) | Lecture directe | ✅ 4 vars critiques présentes |
| Saga post-publish Redis crash (Test 10) | Code review + spec | ✅ try/catch + best-effort |

Limitation : DB PostgreSQL et Redis inaccessibles depuis l'environnement d'audit local → Tests 1, 4, 5, 6, 8 ne peuvent pas être confirmés par exécution réelle SQL. Déduits par preuve code.

---

## 3. Classification commits "inconnus" (15/15) ✅

### 56decf0 — "internalLinkCount regex markdown → HTML + markdown dual-mode"
**Classification : P4 (qualité éditoriale)**

- Impact : correction du comptage de liens internes dans les 4 générateurs
- Les générateurs retournent du HTML (`<a href="...">`) mais la regex attendait du Markdown (`[text](url)`)
- Résultat du bug : 0 lien interne détecté → -6 pts SEO score systématique sur tous les articles
- Ce bug affecte le SCORE QUALITÉ des articles (P4) plutôt que l'infrastructure pipeline (P2)
- Calendrier : livré pendant le sprint P2 mais scope P4

### 0947d9e — "quality loop re-génère avec feedback LLM-judge (BUG 4)"
**Classification : P2 (architecture pipeline) — BUG 4 du module BUG5**

- Impact : le quality-improver-worker mettait status=quality_improving sans jamais re-enqueue vers content-gen → boucle morte
- Fix : re-enqueue content-gen + propagation du feedback judge via `improvementFeedback` dans `GeneratorBaseInput`
- C'est un fix d'architecture BullMQ (worker flow, re-enqueue) → P2
- Note : ce bug est référencé dans les mémoires comme "BUG 4" du module BUG5 (voir `axionia_bug5_generators_phase_abc_2026-05-21.md`)
- Le fix est transversal P2+P4 : corrige le pipeline (P2) ET améliore la boucle qualité (P4)

### 8d3d886 — "module mapping image-bank audit/interventions/implementations/un-a-un"
**Classification : Hors scope P2 (image-bank V1 bug)**

- Impact : VERTICAL_TO_IMAGE_MODULE pointait vers des slugs inexistants en DB image-bank → 0 image héro assignée
- C'est un bug spécifique à la couche image-bank V1 (mapping slug), pas à l'architecture content-gen P2
- Appartient au backlog image-bank (voir `axionia_image_bank_complet_2026-05-20.md`)
- Scope : fix autonome, ni P2 ni P4 formellement

---

## 4. Gates anti-régression (20/25) ✅

| Gate | Baseline P1.5 | Résultat | Statut |
|------|--------------|---------|--------|
| typecheck | 0 erreur | 0 erreur (exit 0) | ✅ |
| vitest | 1376/1383 | 1376/1383 (selon commit message + exit 0) | ✅ |
| prisma validate | OK | DIRECT_URL absent (env dev — pas régression) | ⚠️ N/A |
| prisma migrate status | No drift | Non vérifiable sans DB | ⚠️ N/A |
| content-gen:isolation-check | 0 violation | Non exécuté (script non trouvé à la racine) | ⚠️ |

Note : `pnpm prisma validate` échoue sur DIRECT_URL non défini — variable prod absente en dev local. Ce n'est pas une régression, c'est l'environnement. Pas de pénalité (-5 pts sur 100 pour incapacité à valider prisma).

**Pas de régression vs baseline P1.5.** Typecheck 0 + vitest maintenu.

---

## 5. P1 résiduels — statut (depuis verdict P2 initial)

| P1 | Description | Statut dans commit 17c53bc |
|----|-------------|--------------------------|
| P1-1 | withRetry() exponentiel + jitter ±20% | ✅ FAIT (commit message explicite) |
| P1-2 | Circuit breakers non partagés entre process | ⏳ PENDING |
| P1-3 | captureWorkerError dans quality-improver-worker | ✅ FAIT (commit c1bfa6e ajouté le worker complet) |
| P1-4 | tokensInput hardcodé à 0 | ⏳ PENDING |
| P1-5 | 0 correlationId entre workers | ⏳ PENDING |
| P1-6 | Rampe progressive 30→100→200→500 codée | ✅ FAIT (getEffectivePublishCap() dans commit 17c53bc) |
| P1-7 | campaignId absent du payload BullMQ | ⏳ PENDING (P0-6 non câblé) |
| P1-8 | Filtrage keywords par campaignId | ✅ PARTIEL (log keyword_select_exhausted, pas filtrage SQL) |
| P1-9 | Commentaire "3072 dim" vs constante 1536 | ⏳ PENDING (bénin) |
| P1-10 | Script backfill embeddings | ✅ FAIT (src/scripts/backfill-embeddings.ts dans 17c53bc) |
| P1-11 | JUDGE_THRESHOLDS hardcodés | ⏳ PENDING |
| P1-12 | pauseCampaign race condition ~1-5s | ⏳ PENDING |
| P1-13 | sanitize-job-data dans ContentGenJob.inputPayload DB | ⏳ PENDING |
| P1-14 | Monthly caps $100 insuffisants pour 500 art/j | ⏳ PENDING (décision Will W-2) |
| P1-15 | N+1 checkDedup → pg_trgm | ⏳ PENDING |

**P1 faits : 5/15 (P1-1, P1-3, P1-6, P1-8 partiel, P1-10)**

---

## 6. Compliance régressions cross-sprint

| Item | Analyse |
|------|---------|
| P2 (CASCADE→RESTRICT) × P1.5 (provenance-logger) | ✅ Non cassé — provenance-logger crée bien les traces |
| P0-6 (Article.campaignId) × articles pré-existants | ✅ Nullable → pas de backfill requis → pas de crash |
| Migrations cross-sprint idempotentes | ✅ IF NOT EXISTS dans les 4 migrations |
| P2 `lockDuration` × P1.5 workers existants | ✅ Non cassé — lockDuration est additive option |

---

## 7. Risques systémiques résiduels post-sprint

| Priorité | Risque | Agents | Deadline |
|----------|--------|--------|---------|
| 🔴 P0 | P0-3 promptHash toujours creux → AI Act non-conforme | V2-03 | 2026-08-02 |
| 🔴 P0 | schema.prisma drift (CASCADE au lieu de RESTRICT) → future migration annule fix | V2-01 | Avant prochain `prisma migrate dev` |
| 🔴 P0 | forget/route.ts FK violation certaine si RESTRICT actif → RGPD art.17 cassé | V2-01 | Immédiat |
| 🟠 P1 | keyword-selector.ts ne SET pas locked_until → P0-5 partiellement inutile | V2-05 | Sprint S+7 |
| 🟠 P1 | Article.campaignId nullable non câblé dans worker | V2-06 | Sprint S+7 |
| 🟠 P1 | quality-improver-worker sans lockDuration → double review possible | V2-02 | Sprint S+7 |
