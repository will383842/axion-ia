# V6-06 — Qualité des décisions canoniques D8-D21
## Date : 2026-05-22 | Score : 75/100

---

## Comptage

DECISIONS-CANONIQUES-FINALES.md : **14 décisions** (D8-D21, sans D22)
PHASE-6-VERDICT-GLOBAL.md §9 : **15 décisions** (D8-D22, avec D22 ajoutée P6.1)

Conformité : 14/14 dans plage requise 13-20 ✅

---

## Évaluation par décision

| Décision | Sujet | Options | Reco | Impact | Effort | Statut |
|---|---|---|---|---|---|---|
| D8 | Rampe MAX_PUBLISH calendrier | 3 (A/B/C) ME | C argumentée | Indiqué | Indiqué | ✅ BIEN FORMÉE |
| D9 | KB sectorielle ordre verticales | 4 (A/B/C/D) ME | A argumentée | Indiqué (+46 pts) | Indiqué (12-16h) | ✅ BIEN FORMÉE |
| D10 | Adresse FR domiciliation | 4 (A/B/C/D) ME | A argumentée | Indiqué (K9, D17) | Indiqué (30 min) | ✅ BIEN FORMÉE |
| D11 | GSC service account JSON | 3 (A/B/C) ME | A argumentée | Indiqué | Indiqué (30 min) | ✅ BIEN FORMÉE |
| D12 | Monthly cap Anthropic | 3 (A/B/C) ME | B avec paliers | Indiqué | Indiqué (10 min) | ✅ BIEN FORMÉE |
| D13 | Sprint A lancement | 3 (A/B/C) ME | ⚠️ **INCOHÉRENCE** | Indiqué | Indiqué | ⚠️ DÉFAUT MINEUR |
| D14 | Bilingue EN priorité | 4 (A/B/C/D) ME | B argumentée | Indiqué (+15 pts) | Indiqué (~8-12h) | ✅ BIEN FORMÉE |
| D15 | Audit content-gen 2027 | 3 (A/B/C) ME | A argumentée | Indiqué | Indiqué (0h Will) | ✅ BIEN FORMÉE |
| D16 | Backlinks autorité FR | 4 (A/B/C/D) | D arguementée | Indiqué (+20 pts) | Indiqué (2-4h/mois) | ⚠️ OPTIONS NON ME |
| D17 | Google Business Profile timing | 3 (A/B/C) ME | A argumentée | Indiqué (Local Pack) | Indiqué (20 min) | ✅ BIEN FORMÉE |
| D18 | Voyage AI RAG sémantique | 3 (A/B/C) ME | C argumentée | Indiqué (+12 pts si C) | Indiqué (12h) | ✅ BIEN FORMÉE |
| D19 | Domain strategy EN | 3 (A/B/C) ME | B argumentée | Indiqué | Indiqué (~2h) | ✅ BIEN FORMÉE |
| D20 | Stratégie communication IA | 3 (A/B/C) | A | ⚠️ **INCOHÉRENCE INTERNE** | Indiqué | ⚠️ DÉFAUT MINEUR |
| D21 | SIREN/SIRET France | 3 (A/B/C) ME | A argumentée | Indiqué | Indiqué | ✅ BIEN FORMÉE |

ME = Mutuellement Exclusives

---

## Détail des défauts

### Défaut P1 — D13 : incohérence recommandation entre fichiers (mineur)

| Fichier | Recommandation D13 |
|---|---|
| DECISIONS-CANONIQUES-FINALES.md | **A** (Immédiat) |
| A6-11 one-liner | **C** (vérification légère 2h) |
| PHASE-6-VERDICT-GLOBAL.md §9 | **C** |

Le fichier canonique des décisions contient la **mauvaise** recommandation pour D13. Will lirait "D13=A" dans DECISIONS-CANONIQUES mais "D13=C" dans le tableau §9 du VERDICT-GLOBAL. La recommandation correcte selon l'argumentation P6 est C (urgence AI Act → vérification légère avant sprint pour sécuriser la conformité).

**Déduction : -10 pts**

### Défaut P2 — D20 : incohérence interne dans A6-11 (mineur)

La narration A6-11 recommande "A + B combinés" mais le one-liner donne `D20=A`. Le fichier canonique liste `D20=A` sans mention de B. L'option "A+B" n'est pas une option valide dans la structure A/B/C définie pour D20 — c'est une contamination de la recommandation narrative dans le one-liner.

**Déduction : -10 pts**

### Défaut P3 — D16 : options non mutuellement exclusives (mineur)

L'option D ("les 3 combinés = A+B+C") inclut les options A, B et C. Ce n'est pas formellement exclusif (D ⊃ A, D ⊃ B, D ⊃ C). La recommandation D est claire et argumentée, mais la structure formelle est imparfaite.

**Déduction : -5 pts**

### Défaut P4 — D22 absente de DECISIONS-CANONIQUES-FINALES (mineur)

D22 (no-table gate exception comparison.ts) apparaît dans PHASE-6-VERDICT-GLOBAL §9 parmi les 15 décisions à trancher, mais est absente de DECISIONS-CANONIQUES-FINALES.md. D22 n'est pas formellement tranchée dans le fichier canonique. Incohérence documentaire entre les deux sources de référence pour Will.

_Non pénalisé séparément (couvert par V6-04)._

---

## Vérifications globales

| Critère | Résultat |
|---|---|
| Nombre décisions (13-20) | 14 ✅ |
| Doublons | 0 ✅ |
| Wikidata en décision | 0 ✅ |
| DPA en décision | 0 ✅ |
| CF WAF en décision | 0 ✅ |
| Décisions déjà tranchées (D1-D7, D-W, D-P5) | 0 re-listées ✅ |
| Décisions sans recommandation Claude | 0 ✅ |
| Décisions sans options | 0 ✅ |

---

## Calcul score

100 - 10 (D13) - 10 (D20) - 5 (D16) = **75/100**

---

**Score V6-06 : 75/100** 🟡

11/14 décisions parfaitement formées. 3 défauts mineurs (D13 reco incohérente entre fichiers, D20 incohérence interne narrative vs one-liner, D16 options formellement non ME). Aucune violation des exclusions absolues. Aucun doublon. Aucune décision déjà tranchée re-demandée.
