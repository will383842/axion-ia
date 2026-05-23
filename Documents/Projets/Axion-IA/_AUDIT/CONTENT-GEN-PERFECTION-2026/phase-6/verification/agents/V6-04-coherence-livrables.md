# V6-04 — Cohérence inter-livrables P6
## Date : 2026-05-22 | Score : 0/100

---

## Vérification 1 : Score /5000 entre fichiers

| Fichier | Valeur déclarée |
|---|---|
| PHASE-6-VERDICT-GLOBAL.md | **3805/5000** |
| ROADMAP-EXECUTION-CHIFFREE.md | **3805/5000** |
| CROSS-CUTTING.md | **3805/5000** |
| A6-01-score-consolide.md | **3598/5000** |
| A6-12-recommandation-finale.md | **3598/5000** |

**Verdict : ❌ DISCORDANCE MAJEURE** — Les agents A6-01 et A6-12 (produits 2026-05-21, HEAD e0b1973) affichent 3598, tandis que les 3 livrables principaux (mis à jour 2026-05-22) affichent 3805. La justification contextuelle existe (commits post-P6 documentés) mais les agents eux-mêmes n'ont pas été mis à jour. Un lecteur qui compare A6-01 et VERDICT-GLOBAL voit deux scores différents sans pouvoir les réconcilier facilement.

---

## Vérification 2 : Verdict GO/SPRINT/NO-GO

| Fichier | Verdict |
|---|---|
| PHASE-6-VERDICT-GLOBAL.md | 🟡 CONDITIONNEL (SPRINT CORRECTIF) |
| ROADMAP-EXECUTION-CHIFFREE.md | CONDITIONNEL (implicite) |
| CROSS-CUTTING.md | 🟡 CONDITIONNEL |
| A6-01 | 🟡 CONDITIONNEL |
| A6-12 | CONDITIONNEL (SPRINT CORRECTIF) |

**Verdict : ✅ COHÉRENT** — Tous les fichiers convergent vers "CONDITIONNEL / SPRINT CORRECTIF". Aucun fichier ne dit GO ou NO-GO.

---

## Vérification 3 : Recommandation Will — D13 entre livrables

**D13 — Sprint A lancement :**
| Fichier | Recommandation D13 |
|---|---|
| PHASE-6-VERDICT-GLOBAL.md §9 | **C** (vérification légère 2h + Sprint A) |
| DECISIONS-CANONIQUES-FINALES.md | **A** (Immédiat) |
| A6-11 one-liner | **C** |

**Verdict : ❌ DISCORDANCE MAJEURE** — Le fichier canonique des décisions recommande A, le verdict global recommande C, et A6-11 recommande C. Le fichier DECISIONS-CANONIQUES-FINALES.md contient la mauvaise recommandation pour D13.

**D22 :**
| Fichier | Contenu |
|---|---|
| PHASE-6-VERDICT-GLOBAL.md §9 | Liste D22 (no-table gate exception comparison.ts) |
| DECISIONS-CANONIQUES-FINALES.md | **Absent** — 14 décisions seulement (D8-D21) |

**Verdict : ❌ DISCORDANCE MINEURE** — D22 présente dans VERDICT-GLOBAL absente de DECISIONS-CANONIQUES.

---

## Vérification 4 : KPIs — VERDICT-GLOBAL §8 vs KPIS-12-MOIS-CHIFFRES

| KPI | VERDICT-GLOBAL §8 | KPIS-12-MOIS-CHIFFRES | Cohérent ? |
|---|---|---|---|
| Articles cumulés Q3 (K1) | ~2 800 | 4 000 | ❌ |
| Articles cumulés Q4 (K1) | ~11 800 | 22 000 | ❌ |
| Articles cumulés Q1 27 (K1) | ~38 800 | 49 000 | ❌ |
| Articles cumulés Q2 27 (K1) | ~84 800 | 54 000 | ❌ |
| Impressions GSC Q3 (K5) | ~50K | 50K | ✅ |
| Impressions GSC Q4 (K5) | ~200K | 200K | ✅ |
| Score /5000 Q3 (K14) | ~3 949 | ~3 942 | ✅ (diff ~7 pts) |
| Score /5000 Q4 (K14) | ~4 087 | ~4 180 | ❌ (~93 pts) |
| Compliance AI Act Q3 (K15) | 100% | 95% | ❌ |
| Citations AI Overviews Q3 (K10) | ~20 | 5 | ❌ (×4) |
| Citations AI Overviews Q4 (K10) | ~80 | 20 | ❌ (×4) |

**Verdict : ❌ DISCORDANCE MAJEURE** — K1 (articles cumulés) systématiquement discordant (scénarios de volume différents), K10 (Citations AI) ×4 d'écart, K15 (compliance Q3 100% vs 95%).

---

## Vérification 5 : Coûts $ — VERDICT-GLOBAL §7 vs COUTS-ESTIMES-12-MOIS

| Poste | VERDICT-GLOBAL §7 | COUTS-ESTIMES (BASELINE) | Cohérent ? |
|---|---|---|---|
| LLM Anthropic génération TOTAL | $8 370 | $5 800 | ❌ |
| LLM OpenAI embeddings TOTAL | $43 | $29 | ❌ |
| LLM dev sprints TOTAL | $145 | $360 | ❌ |
| Infra Hetzner TOTAL | $200 | $200 | ✅ |
| Adresse FR TOTAL | $300 | $400 | ❌ |
| **TOTAL sans Ahrefs** | **$9 058** | **$6 789** | **❌ (Δ $2 269)** |

**Verdict : ❌ DISCORDANCE MAJEURE** — Presque tous les postes sont discordants. L'écart total est de $2 269. Les deux fichiers utilisent visiblement des hypothèses de volume différentes. Seule l'infra Hetzner est cohérente.

---

## Vérification 6 : Top 3 risques — VERDICT-GLOBAL §6 vs RISQUES-MITIGATION

| VERDICT-GLOBAL §6 | RISQUES-MITIGATION | Cohérent ? |
|---|---|---|
| R4 AI Act art. 50 deadline J+72 (🔴 CRITIQUE) | R4 = "Concurrent axionai.fr" | ❌ R4 désigne des risques différents |
| R5 commit 023266f9 non pushé (🔴 CRITIQUE) | R5 = "Double publication BullMQ" | ❌ R5 désigne des risques différents |
| R1 HCU Google (🔴 HAUTE) | R1 = "HCU Google scaled content" | ✅ |

**Verdict : ❌ DISCORDANCE MAJEURE** — La numérotation R4 et R5 désigne des risques entièrement différents dans les deux fichiers. Le "top 3 risques" de VERDICT-GLOBAL §6 n'est pas le top 3 de la matrice RISQUES-MITIGATION. Seul R1 est cohérent.

Note : l'incohérence est expliquée par le fait que R4/R5 dans VERDICT-GLOBAL correspondent à des risques "émergents P6.1" (post-audit) qui n'ont pas été ajoutés à RISQUES-MITIGATION.

---

## Récapitulatif discordances

| # | Vérification | Type | Sévérité | Déduction |
|---|---|---|---|---|
| V1 | Score /5000 : 3598 vs 3805 entre agents et livrables | Discordance | Majeure | -20 pts |
| V2 | Verdict GO/SPRINT/NO-GO | Cohérence | — | 0 pts |
| V3a | D13 reco C (VERDICT) vs A (DECISIONS-CANONIQUES) | Discordance | Majeure | -20 pts |
| V3b | D22 absente de DECISIONS-CANONIQUES-FINALES | Discordance | Mineure | -10 pts |
| V4 | KPIs K1/K10/K14/K15 discordants entre §8 et KPIS-12M | Discordance | Majeure | -20 pts |
| V5 | Coûts : $9 058 vs $6 789 — tous postes discordants | Discordance | Majeure | -20 pts |
| V6 | Numérotation R4/R5 désigne risques différents | Discordance | Majeure | -20 pts |

**Calcul : 100 − (5 × 20) − (1 × 10) = 100 − 110 = −10 → plafonné à 0/100**

---

**Score V6-04 : 0/100** 🔴

Les 5 discordances majeures révèlent que PHASE-6-VERDICT-GLOBAL §7, §8 et §6 ont été rédigés avec des hypothèses ou sources différentes de celles des livrables dédiés COUTS-ESTIMES, KPIS-12-MOIS et RISQUES-MITIGATION. Ces fichiers ne constituent pas un système de vérité cohérent. Cependant, la discordance est structurelle (livrables dédiés vs sections de synthèse) et ne remet pas en cause le verdict business de P6 — elle rend simplement les références croisées non fiables.
