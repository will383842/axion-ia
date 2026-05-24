# VERDICT PHASE 1 — AUDIT FORENSIQUE EXISTANT

## Date : 2026-05-21
## Commit HEAD audité : `2b98a7067d7eae701dec42a2c5d6e859364e0e64`
## Site : axion-ia.com
## Durée audit : ~6h (22 sous-agents en parallèle)

---

## Score D-État /1000 (pondéré par criticité business)

| Agent | Score /poids | Poids | Catégorie | Statut |
|---|---|---|---|---|
| A01 Inventory | 33/40 | 40 | C1 Pipeline | 🟡 |
| A02 Pipeline E2E | 32/45 | 45 | C1 Pipeline | 🟡 |
| A03 Quality (valeur lecteur enrichi) | 38/65 | 65 | C2 Qualité | 🟠 |
| A04 Keywords-intent | 29/50 | 50 | C3 SEO | 🟠 |
| A05 Templates 7 types | 25/45 | 45 | C11 Templates | 🟠 |
| A06 SEO/AEO/GEO (Featured + KG + Wikidata) | **46/75** | **75** ⭐ | C3-C7 | 🟠 |
| A07 Images | 21/40 | 40 | C8 Images | 🟠 |
| A08 Liens internes/externes/suggested | 12/40 | 40 | C9 Maillage | 🔴 |
| A09 Dedup anti-thin | 20/50 | 50 | C10 Anti-doublons | 🟠 |
| A10 Géo villes coverage | 36/55 | 55 | C2+C3 | 🟡 |
| A11 KB zéro invention | 26/60 | 60 | C2 Qualité | 🔴 |
| A12 Admin console (GSC+Bing+refresh+drip) | 23/45 | 45 | C13 Console | 🟠 |
| A13 Campagnes multi-parallèles | 30/45 | 45 | C1+C15 | 🟡 |
| A14 Prompts architecture | 19/45 | 45 | C12 Prompts | 🔴 |
| A15 Publish/Sitemap/IndexNow | 40/45 | 45 | C1+C15 | 🟢 |
| A16 Auto-review LLM-as-judge | **7/50** | 50 | C2+C15 | 🔴🔴 |
| **A17 AI Act + RGPD forensique** | **22/45** | 45 🚨 | C14 Compliance | **🔴 HOLD** |
| **A18 Scaled Content Abuse Policy** | **17/40** | 40 🚨 | C14 Compliance | **🔴 HOLD** |
| A19 Analyse compétitive | 23/30 | 30 | Strategy | 🟢 |
| A20 Observability + Cost economics | 10/35 | 35 | C15 Ops | 🔴 |
| A21 i18n FR/EN bilingue | 11.5/25 | 25 | C3 SEO | 🟠 |
| A22 Tests Coverage | 11/30 | 30 | C15 Ops | 🔴 |
| **TOTAL D-État** | **531.5/1000** | — | — | **🟠 REFONTE PARTIELLE** |

---

## ⚠️ Cas critique compliance — DOUBLE HOLD

**A17 (AI Act) : 22/45 < seuil 25/45 → HOLD PUBLICATION 200+/JOUR**
**A18 (Google policy) : 17/40 < seuil 22/40 → HOLD PUBLICATION 200+/JOUR**

**Publication sécurisée max actuelle : ~20 articles/jour** jusqu'à correction des 5 P0 compliance.
Deadline absolue : **2026-08-02** (AI Act art. 50 — 73 jours).

---

## Top 10 P0 (bloquants)

| # | Titre | Agents | Impact | Effort fix |
|---|---|---|---|---|
| 1 | **JSON-LD `aiGenerated:true` absent sur /blog + /cas-concrets** | A06, A17 | Amende AI Act 7,5M€ — deadline 2026-08-02 | 30 min |
| 2 | **`MAX_PUBLISH_PER_DAY` absent** | A12, A18 | Penalty Google scaled content abuse | 2h |
| 3 | **LLM-as-judge absent — `editorialScore` jamais calculé** | A03, A16 | Qualité publiée non contrôlée | 8-12h |
| 4 | **Image hero jamais assignée dans pipeline** | A07 | Tous articles sans image → thin + SEO | 4-6h |
| 5 | **`internalLinkCount` jamais passé au seo-score (4 generators)** | A08 | SEO score structurellement faux | 1h |
| 6 | **SimHash couches 3+4 = NO-OP silencieux** | A09 | Near-duplicates non détectés à l'échelle | 4-8h |
| 7 | **Seeds keywords déconnectés du pipeline (747 seeds inutilisés)** | A04 | Génération sur hardcoded uniquement | 4h |
| 8 | **Adresse FR placeholder `[Ville — France]`** | A10 | Local SEO nul, GBP impossible | Action Will |
| 9 | **`GenerationProvenance` model absent** | A01, A17 | Traçabilité AI Act nulle | 4h |
| 10 | **`pauseCampaign()` ne purge pas jobs BullMQ** | A13 | Coût continue après pause | 2h |

---

## Top 20 P1 (optimisations critiques)

| # | Titre | Agent | Effort |
|---|---|---|---|
| 1 | KB context guide-pilier non caché (×5 coût inutile) | A14 | 2h |
| 2 | `cacheReadInputTokens` non persisté en DB | A20 | 2h |
| 3 | Wikidata Q-ID Axion-IA absent de `sameAs` Organization | A06, A11 | Action Will 1-2h |
| 4 | `abstract` JSON-LD absent sur articles blog | A06 | 1h |
| 5 | Factual claims non contrôlés (watchwords pseudo-sources non bloqués) | A11 | 4h |
| 6 | `ExternalLinkSource` table absente — liens externes non validés | A08 | 4h |
| 7 | Hreflang EN hardcodé dans root layout sans `isEnLocaleDisabled()` | A21 | 30 min |
| 8 | `publishedCount/failedCount` figés à 0 dans campagnes | A13 | 2h |
| 9 | Keyword lock inter-campagnes absent (collision keywords possibles) | A13 | 3h |
| 10 | 0 partials modulaires `_vertical-{v}` / `_audience-{a}` dans prompts | A14 | 8h |
| 11 | 0 XML tags Anthropic best practices (prompts markdown brut) | A14 | 4h |
| 12 | KB globale `kb/global/axionia-entity.ts` absente | A11 | 2h |
| 13 | KB sectorielle manquante pour verticals `un_a_un` + `sites_web_augmentes` | A11 | 4h |
| 14 | `sites_web_augmentes` absent de l'enum Prisma `ServiceSector` | A01, A05 | 2h + migration |
| 15 | E2E Playwright bloquant non configuré (continue-on-error: true) | A22 | 2h |
| 16 | 12 workers content-gen sans couverture Sentry | A20 | 4h |
| 17 | Tokens timeout BullMQ absent (jobs `status=running` stale indéfiniment) | A02 | 2h |
| 18 | `articles_rss` génère du contenu type landing au lieu d'actualité | A05 | 4h |
| 19 | Pas de cost cap per-campaign (seulement per-provider) | A13 | 3h |
| 20 | Robot's.txt CF Managed Content status non vérifié prod | A15 | Action Will |

---

## Quick wins (effort <4h, impact ≥P1)

| # | Action | Temps | Impact |
|---|---|---|---|
| QW-1 | Migrer `/blog/[slug]` → `buildBlogPostingJsonLd` | 30 min | 🚨 Lève HOLD AI Act |
| QW-2 | `MAX_PUBLISH_PER_DAY=30` const + check publish-worker | 2h | 🚨 Lève HOLD Google |
| QW-3 | Désactiver `factoryAutoPublishAllBlogTypes` env Coolify | 5 min | 🚨 Anti-HCU |
| QW-4 | Fix `internalLinkCount` passé aux 4 generators | 1h | SEO score correct |
| QW-5 | Fix bug regex H1 seo-score.ts:91 | 1h | +4pts/article |
| QW-6 | `AiContentDisclaimer` sur `/cas-concrets/[slug]` | 30 min | AI Act conforme |
| QW-7 | Fix bug `isAiGenerated = !isLogo` seed-images.ts | 1h | Doctrine 0 IA générative |
| QW-8 | Persister `cacheReadInputTokens` dans CostLedger | 2h | Cache hit rate mesurable |
| QW-9 | Page désambiguïsation "Axion-IA ≠ axionai.fr" | 2h | Brand SEO protection |
| QW-10 | Injecter slogan dans meta descriptions (brand.ts → templates) | 1h | Différenciateur SERP |

---

## UNKNOWNs (à confirmer Will)

1. **DPA Anthropic/Perplexity/OpenAI** : réellement signés (mémoire session S+4) ou encore à signer (DPA-REGISTER.md dit "À SIGNER") ? → Vérifier dates signatures Coolify
2. **CF Managed Content status prod** : ClaudeBot/GPTBot actuellement bloqués ou autorisés ?
3. **`GOOGLE_INDEXING_API_ENABLED` en prod** : brûle quota pour rien (API accepte seulement JobPosting/BroadcastEvent, pas Article)
4. **73 images Will importées** : réellement dans `public/images/` ou toujours en attente ?
5. **Sprint S+5 P2 commit `6aaa57f`** : push prévu quand ? (8 tests workers non comptabilisés)
6. **GSC service account scope** : `readonly` ou `write` (pour URL Inspection API) ?

---

## Inputs pour phases suivantes

### → P2 (Architecture Data Pipeline)
- Ajouter model `GenerationProvenance` (AI Act art. 50, 6 ans retention, append-only hash-chaîné)
- Ajouter model `ExternalLinkSource` (maillage externe validé DA/DR)
- Ajouter enum `sites_web_augmentes` + migration Prisma
- Architecture dedup 3 niveaux (SimHash O1 → cosine pgvector → Copyscape)
- Architecture fact-checking layer : `KbFact` table + claim extraction service
- Workers: timeout BullMQ + idempotency sur restart
- Image assignment service : connect generators → image-bank queries
- Keyword seeds → table Prisma + pipeline connection
- `MAX_PUBLISH_PER_DAY` const + drip scheduler 8h-22h CET + pause weekend

### → P3 (SEO/AEO/GEO 2026)
- Wikidata Q-ID Axion-IA création (action Will 1-2h)
- `abstract` JSON-LD sur tous articles blog
- Knowledge Graph entity strategy (Organization sameAs exhaustif)
- Featured Snippets framework par type de contenu
- Stratégie brand domination anti-axionai.fr (page désambiguïsation)
- Fix hreflang EN root layout (30 min)
- Sitemap images : vérifier URLs villes T1 (38 manquantes physiquement)
- `peopleAlsoAsk` enrichissement DB (harvest PAA Google sur 747 seeds)

### → P4 (Editorial Quality Templates)
- LLM-as-judge multi-dim : factual_accuracy / depth / originality / readability / seo / value_to_reader / tone
- Seuils opérationnels : publish ≥8.5, improve 7-8.5, reject <7 (vs 60/100 actuels)
- Reviewer ≠ Generator (Opus pour review si Sonnet génère)
- Quality gate valeur lecteur : hook ouverture, mental models, storytelling B2B, actionable takeaways
- 7 templates différenciés complets (blog-from-title crash fixé, qa-derived recyclage LLM-free, comparatif ClaimReview)
- Anti-fabrication watchwords dans doctrine-check
- Clause anti-hallucination dans TOUS les SYSTEM_PROMPT
- XML tags + partials modulaires (_vertical, _audience, _city)

### → P5 (Console Admin Ops)
- `/content-gen/articles` : colonnes ville/type/secteur + pagination réelle
- `/content-gen/keywords` : CRUD seeds keywords
- Drip scheduler UI : 8h-22h CET, pause weekend
- Refresh strategy : articles >6 mois auto-flagués
- Anomaly detection : quality_score drops, refusal_rate spike, cost anomaly
- Email digest hebdomadaire Will (lundi 8h CET)
- Indexation timeline tracking par article
- 12 workers content-gen → Sentry coverage

### → P6 (Roadmap Execution)
- Budget mensuel finalisé (scénario B recommandé ~$400/mois Claude + Batch API)
- Batch API Anthropic pour jobs non-temps-réel → -50% coût
- Targets : 3400 articles × 5 verticales × 3 cibles × 120 villes
- Coverage tests : 0% generators → 70%+ (8 snapshots + unitaires)

---

## Verdict synthétique (1 paragraphe)

Le système content-gen axion-ia.com est à **531.5/1000 (53.2%) — REFONTE PARTIELLE**. L'infrastructure de base est solide : pipeline BullMQ fonctionnel, anti-burst générations, campagnes multi-parallèles, sitemap multi-tiers excellent (A15 : 40/45), admin V2 shell propre, KB villes V3 sourcée, local SEO géographique bien structuré. Mais 10 P0 critiques bloquent le scale : (1) double HOLD compliance — AI Act `aiGenerated:true` absent sur `/blog` et cap journalier publication manquant, deadline absolue **2026-08-02** ; (2) le LLM-as-judge n'existe pas (7/50), les 747 seeds keywords sont déconnectés du pipeline, les images hero ne sont jamais assignées, et la déduplication SimHash est un NO-OP silencieux. Le coût actuel est maîtrisé (~$95/mois pour 50 art/j) mais non optimisé (Batch API, KB caching). Recommandation : **sprint P0-compliance immédiat (~1 jour, 5 quick wins)** pour lever le double HOLD, puis P2/P3/P4 en parallèle en calibrant sur ces findings réels.

---

## STOP & ASK Will — 12 axes d'amélioration (décisions requises avant P2/P3/P4)

1. **DPA providers** : Les clés API Anthropic/Perplexity/OpenAI sont-elles actives en prod Coolify SANS DPA signé formellement ? → si oui, arrêt clés ou signature urgente avant 2026-08-02.

2. **Cap journalier publication** : `MAX_PUBLISH_PER_DAY` = combien ? Recommandation : 30/jour (prudent) ou 50/jour (agressif mais risqué). Votre choix ?

3. **Verticale `sites_web_augmentes`** : ajouter migration Prisma maintenant (P2 inclus) ou attendre validation positionnement de cette verticale ?

4. **Embedding provider** : OpenAI text-embedding-3-large (~$0.13/M tokens) ou Voyage AI ou autre ? Nécessaire pour activer dedup couche 4 (cosine pgvector). Budget déduplication ?

5. **Wikidata Q-ID Axion-IA** : créer maintenant (action manuelle Will, 1-2h sur Wikidata.org) pour ancrer l'entité Knowledge Graph ? Crucial pour A06 GEO et axionai.fr brand confusion.

6. **Auteur E-E-A-T** : Will Jullin (Person réel avec LinkedIn + sameAs) OU persona fictif AxionIA (Manon ?) ? Décision impacte JSON-LD Person, page auteur, E-E-A-T Google.

7. **Adresse FR Local SEO** : WeWork Paris ~300€/mois (recommandé audit précédent) pour NAP cohérent + GBP × 39 villes ? Ou alternative (domiciliation ~50€/mois) ? Bloquant pour Local Pack Google.

8. **Cost cap mensuel Claude** : $500 / $1 000 / $1 500 / $3 000 ? Impacte le scénario de scale. Batch API Anthropic OK pour activer (50% économie sur non-temps-réel) ?

9. **Plagiarism check externe** : Copyscape (~$0.05/scan = ~$150/3K articles/mois à scénario B) — OK budget ? Sinon, Jaccard interne seul jusqu'à 10K articles est acceptable ?

10. **GSC API service account** : scope `write` pour URL Inspection API (désactiver `GOOGLE_INDEXING_API_ENABLED` inutile — API n'accepte pas les articles) ? Et Bing WMT API key : avez-vous la clé `BING_WMT_API_KEY` ?

11. **Reviewer modèle** : LLM-as-judge avec **Claude Opus** (meilleure qualité, coût ×5) ou **Claude Sonnet** (équilibre coût/qualité) ? Sonnet génère, Opus review ?

12. **Sandbox preview mode** : obligatoire avant publish pour TOUS (approval workflow humain) ou seulement si quality_score < 8.5 ? `factoryAutoPublishAllBlogTypes` — le laisser actif ou désactiver définitivement ?

---

## 🆕 Bonus addendum complémentaire `/95` (livré 2026-05-21)

Le PROMPT-1-ADDENDUM-FLOWS-UX-CAMPAGNES-2026-05-21.md a ajouté 3 mini-audits complémentaires hors scoring parent. Score addendum **`46/95 (48 %)` 🟠 SPRINT CORRECTIF** :

| Mini-audit | Score | % | Statut | Fichier |
|---|---|---|---|---|
| A02-Add — 7 flows distincts par type contenu | **15/35** | 43 % | 🟠 | `phase-1/addendum/A02-flows-by-type.md` |
| A12-Add — UX simplicité console admin V2 | **17/30** | 57 % | 🟠 | `phase-1/addendum/A12-ux-simplicite-admin.md` |
| A13-Add — Programmation campagnes avancée | **14/30** | 47 % | 🟠 | `phase-1/addendum/A13-programmation-campagnes-avancee.md` |
| **TOTAL Addendum** | **46/95** | **48 %** | **🟠** | `phase-1/addendum/SYNTHESE-ADDENDUM.md` |

**Le score parent P1 reste inchangé à 531.5/1000.** Le bonus addendum est complémentaire (doctrine §4 du prompt addendum), reporté ici comme signal staff engineer review.

### Top 12 P0 cross-cutting addendum
1. Implémenter `qa_derived` generator (Q/R + cosine anti-cannibalisation) — 8-12h
2. Implémenter `comparison` generator (tableau + ClaimReview JSON-LD) — 8-12h
3. `CampaignTemplate` table + 6 presets seedés (D-Add-3) — 4-6h
4. Étendre `CoverageCampaign` : cronExpression + scheduledStart + type + priority — 4h
5. `pilier` outline review humain (status `pending_human_outline_review`) — 4-6h
6. Table `ContentGenFlowMetrics` daily aggregation per-flow — 6h
7. Collapse Réglages dashboard 10 → 3 tabs — 3h
8. Persist "Nouvelle campagne" sidebar — 2h
9. Wizard 4-step création campagne (D-Add-2) — 8h
10. Inline pause/resume dashboard cards — 4h
11. Délai 48h post-publication source `article_rss` — 1h
12. DLQ explicite + Telegram dead-letter alerts tous workers — 4h

**Total P0 addendum** : ~55-65h (~10 sprint days).

### 3 décisions Will addendum (STOP & ASK)

- **D-Add-1** — Flow `pilier` : étape outline review humain (a) obligatoire / (b) skippable si score ≥9.0 / (c) obligatoire 1ères 20 piliers puis (b) — reco (c)
- **D-Add-2** — UX wizard campagne : (a) wizard 4 étapes / (b) page monolithique — reco (a) aligné Will exigence « simple »
- **D-Add-3** — Templates presets initiaux : valider la liste de 6 templates (PME audits / interventions weekly / TPE burst / ETI pilier monthly / Cities Paris burst / RSS daily)

Voir `phase-1/addendum/SYNTHESE-ADDENDUM.md` pour le détail.

---

*Fin PHASE-1-VERDICT + Bonus Addendum. Cap actuel pipeline post-P1.5 = 30 articles/jour avec compliance OK. Items P0 addendum à séquencer dans P6 roadmap chiffrée.*
