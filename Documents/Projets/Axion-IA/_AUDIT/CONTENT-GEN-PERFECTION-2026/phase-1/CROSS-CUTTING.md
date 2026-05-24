# CROSS-CUTTING — Phase 1 Audit Forensique Content-Gen

> **Date** : 2026-05-21
> **Commit HEAD audité** : `2b98a7067d7eae701dec42a2c5d6e859364e0e64`
> **Site audité** : axion-ia.com
> **22 agents parallèles** — analyse transverse post-synthèse

---

## CC1 — Convergence Manon : impact

**État branches au moment de l'audit :**
- Branche locale : `main`
- Branche distante : `sprint-s0-pre-content-gen` (ancienne, non conflictuelle)
- WIP non poussé : `_AUDIT/CHANGELOG-v10.2.md` (D) + `_AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md` (M)

**Conclusion** : Aucune session Manon active. Audit en mode read-on-HEAD clean.
WIP = fichiers audit uniquement, 0 code prod modifié. Aucun flag shadow-read requis.

**Sprint S+5 P2 (commit `6aaa57f`)** : NON fusionné sur origin/main. Les 8 tests workers P2-10 mentionnés en mémoire ne sont pas dans HEAD — ils ne sont donc pas comptabilisés dans les scores. Cela impacte A22 (tests coverage).

---

## CC2 — Conformité légale : AI Act art. 50 + RGPD + Scaled Content

### ⚠️ DOUBLE HOLD — Publication 200+/jour bloquée

**AI Act art. 50 (A17 : 22/45 < 25/45) :**
- `/blog/[slug]` : JSON-LD `aiGenerated:true` **absent** (factory seo.ts au lieu de seo-content-gen-factories.ts)
- `/cas-concrets/[slug]` : même gap
- `GenerationProvenance` model absent de schema.prisma — 0 traçabilité réglementaire
- DPA Anthropic/Perplexity/OpenAI : statut `🟡 À SIGNER` dans DPA-REGISTER.md — dates non confirmées
- Retention audit log : 12 mois via `onDelete:Cascade` vs 6 ans minimum requis AI Act
- **Deadline : 2026-08-02 (73 jours)**

**Scaled Content Abuse Policy Google (A18 : 17/40 < 22/40) :**
- `MAX_PUBLISH_DAY` absent — aucun cap dur sur publications quotidiennes
- Anti-burst étal les *générations* sur 24h UTC mais pas les *publications*
- Publications possibles de 0h-6h CET + samedi/dimanche → signal non-humain
- `factoryAutoPublishAllBlogTypes=true` court-circuite la review humaine tout en déclarant « supervisé avant publication » → contradiction légale AI Act

**Quick fix estimé pour lever le double HOLD :**
1. Migrer `/blog/[slug]` → `buildBlogPostingJsonLd` (30 min, no-brainer)
2. Mettre à jour DPA-REGISTER.md avec dates réelles signatures (action Will, hors-code)
3. Ajouter `MAX_PUBLISH_PER_DAY=30` const + check dans publish-worker (2h)
4. Désactiver `factoryAutoPublishAllBlogTypes` en prod (1 ligne env Coolify)

---

## CC3 — Cost current run-rate + projections

**Données mesurées depuis code (A20) :**
- Model `CostLedger` opérationnel, écriture transactionnelle par provider/model/job
- Prompt caching Anthropic activé (system prompt uniquement)
- `cacheReadInputTokens` capturé dans code mais **non persisté** en DB → cache hit rate immesurable

**Coût par article estimé (calcul depuis config code) :**
| Type | Coût estimé |
|---|---|
| blog-article (Sonnet 4.6) | ~$0.039/article |
| guide-pilier (Sonnet 4.6, 12 calls) | ~$0.47/article |
| landing-ville | ~$0.035/article |

**Projections scénarios (hors Batch API) :**
| Scénario | Articles/jour | Coût Claude/mois |
|---|---|---|
| A | 50 | ~$95 |
| B | 200 | ~$318 |
| C | 500 | ~$840 |

**Économies non capturées :**
- Batch API Anthropic (50% réduction) : non utilisé. Pour 200 art/j non-temps-réel → économie ~$160/mois
- KB context (1500 tokens) répété sans cache dans guide-pilier : surcoût ×3-5 évitable

**Run-rate infra mensuel estimé :** Hetzner CPX42 ~€30 + CF + domain ~€20 = **~€50/mois infra** (indépendant du volume contenu)

---

## CC4 — Test coverage content-gen

**Chiffres officiels (coverage-summary.json HEAD) :**
- Lines : **7.9%** (1 709/21 617 lignes dans src/server/content-gen/)
- Functions : **34.9%** (105/301)
- Branches : **60%** (438/730)

**Generators (7 types) : 0% de coverage** — aucun test unitaire, aucun snapshot.

**Workers : 9/16 testés** (Sprint S+5 P2 en WIP non poussé aurait ajouté 8 → non compté)

**E2E Playwright :** 5 fichiers content-gen existent mais 3/5 sont `test.skip` conditionnels + `continue-on-error: true` en CI → Playwright ne bloque pas le merge.

**Thresholds CI actuels :** 24% (ratchet plancher descendu depuis 60% à cause de l'ajout admin V2 + image-bank). Pas de `.coverage-baseline.json` → ratchet inopérant.

**Verdict : coverage content-gen non sécurisé.** Un régression majeure peut passer en prod sans alerte CI.

---

## CC5 — Failure modes & resilience

**Synthèse cross-agents des failure modes critiques :**

| Failure mode | État | Sévérité |
|---|---|---|
| Claude API down (429/500) | `withRetry` x3 (10/30/60s) → DLQ ✅ | Géré |
| Worker crash mi-article | Drafts sauvegardés en DB (`status=running` stale) ❌ | P1 — pas de timeout BullMQ |
| Image-bank vide pour topic | Heroimage never set → article sans image ❌ | P0 — assignation absente |
| DB lock contention | Pas de `SELECT FOR UPDATE` sur keywords → collision possible | P1 |
| Queue stuck (>1000 jobs) | Limiter 10 RPM BullMQ — backpressure géré mais latence augmente | Géré |
| Embedding provider down | Embeddings non implémentés → pas de failure mode à gérer | N/A (gap à construire) |
| IndexNow down | fail-streak Redis avec alertes Telegram ✅ | Géré |
| Quality improver crash | Worker skeleton → jamais appelé → pas de failure | N/A (skeleton) |
| SimHash layer 3+4 | NO-OP silencieux (void fingerprint) → failure invisible ❌ | P0 |
| Pause campagne | Jobs déjà en queue continuent → coût non arrêté ❌ | P0 |

---

## CC6 — Contradictions entre agents

| Contradiction | Agent A | Agent B | Arbitrage |
|---|---|---|---|
| Quality improver "actif" | A02 mentionne worker | A03+A16 confirment skeleton | **Skeleton confirmé** — A03+A16 ont lu le fichier |
| KB sectorielle : 5 verticales vs 6 secteurs | A01 (6 secteurs-métier) | A11 (5 verticales) | **Les deux coexistent** — secteurs ≠ verticales Axion-IA, mapping absent |
| `sites_web_augmentes` dans enum | A01 absent | A05 absent | **Confirmé absent** — enum `ServiceSector` schema.prisma |
| Sentry : 4 workers couverts vs insuffisant | A20 (4 chokepoints + 5 image-bank) | A02 (observabilité manquante) | **4/16 workers content-gen** — partiel mais fonctionnel sur les 4 critiques |
| DPA signés ou non | A17 (🟡 À SIGNER dans registre) | Mémoire (signés S+4) | **UNKNOWN** — DPA-REGISTER.md dit À SIGNER, mémoire dit signé S+4. **Vérifier Will.** |

---

## CC7 — Gaps majeurs : Top 10 P0 (tous agents confondus)

Classés par impact business décroissant :

| Rang | P0 | Agents | Impact | Fix estimé |
|---|---|---|---|---|
| 1 | **AI Act JSON-LD `aiGenerated:true` absent sur /blog + /cas-concrets** | A06, A17 | Amende 7,5M€ / deadline 2026-08-02 | 30 min |
| 2 | **`MAX_PUBLISH_PER_DAY` absent — anti-burst publication manquant** | A12, A18 | Penalty Google scaled content abuse | 2h |
| 3 | **LLM-as-judge absent — `editorialScore` jamais calculé** | A03, A16 | 0% contrôle qualité réelle | 8-12h |
| 4 | **Image hero jamais assignée dans pipeline** | A07 | Tous articles sans image → thin content + SEO -30% | 4-6h |
| 5 | **`internalLinkCount` jamais passé au seo-score** | A08 | SEO score structurellement faux depuis création pipeline | 1h |
| 6 | **SimHash couches 3+4 = NO-OP silencieux** | A09 | Near-duplicates non détectés à l'échelle | 4-8h |
| 7 | **Seeds keywords déconnectés du pipeline** | A04 | 747 seeds inutilisés, génération sur keywords hardcodés | 4h |
| 8 | **Adresse FR placeholder `[Ville — France]`** | A10 | Local SEO nul, Google Business Profile impossible | Action Will |
| 9 | **`GenerationProvenance` model absent** | A01, A17 | Traçabilité AI Act nulle, non-exportable régulateur | 4h |
| 10 | **`pauseCampaign()` ne purge pas les jobs BullMQ** | A13 | Coût continue après pause — burn budget | 2h |

---

## CC8 — Quick wins : Top 10 P1 avec effort <4h

| # | Quick win | Effort | Impact |
|---|---|---|---|
| QW-1 | Migrer `/blog/[slug]` → `buildBlogPostingJsonLd` (AI Act) | 30 min | Lève double HOLD |
| QW-2 | Passer `internalLinkCount` réel au seo-score dans 4 generators | 1h | SEO score fiable |
| QW-3 | Désactiver `factoryAutoPublishAllBlogTypes` en prod (env Coolify) | 5 min | Lève risk HCU |
| QW-4 | Ajouter `MAX_PUBLISH_PER_DAY=30` const + check | 2h | Anti-burst publication |
| QW-5 | Fix bug regex H1 `seo-score.ts:91` (cherche dans markdown brut) | 1h | SEO score +4pts/article |
| QW-6 | Persister `cacheReadInputTokens` dans CostLedger | 2h | Cache hit rate mesurable |
| QW-7 | Ajouter `AiContentDisclaimer` sur `/cas-concrets/[slug]` | 30 min | Conformité AI Act |
| QW-8 | Fix bug `isAiGenerated = !isLogo` dans seed-images.ts (126 images mal tagguées) | 1h | Doctrine 0 IA générative |
| QW-9 | Ajouter page désambiguïsation "Axion-IA ≠ axionai.fr" | 2h | Brand SEO domination |
| QW-10 | Injecter `AggregateRating` JSON-LD (code déjà disponible) | 1h | Étoiles dans SERPs |
