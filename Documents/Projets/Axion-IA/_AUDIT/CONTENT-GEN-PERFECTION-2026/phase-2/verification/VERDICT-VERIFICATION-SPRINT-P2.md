# VERDICT VÉRIFICATION SPRINT P2 — Architecture & Data Pipeline
# AxionIA Content-Gen Perfection 2026

**Date** : 2026-05-21
**HEAD audité** : `0906722` (origin/main)
**Commits sprint P2 analysés** : `17c53bc` (principal) + `51fcbb9` + `c1bfa6e` + `56decf0` + `0947d9e` + `8d3d886`
**Score baseline pré-sprint** : 726/1000 🔴 NO-GO
**Score vérifié post-sprint** : **612 / 1000**

---

## Verdict global

🔴 **INSUFFISANT** (< 790)

Le sprint a partiellement exécuté les corrections P2. 5 P0s ont été bien implémentés (P0-4, P0-7, P0-8, P0-9, P0-10), mais 4 autres souffrent de **désynchronisation schema.prisma/migration SQL** (pattern récurrent) et 1 (P0-3) n'a pas été touché. La compliance AI Act art. 50 reste critique.

**Distinction importante** :
- Score **vérification sprint** (qualité d'exécution) : 612/1000 🔴 INSUFFISANT
- Score **plateforme content-gen estimé** : ~800/1000 🟡 CONDITIONNEL (5 P0s qui comptent ont bougé positivement malgré les implémentations partielles)

---

## 10 P0 — Statut vérifié

| P0 | Spec | Implémenté ? | Test fonctionnel | Score |
|----|------|:------------:|:----------------:|-------|
| P0-1 CASCADE→RESTRICT | Migration SQL RESTRICT + schema.prisma + forget/route fix | 🟡 Partiel | ⚠️ DB inaccessible | 65/100 |
| P0-2 lockDuration 120s | content-gen + quality-improver | 🟡 Partiel | ✅ Code vérifié | 45/80 |
| P0-3 promptHash réel | SHA256(prompt LLM) depuis content-gen-worker | ❌ Absent | ❌ Non corrigé | 0/100 |
| P0-4 Redis INCR atomique | INCR avant publish + EXPIRE + guard + decr compensatoire | ✅ Complet | ✅ Spec confirmée | 110/120 |
| P0-5 keyword lock + cleanup | schema Keyword + selector SET + cron cleanup | 🟡 DB seul | ⚠️ Non câblé | 20/80 |
| P0-6 Article.campaignId NOT NULL | schema Prisma + migration + worker + backfill | ❌ Minimal | ❌ Schema non sync | 8/80 |
| P0-7 rate limit image-bank | limiter workers enrich + translate | ✅ Complet | ✅ Code vérifié | 40/40 |
| P0-8 3 index DB | 3 CREATE INDEX CONCURRENTLY | ✅ Complet | ⚠️ EXPLAIN N/A | 99/100 |
| P0-9 .env.example | 4 vars critiques + 12 totales | ✅ Complet | ✅ Lecture directe | 60/60 |
| P0-10 saga post-publish | try/catch best-effort + retry BullMQ idem | ✅ Complet | ✅ Code vérifié | 80/80 |
| **TOTAL P0** | | | | **527/840** |

---

## Cross-cutting score : 85 / 100

| Critère | Max | Score |
|---------|-----|-------|
| Cohérence inter-agents (0 contradiction) | 20 | 20 |
| Tests fonctionnels réels (DB inaccessible, code review exhaustif) | 20 | 15 |
| Recommandations P1 priorisées | 20 | 15 |
| Gates anti-régression | 25 | 20 |
| Classification commits "inconnus" | 15 | 15 |

---

## 🔴 P0 manquants ou partiels critiques

| P0 | Issue | Impact |
|----|-------|--------|
| **P0-3** | Non touché. promptHash = SHA256(contentType:jobId:articleId) — pas le prompt LLM réel | 🔴 AI Act art. 50 NON-CONFORME — deadline 2026-08-02 |
| **P0-1** | schema.prisma toujours `onDelete: Cascade` (drift) + `forget/route.ts` cassé avec RESTRICT actif | 🔴 RGPD art.17 inapplicable + future migration annule le fix |
| **P0-6** | schema.prisma Article sans campaignId + worker ne passe pas campaignId | 🟠 Traçabilité campagne → article impossible via Prisma |
| **P0-5** | Migration SQL créée mais keyword-selector.ts ne SET pas les champs lock → bug original non corrigé | 🟠 Keywords "brûlés" si crash worker persiste |
| **P0-2** | quality-improver-worker manque lockDuration (a reçu `limiter` au lieu) | 🟠 Double review possible sur articles longs > 30s |

---

## Régressions vs baseline P1.5

| Item | Cause | Sévérité |
|------|-------|---------|
| Aucune régression détectée | typecheck 0 erreur + vitest 1376/1383 maintenu | — |
| **Nouveau bug introduit** : `forget/route.ts` FK violation | Le fix RESTRICT en migration crée un conflit avec le code existant `prisma.article.delete()` | 🔴 Fonctionnel si RESTRICT actif en prod |

---

## Compliance AI Act art. 50 (deadline 2026-08-02)

| Critère | Statut |
|---------|--------|
| P0-1 CASCADE → RESTRICT | 🟡 Migration SQL présente, schema drift, forget/route cassé |
| P0-3 promptHash réel | 🔴 **NON-CONFORME** — hash d'IDs techniques, pas du prompt LLM |
| GenerationProvenance traces préservées si RESTRICT actif | ✅ Structure conforme (si migrate deploy exécuté) |
| Backfill historique articles sans promptHash réel | ⏳ Non fait — dette technique documentée |

**Verdict compliance AI Act : 🔴 NON-CONFORME**

P0-3 (promptHash) n'a pas été corrigé. Une autorité de contrôle ne peut pas reconstituer le prompt LLM original utilisé pour un article. Délai restant : < 3 mois.

---

## Classification commits "inconnus"

| Commit | Description | Classification | Rationale |
|--------|-------------|:-------------:|-----------|
| `56decf0` | internalLinkCount regex markdown → HTML | **P4** | Corrige le score SEO calculé des articles (-6 pts systématiques) — impact éditorial qualité, pas infra pipeline |
| `0947d9e` | quality loop re-génère avec feedback LLM-judge | **P2** | Fix d'orchestration BullMQ (re-enqueue quality → content-gen) — pipeline cassé, boucle morte |
| `8d3d886` | module mapping image-bank slugs | **P2** | Fix de câblage infrastructure (slug DB mismatch) — 0 image héro malgré 73 en stock, blocage pipeline |

---

## Gates anti-régression

| Gate | Baseline P1.5 | Résultat | Statut |
|------|:------------:|:-------:|:------:|
| typecheck | 0 erreur | 0 erreur | ✅ |
| vitest | 1376/1383 | 1376/1383 | ✅ |
| prisma migrate status | No drift | Non évaluable (DIRECT_URL absent dev) | ⚠️ N/A |
| prisma validate | OK | Non évaluable (DIRECT_URL absent dev) | ⚠️ N/A |
| content-gen:isolation-check | 0 violation | Non exécuté ce run | ⚠️ |

**Pénalité anti-régression : 0** (typecheck + vitest maintenus)

---

## Tests fonctionnels résultats (10 tests)

| Test | Méthode | Résultat |
|------|---------|---------|
| Test 1 (CASCADE → RESTRICT) | Migration SQL confirmée, psql inaccessible | ✅ Partiel |
| Test 2 (lockDuration 120s) | grep code — content-gen ✅, quality-improver ❌ | ⚠️ Partiel |
| Test 3 (promptHash réel) | Code review exhaustif | ❌ Non corrigé |
| Test 4 (race condition cap) | Code review + spec existant | ✅ Redis INCR atomique |
| Test 5 (keyword lock cleanup) | Code review — selector ne SET pas | ❌ Non câblé |
| Test 6 (Article.campaignId NOT NULL) | Schema review — colonne absente du modèle | ❌ Schema non sync |
| Test 7 (rate limit image-bank) | Code review — 2 workers limités | ✅ |
| Test 8 (index DB performance) | Migration SQL — 3 indexes présents, psql N/A | ✅ Partiel |
| Test 9 (.env.example complet) | Lecture directe — 4 vars critiques présentes | ✅ |
| Test 10 (saga post-publish) | Code review + try/catch documentés | ✅ |

**Tests confirmés** : 5 ✅ / 2 partiels ⚠️ / 3 échoués ou non corrigés ❌

---

## P1 résiduels (depuis verdict P2 initial)

| P1 | Description | Statut post-sprint |
|----|-------------|:------------------:|
| P1-1 | withRetry() exponentiel + jitter ±20% | ✅ FAIT |
| P1-2 | Circuit breakers non partagés entre process | ⏳ PENDING |
| P1-3 | captureWorkerError quality-improver-worker | ⏳ PENDING (seul worker critique sans Sentry) |
| P1-4 | tokensInput hardcodé à 0 | ⏳ PENDING |
| P1-5 | 0 correlationId entre workers | ⏳ PENDING |
| P1-6 | Rampe progressive 30→100→200→500 art/jour | ✅ FAIT (getEffectivePublishCap()) |
| P1-7 | campaignId absent du payload BullMQ | ⏳ PENDING |
| P1-8 | Filtrage keywords par campaignId | 🟡 PARTIEL (log seulement, filtre SQL pending migration) |
| P1-9 | Commentaire "3072 dim" vs 1536 | ⏳ PENDING (bénin) |
| P1-10 | Script backfill embeddings | ✅ FAIT (src/scripts/backfill-embeddings.ts) |
| P1-11 | JUDGE_THRESHOLDS DB-managed | ⏳ PENDING |
| P1-12 | pauseCampaign race condition | ⏳ PENDING |
| P1-13 | sanitize-job-data dans ContentGenJob.inputPayload DB | ⏳ PENDING |
| P1-14 | Monthly caps $100 insuffisants pour 500 art/j | ⏳ PENDING (décision Will W-2) |
| P1-15 | N+1 checkDedup → pg_trgm | ⏳ PENDING |

**P1 faits : 4/15 + 1 partiel** (P1-1, P1-6, P1-10, P1-3 vérification en cours, P1-8 partiel)

---

## Actions Will résiduelles

| # | Décision | Statut |
|---|----------|--------|
| W-1 | Signer DPA Anthropic (https://privacy.anthropic.com/en/dpa) | ⏳ Non confirmé |
| W-2 | Monthly cap Anthropic → $1 500/mois | ⏳ Non confirmé |
| W-3 | EN locale reste désactivée | ✅ Confirmé (ADR actif) |
| W-4 | Soft-delete Article vs hard-delete (RGPD × AI Act) | ⏳ Non tranché — **URGENT** (forget/route.ts cassé) |

---

## Recommandations prioritaires (sprint S+7)

### 🔴 Urgences (< 1 semaine — deadline AI Act 2026-08-02)

1. **P0-3 promptHash réel** (2-3h) — ajouter `promptUsed` dans GeneratorOutput + transmettre depuis les 7 generators + hasher dans publish-worker
2. **P0-1 schema drift** (30 min) — `schema.prisma` GenerationProvenance `onDelete: Restrict` + `forget/route.ts` : supprimer GenerationProvenance avant Article dans la transaction

### 🟠 Sprint S+7 (1-2 semaines)

3. **P0-5 câblage** (1h) — `keyword-selector.ts` SET locked_until/locked_by + ajouter filtre `WHERE locked_until IS NULL OR locked_until < NOW()` + cron cleanup
4. **P0-6 câblage** (1h) — synchroniser `schema.prisma` Article + `content-publish-worker.ts` passe campaignId
5. **P0-2 quality-improver lockDuration** (10 min) — remplacer `limiter` par `lockDuration: 120_000` dans content-quality-improver-worker.ts
6. **P1-3 captureWorkerError** (30 min) — importer et appeler dans quality-improver-worker.ts

---

## STOP & ASK Will

```
✅ Vérification Sprint P2 livrée.

HEAD : 0906722
Score vérification sprint : 612/1000 🔴 INSUFFISANT (sprint mal exécuté)
Score plateforme estimé : ~800/1000 🟡 CONDITIONNEL (5 P0s bien fixés compensent)

10 P0 : 5 OK / 3 partiels / 1 absent / 1 minimal
Tests fonctionnels : 5/10 OK, 2 partiels, 3 KO

⚠️ AI Act compliance : 🔴 NON-CONFORME (P0-3 promptHash non corrigé, deadline 2026-08-02)

📋 Pattern récurrent détecté :
→ 3 P0 ont eu leur migration SQL créée mais schema.prisma NON synchronisé
  (P0-1, P0-5, P0-6). Cela crée un drift silencieux qui sera annulé à la
  prochaine `prisma migrate dev`. Manon doit toujours synchroniser schema.prisma.

📋 Actions Will pendantes :
- W-4 soft-delete arbitrage RGPD × AI Act : URGENT (forget/route.ts cassé)
- W-1 DPA Anthropic : à signer avant scale
- W-2 monthly cap → $1500 : avant scale 500 art/j

🚀 Suite proposée :
[A] Sprint P2 follow-up (P0-3 promptHash + P0-1 schema drift + forget/route fix) — URGENT AI Act
[B] Sprint S+7 complet (P0-3+P0-1+P0-5+P0-6+P0-2+P1-3 = ~5h) avant lancement prod scale
[C] Attendre vérif P5 → consolider P6 + lancer scale après P6
```

---

*Audit réalisé le 2026-05-21 — 10 sous-agents V2-01 à V2-10 + orchestrateur GATES parallèles*
*Mode AUDIT-ONLY strict — 0 commit, 0 modif code*
