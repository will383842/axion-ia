# V6-05 — Réalisme roadmap (effort, coût, gain)
## Date : 2026-05-22 | Score : 80/130

---

## Préambule : double référentiel

La roadmap P6 souffre d'une fragmentation entre ses propres agents :

| Agent | Score de départ | Source |
|---|---|---|
| A6-03 (Sprint A 30j) | 3598/5000 | HEAD e0b1973 (2026-05-21) |
| A6-04 (Sprint B 60j) | 3805/5000 (post-Sprint A estimé) | Hypothèse planning |
| A6-05 (Sprint C 90j) | 3942/5000 (post-Sprint B estimé) | Hypothèse cascadée |
| ROADMAP-EXECUTION-CHIFFREE | 3805/5000 | Verdict P6.1 |

Cette incohérence est documentée (A6-06 la signale) mais crée une lecture délicate. Les analyses ci-dessous utilisent les agents détaillés comme référence (A6-03/A6-04/A6-05) plutôt que ROADMAP-CHIFFREE pour l'effort et le gain.

---

## Sprint A (J0-J30) — "Ops + KB"

| Critère | ROADMAP-CHIFFREE | A6-03 (réel) | Verdict |
|---|---|---|---|
| Effort Claude | ~30h | ~9h | ⚠️ ROADMAP gonflé ×3 |
| Effort Will | 45 min | 45 min | ✅ Cohérent |
| Gain pts | +113-144 | +68 | ⚠️ ROADMAP surévalué (~+45 pts) |
| Coût dev Claude | ~$30 | $8-15 | ✅ Dans fourchette acceptable |
| Coût prod articles | $270 (2700 art) | ~$90 (900 art) | ❌ Erreur volume ×3 |

**Analyse** : A6-03 est réaliste. Les 9h Claude pour Sprint A sont cohérents avec les sprints correctifs P3-P5 (~5-8h). Le gain +68 pts est crédible (7.5 pts/h). ROADMAP-CHIFFREE surestime par un facteur ×3 les heures Claude et gonfle le gain avec des items partiellement déjà livrés (S+7). L'erreur coût prod articles (+2700 annoncés vs ~900 réels) est une confusion avec un sprint ultérieur.

**Verdict Sprint A : ⚠️ IMPRÉCIS** — A6-03 crédible, ROADMAP-CHIFFREE surévalue.

---

## Sprint B (J31-J60) — "Featured Snippets + Dashboard"

| Critère | ROADMAP-CHIFFREE | A6-04 (réel) | Verdict |
|---|---|---|---|
| Effort Claude | ~39h | ~45h | ✅ Cohérent (A6-04 légèrement > normal) |
| Effort Will | 35 min | ~6h | ⚠️ ROADMAP sous-estime |
| Gain pts | +125-138 | +142 | ✅ Cohérent |
| Coût dev Claude | ~$40 | ~$6.25 | ⚠️ Écart ×6 (A6-04 = token-level, fiable) |
| Coût prod articles | $900 (9000 art) | $142-180 (1500 art) | ❌ Erreur volume ×5-6 |

**Analyse** : L'effort Claude 39-45h est crédible pour un sprint de 30j incluant Featured Snippets (architecture complexe). L'effort Will réel est ~6h/mois (décisions rampe + GBP + buffer qualité) — sous le seuil challengeable de 20h/mois. Le coût prod $900 est basé sur 9000 articles (300/j × 30j) — en réalité la rampe produit 30→100/j soit ~1500 articles. Erreur de volume systématique reprise de Sprint A.

**Verdict Sprint B : ⚠️ IMPRÉCIS** — effort Claude crédible, coût prod et effort Will erronés dans ROADMAP.

---

## Sprint C (J61-J90) — "AI Act + Scale + GBP"

| Critère | ROADMAP-CHIFFREE | A6-05 (réel) | Verdict |
|---|---|---|---|
| Effort Claude | ~13h | ~49h | ❌ ROADMAP sous-estime ×3.7 |
| Effort Will | ~3h | ~10h | ⚠️ Sous-estimé (mais < 20h/mois) |
| Gain pts | +76-86 | +150 | ⚠️ Fourchette large (A6-05 optimiste) |
| Coût dev Claude | ~$15 | ~$245 | ❌ Erreur ×16 |
| Coût prod articles | $900 (9000 art) | $150-300 (1500-3000) | ❌ Erreur ×3-6 |

**Analyse critique** : ROADMAP-CHIFFREE annonce 13h Claude pour Sprint C. A6-05 liste semaine par semaine : C-1 (~9h) + C-2 (~11h) + C-3 (~10h) + C-4 (~22h avec tests coverage + mini-audit + Voyage AI optionnel) = 49h minimum. L'écart ×3.7 est inexplicable par des arrondis — c'est une erreur de transcription entre A6-05 et ROADMAP-CHIFFREE.

**Verdict Sprint C : ❌ IRRÉALISTE dans ROADMAP-CHIFFREE** — A6-05 est le plan crédible.

---

## Effort Will global

| Sprint | ROADMAP-CHIFFREE | Agent détaillé | Seuil 20h/mois | Verdict |
|---|---|---|---|---|
| Sprint A | 45 min | 45 min | ✅ | ✅ |
| Sprint B | 35 min | ~6h | ✅ | ⚠️ ROADMAP sous-estime |
| Sprint C | ~3h | ~10h | ✅ | ⚠️ ROADMAP sous-estime |

**Conclusion** : l'effort Will reste sous 20h/mois sur tous les sprints même avec les estimations agents détaillés corrigées. Aucun sprint n'est challengeable sur ce critère. ROADMAP-CHIFFREE donne une image trop légère mais le vrai planning est réaliste.

---

## Cohérence gains pts vs baselines réelles

| Sprint | Gain proposé (agent détaillé) | Pts/heure Claude | Cohérence |
|---|---|---|---|
| Sprint A | +68 pts / 9h | 7.5 pts/h | ✅ |
| Sprint B | +125-142 pts / 45h | 2.8-3.1 pts/h | ✅ |
| Sprint C | +76-150 pts / 49h | 1.6-3.1 pts/h | ✅ (fourchette large mais dans la norme) |
| Sprint D (180j) | +322 pts / 167h (A6-06) | 1.9 pts/h | ✅ |

Aucun sprint ne propose +500 pts en 30j. Les gains sont dans la norme des sprints P3-P5 déjà réalisés.

---

## Coûts LLM production

A6-09 et ROADMAP-CHIFFREE convergent à $0.10-$0.12/article — cohérent avec l'usage réel Sonnet 4.6.
A6-07 indique $0.006/article — probablement une erreur de calcul ×20 (non retenue).

---

## Synthèse anomalies

| Anomalie | Déduction |
|---|---|
| Erreur systématique volumes articles A/B/C (×3-6) | -20 pts |
| Effort Claude Sprint C sous-estimé ×3.7 dans ROADMAP | -20 pts |
| Coût dev Sprint C erroné ×16 dans ROADMAP | -10 pts |
| Divergence A6-07 coût prod ×20 sans explication | -10 pts |
| **Sous-total déductions** | **-60 pts** |

---

**Score V6-05 : 80/130** 🟡

Points créditeurs : gains pts cohérents avec baselines réelles P3-P5, effort Will < 20h/mois partout, coût $0.10-$0.12/article crédible, trajectoire GO J+250 corroborée par 3 agents indépendants. Points déducteurs : erreurs systématiques sur volumes articles et effort Claude Sprint C dans ROADMAP-CHIFFREE (les agents détaillés A6-03/A6-04/A6-05 sont, eux, crédibles).
