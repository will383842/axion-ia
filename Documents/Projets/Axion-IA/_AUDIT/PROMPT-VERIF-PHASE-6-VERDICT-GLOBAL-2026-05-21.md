# PROMPT VÉRIFICATION PHASE 6 — Méta-audit du Verdict Global `/5000`
## AxionIA Content-Gen Perfection 2026 — Audit critique de l'audit final

**Date création** : 2026-05-21
**Phase vérifiée** : P6 (Roadmap chiffrée + Verdict global `/5000`)
**Verdict de référence à valider** : `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-6/PHASE-6-VERDICT-GLOBAL.md`
**Mode** : **AUDIT-ONLY strict** — zéro commit, zéro modification code
**Effort estimé** : 3-4h autopilot (7 sous-agents méta-audit + synthèse)

---

## 0. RAISON D'ÊTRE DE CETTE VÉRIFICATION

P6 produit le verdict global `/5000` sur lequel Will fonde sa décision business (GO production / SPRINT CORRECTIF / NO-GO refonte). Une mauvaise synthèse = mauvaise décision aux conséquences réelles (gaspi tokens, perte de temps, ranking Google).

Cette méta-vérification challenge P6 sur **6 dimensions critiques** :

1. **Complétude des sources** : les 21 fichiers attendus ont-ils été lus ?
2. **Honnêteté du score `/5000`** : pas gonflé, pas auto-complaisance Claude ?
3. **Respect des exclusions Will** : aucune mention DPA / Wikidata / CF WAF dans STOP & ASK / roadmap ?
4. **Cohérence inter-livrables** : verdict global cohérent avec les 7 documents détaillés ?
5. **Réalisme roadmap** : effort heures, coûts $, gain points crédibles ?
6. **Qualité décisions canoniques** : mutuellement exclusives, options claires, recommandation argumentée ?

Le verdict de cette vérification est binaire pour Will : **"P6 est-il fiable pour décider ?"** (oui/conditionnel/non).

---

## 1. CONTEXTE — À LIRE AVANT

### État repo
- **Remote** : `https://github.com/will383842/axion-ia.git`
- **Branche** : `main`
- **HEAD origin/main** : à découvrir (`git log origin/main -1 --oneline`)

### Fichiers à lire (ordre)

#### Bloc A — Output P6 (cible de l'audit)
1. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-6/PHASE-6-VERDICT-GLOBAL.md` (livrable principal)
2. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-6/ROADMAP-EXECUTION-CHIFFREE.md`
3. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-6/DECISIONS-CANONIQUES-FINALES.md`
4. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-6/KPIS-12-MOIS-CHIFFRES.md`
5. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-6/COUTS-ESTIMES-12-MOIS.md`
6. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-6/RISQUES-MITIGATION.md`
7. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-6/CROSS-CUTTING.md`
8. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-6/agents/A6-01.md` à `A6-12.md` (12 rapports)
9. Mémoire `axionia_phase6_verdict_global_2026-05-21.md`

#### Bloc B — Specs P6 (pour mesurer écart)
10. `_AUDIT/PROMPT-6-ROADMAP-EXECUTION-CHIFFREE.md` (spec attendue)

#### Bloc C — Sources primaires que P6 devait lire (échantillonner pour vérifier)
11. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-1/PHASE-1-VERDICT.md` (P1 531.5)
12. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-1.5/RAPPORT-VERIFICATION-FINALE.md` (P1.5 192/200)
13. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-2/PHASE-2-VERDICT.md` (P2 726)
14. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-3/PHASE-3-VERDICT.md` (P3 689)
15. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-4/PHASE-4-VERDICT.md` (P4 547)
16. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-5/PHASE-5-VERDICT.md` (P5 315)
17. Mémoires sprint corrections : `axionia_sprint_p3/p4/p5_corrections_livre_2026-05-21.md`
18. Mémoires vérifs : `axionia_verif_sprint_p2/p3/p4_corrections_2026-05-21.md`
19. Mémoire décisions Will finales : `axionia_decisions_will_final_2026-05-21.md` (D7 + exclusions)
20. Mémoires décisions canoniques : `axionia_p4_decisions_canoniques_2026-05-21.md` + `axionia_p5_decisions_canoniques_2026-05-21.md`
21. `_AUDIT/PROMPT-MASTER-CONTENT-GEN-PERFECTION-2026.md` (KPIs référence)

### Mode AUDIT-ONLY
- ❌ Aucun commit, push, modif code
- ❌ Aucun re-calcul de P6 (tu n'audites pas, tu MÉTA-audites)
- ✅ Lecture exhaustive de tous les fichiers ci-dessus
- ✅ Création de fichiers UNIQUEMENT dans `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-6/verification/`

---

## 2. SPAWN 7 SOUS-AGENTS PARALLÈLES

### V6-01 — Complétude sources lues (/150)
- P6 prétend avoir lu 21 fichiers/mémoires. **Pour chaque** des 21 sources listées en §1 Bloc C, vérifier que P6 :
  - Y fait référence explicite dans au moins 1 livrable (PHASE-6-VERDICT-GLOBAL ou agents/A6-XX)
  - Cite des chiffres / éléments tirés de cette source (preuve de lecture, pas juste mention)
- Méthode : grep les 7 livrables principaux + 12 rapports agents pour les chiffres clés de chaque source :
  - "531.5" (P1) doit apparaître
  - "192/200" ou "P1.5" (P1.5 vérif) doit apparaître
  - "726" (P2 audit) doit apparaître
  - "689" (P3 audit) doit apparaître
  - "547" (P4 audit) doit apparaître
  - "315" (P5 audit) doit apparaître
  - "761" (P3 vérif) doit apparaître
  - "712" (P4 vérif) doit apparaître
  - "593" (P5 sprint score) doit apparaître
  - "AI Act CONFORME" ou similaire (P2 vérif correctif) doit apparaître
  - "D7" et "société française" doivent apparaître (D7 tranché)
- Sources manquantes : red flag → -10 pts par source absente
- Score : 150 max (toutes 21 lues = 150)

### V6-02 — Honnêteté du score `/5000` (/200)
**CRITIQUE** — la dimension la plus importante de la méta-vérification.

- P6 déclare un score `/5000`. Re-calculer indépendamment à partir des verdicts vérifiés :
  - D-Etat = P1.5 vérif (192/200 = 96% → 960/1000) OU P1.5 score estimé (770-820/1000)
  - D-Archi = P2 score post-correctif AI Act CONFORME (mémoire `axionia_verif_sprint_p2_corrections_2026-05-21` donne valeur exacte)
  - D-Visi = P3 vérif (761/1000)
  - D-Qual = P4 vérif (712/1000)
  - D-Ops = P5 sprint (593/1000) ou P5 vérif si livrée
- Comparer ton calcul indépendant vs score P6 :
  - Écart < 50 pts : honnête ✅
  - Écart 50-200 pts : tendancieux ⚠️ (Claude a peut-être gonflé pour "faire plaisir")
  - Écart > 200 pts : red flag 🔴 (méthodologie défaillante)
- Vérifier que P6 utilise les **derniers scores vérifiés** (pas les scores audit initiaux qui sont plus bas)
- Vérifier que le verdict (🟢 GO / 🟡 SPRINT / 🔴 NO-GO) est cohérent avec le score :
  - ≥ 4500 → 🟢 GO
  - 3500-4499 → 🟡 SPRINT CORRECTIF
  - < 3500 → 🔴 NO-GO
- Si P6 déclare 🟢 GO alors que score < 4500 : red flag critique
- Si P6 déclare 🟡 alors que score < 3500 ou ≥ 4500 : red flag
- Score : 200 max

### V6-03 — Respect exclusions Will (/120)
**CRITIQUE** — Will a exigé explicitement.

Pour chacune des 3 exclusions Will (cf. mémoire `axionia_decisions_will_final_2026-05-21`) :
- **Wikidata Q-ID** : NE DOIT PAS apparaître dans STOP & ASK final, NE DOIT PAS apparaître comme recommandation roadmap, NE DOIT PAS être présenté comme gain pts à capter.
  - Grep "Wikidata" dans `PHASE-6-VERDICT-GLOBAL.md` + `ROADMAP-EXECUTION-CHIFFREE.md` + `DECISIONS-CANONIQUES-FINALES.md`
  - Acceptable UNIQUEMENT comme mention historique "décision Will assumée hors scope"
  - Si recommandation/proposition active : -40 pts
- **DPA Anthropic** : idem. Grep "DPA" et "Anthropic" dans contexte signature
  - Acceptable comme mention contractuelle technique (provider)
  - Pas acceptable comme action Will à faire dans STOP & ASK
  - Si présent en action : -40 pts
- **CF WAF / Cloudflare Block AI Bots** : NE DOIT PAS être proposé (déjà acquis)
  - Acceptable comme mention dans "acquis P3"
  - Si proposé en action : -40 pts
- Score : 120 max (40 par exclusion respectée)

### V6-04 — Cohérence inter-livrables (/100)
- Le score `/5000` dans `PHASE-6-VERDICT-GLOBAL.md` doit être identique dans `ROADMAP-EXECUTION-CHIFFREE.md` et `agents/A6-01.md` et `agents/A6-12.md`
- Le verdict (GO/SPRINT/NO-GO) doit être identique partout
- La recommandation finale "Action Will recommandée" doit être cohérente entre verdict global et décisions canoniques (D8-D20)
- Les chiffres KPIs cibles doivent être identiques entre `PHASE-6-VERDICT-GLOBAL.md §7` et `KPIS-12-MOIS-CHIFFRES.md`
- Les coûts $ doivent être identiques entre `PHASE-6-VERDICT-GLOBAL.md §6` et `COUTS-ESTIMES-12-MOIS.md`
- Les risques top 3 doivent être cohérents entre verdict et `RISQUES-MITIGATION.md`
- Discordances : red flag → -20 pts par discordance majeure
- Score : 100 max

### V6-05 — Réalisme roadmap (effort, coût, gain) (/130)
- Pour chaque sprint follow-up proposé (A 30j, B 60j, C 90j) :
  - **Effort Claude (heures)** : crédible ? Comparer aux sprints déjà réalisés :
    - Sprint P3 corrections : 6-10h estimé, livré en ~5-8h réel
    - Sprint P4 corrections : 16-20h estimé, livré en plusieurs phases
    - Sprint P5 corrections : 14-16h estimé, livré
    - Si P6 propose un sprint à 80h pour 30 jours : crédible
    - Si P6 propose un sprint à 200h pour 30 jours : irréaliste
  - **Effort Will (heures + €)** : réaliste vs disponibilité Will ?
    - Heures décision (1-2h/sprint) acceptable
    - Heures actions externes (signature contrats, etc.) acceptable
    - Si > 20h Will sur 1 mois : challengeable
  - **Gain pts attendu** : cohérent vs verdicts vérif ?
    - Si verdict vérif P3 = 761/1000 et sprint A propose +200 pts : ambitieux mais possible
    - Si sprint propose +500 pts en 30j : irréaliste
  - **Coût LLM $** : cohérent vs sprints passés ?
    - Sprint P4 = ~$5-10 tokens en autopilot
    - Sprint P5 = ~$5-10
    - Si P6 estime un sprint à $1000 sans justification : challengeable
- Score : 130 max

### V6-06 — Qualité 18-20 décisions canoniques (/100)
- Compter le nombre de décisions canoniques (D8 à Dx) : doit être 13-20
- Pour chaque décision :
  - **Options** : 2-4 options mutuellement exclusives (pas "A : faire X, B : faire X partiellement")
  - **Reco Claude** : présente + argumentée (paragraphe court)
  - **Impact** : indiqué (business, technique, conformité, ...)
  - **Effort** : indiqué si applicable
- Vérifier absence de doublons (D8 et D10 ne doivent pas porter sur le même sujet)
- Vérifier que **AUCUNE décision** ne porte sur Wikidata, DPA, CF WAF (exclusions Will)
- Vérifier que les décisions déjà tranchées (D-W, D-P5, D1-D5, D7) ne sont PAS re-listées
- Score : 100 max

### V6-07 — Cross-cutting orchestrateur méta-audit (/100)
- Cohérence inter-agents V6-01 à V6-06 : 0 contradiction
- Recommandation finale méta-audit cohérente (peut-on faire confiance à P6 ?)
- Format livraison verdict méta-audit clair pour Will
- Identification des **3 améliorations** que P6 pourrait avoir si re-lancé
- Score : 100 max

**TOTAL : 900 pts → normalisé `/1000`**

---

## 3. CRITÈRES DE PASSAGE

### Verdict méta-audit
- **🟢 P6 FIABLE** si score méta-audit ≥ 800/1000 : Will peut prendre sa décision en confiance
- **🟡 P6 ACCEPTABLE AVEC RÉSERVES** si 600-799 : Will doit lire les réserves avant de décider
- **🔴 P6 NON-FIABLE** si < 600 : refaire P6 (ou lire les sources directement)

### Critères "kill" automatiques
Si UN de ces critères est violé, P6 est automatiquement déclaré **🔴 NON-FIABLE** :
- Wikidata, DPA, ou CF WAF apparaissent comme action Will dans STOP & ASK
- Score `/5000` gonflé > 200 pts vs calcul indépendant
- Verdict GO/SPRINT/NO-GO incohérent avec le score déclaré
- < 15 des 21 sources lues
- Décisions D-W / D-P5 / D1-D5 / D7 re-demandées

---

## 4. LIVRABLES

### Structure
```
_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-6/verification/
├── VERDICT-METAAUDIT-P6.md           (livrable principal)
├── CROSS-CUTTING.md
└── agents/
    ├── V6-01-completude-sources.md
    ├── V6-02-honnetete-score.md
    ├── V6-03-exclusions-will.md
    ├── V6-04-coherence-livrables.md
    ├── V6-05-realisme-roadmap.md
    ├── V6-06-decisions-canoniques.md
    └── V6-07-cross-cutting.md
```

### Format VERDICT-METAAUDIT-P6.md

```markdown
# VERDICT MÉTA-AUDIT PHASE 6
## Date : YYYY-MM-DD
## HEAD audité : <SHA>
## P6 audité : `phase-6/PHASE-6-VERDICT-GLOBAL.md` (date production)

---

## Verdict méta-audit : 🟢 FIABLE | 🟡 ACCEPTABLE | 🔴 NON-FIABLE

**Score méta-audit : XXX/1000**

### Recommandation à Will
<1 phrase claire : "Tu peux te baser sur P6 pour décider" / "Lis les réserves avant" / "Refais P6">

---

## Scores par agent
| Agent | Score | Max | Verdict |
|-------|-------|-----|---------|
| V6-01 Complétude sources | XXX | 150 | 🟢/🟡/🔴 |
| V6-02 Honnêteté score | XXX | 200 | 🟢/🟡/🔴 |
| V6-03 Exclusions Will | XXX | 120 | 🟢/🟡/🔴 |
| V6-04 Cohérence livrables | XXX | 100 | 🟢/🟡/🔴 |
| V6-05 Réalisme roadmap | XXX | 130 | 🟢/🟡/🔴 |
| V6-06 Décisions canoniques | XXX | 100 | 🟢/🟡/🔴 |
| V6-07 Cross-cutting | XXX | 100 | 🟢/🟡/🔴 |
| **TOTAL** | **XXX** | **900** | |
| **NORMALISÉ /1000** | **XXX** | **1000** | |

---

## Score P6 déclaré vs Score recalculé indépendant
| Dimension | P6 déclare | Méta-audit recalcule | Écart |
|-----------|------------|---------------------|-------|
| D-Etat | XXX | XXX | ±XX |
| D-Archi | XXX | XXX | ±XX |
| D-Visi | XXX | XXX | ±XX |
| D-Qual | XXX | XXX | ±XX |
| D-Ops | XXX | XXX | ±XX |
| **TOTAL /5000** | **XXXX** | **XXXX** | **±XX** |

**Honnêteté score** : 🟢 fiable / 🟡 légèrement biaisé / 🔴 gonflé

---

## Exclusions Will respectées
- Wikidata Q-ID absent de STOP & ASK : ✅/❌
- DPA Anthropic absent comme action : ✅/❌
- CF WAF absent comme proposition : ✅/❌

---

## Sources lues par P6 (sur 21 attendues)
| # | Source | Référencée dans P6 ? | Preuve |
|---|--------|---------------------|--------|
| 1 | PHASE-1-VERDICT.md (531.5) | ✅/❌ | "531.5" trouvé dans X livrables |
| 2 | RAPPORT-VERIFICATION-FINALE P1.5 (192/200) | ✅/❌ | ... |
| ... |

---

## Discordances inter-livrables détectées
| Type | Item | Sévérité |
|------|------|----------|

---

## Décisions canoniques — qualité
- Nombre : X (cible 13-20)
- Doublons détectés : X
- Décisions Wikidata/DPA/CF présentes (erreur) : X
- Décisions sans recommandation Claude : X
- Décisions sans options claires : X

---

## Améliorations recommandées P6 (si re-lancé)
1. ...
2. ...
3. ...

---

## STOP & ASK Will
- Verdict méta-audit : <FIABLE/ACCEPTABLE/NON-FIABLE>
- P6 utilisable pour décision business : OUI / CONDITIONNEL / NON
- Si NON-FIABLE : re-lancer P6 OU consulter directement les sources primaires
```

### Mémoire
Slug : `axionia_metaaudit_phase6_2026-05-21`
Type : project
Body : verdict méta-audit, fiabilité P6, recommandation Will, top 3 réserves.

### MEMORY.md
```
- [🟢/🟡/🔴 AxionIA méta-audit P6 LIVRÉ 2026-05-21 — score XXX/1000](axionia_metaaudit_phase6_2026-05-21.md) — Vérification fiabilité du verdict global /5000. Honnêteté score, exclusions Will respectées, cohérence livrables, réalisme roadmap.
```

---

## 5. STOP & ASK FINAL

Format strict :
```
✅ Méta-audit P6 livré

📊 Score méta-audit : XXX/1000 — 🟢 FIABLE | 🟡 ACCEPTABLE | 🔴 NON-FIABLE

🔍 Vérifications clés :
- Sources lues : X/21 ✅
- Honnêteté score : 🟢/🟡/🔴 (écart ±XX pts vs recalcul)
- Exclusions Will : 3/3 respectées ✅ / X/3
- Cohérence livrables : 🟢/🟡/🔴
- Réalisme roadmap : 🟢/🟡/🔴
- Décisions canoniques : X/20 qualifiées

📋 Recommandation Will :
<P6 utilisable pour décision business : OUI / CONDITIONNEL / NON>

🚀 Choix Will :
[A] P6 validé → décider GO/SPRINT/NO-GO selon recommandation P6
[B] P6 acceptable avec réserves → lire les réserves puis décider
[C] P6 non-fiable → re-lancer P6 avec corrections (ou consulter sources directement)
```

---

## 6. PHRASE DE LANCEMENT (AUTOPILOT TOTAL)

```
AUTOPILOT TOTAL. Ne pose AUCUNE question intermédiaire. Lance la méta-vérification décrite dans `_AUDIT/PROMPT-VERIF-PHASE-6-VERDICT-GLOBAL-2026-05-21.md`. Mode AUDIT-ONLY strict : zéro commit, zéro modif code, zéro re-calcul P6 (tu MÉTA-audites). Lis d'abord PHASE-6-VERDICT-GLOBAL.md + 6 livrables P6 + 12 rapports agents A6-XX, puis échantillonne les 21 sources primaires que P6 prétendait lire. Spawn 7 sous-agents parallèles V6-01 à V6-07 (complétude sources 21, honnêteté score /5000 vs recalcul indépendant, respect exclusions Will Wikidata+DPA+CF, cohérence inter-livrables, réalisme effort/coût/gain roadmap, qualité 18-20 décisions canoniques mutuellement exclusives, cross-cutting). Critères kill automatiques : Wikidata/DPA/CF dans STOP&ASK, score gonflé > 200 pts vs recalcul, verdict incohérent score, < 15/21 sources, décisions déjà tranchées re-demandées. Produis VERDICT-METAAUDIT-P6.md scoré /1000 + 7 rapports V6-XX + CROSS-CUTTING + mémoire axionia_metaaudit_phase6_2026-05-21 + MEMORY.md update. Recommandation à Will tranchée : P6 utilisable pour décision OUI/CONDITIONNEL/NON. STOP & ASK Will UNIQUEMENT à la livraison finale avec verdict 🟢 FIABLE / 🟡 ACCEPTABLE / 🔴 NON-FIABLE + 3 options [A/B/C]. Go.
```

---

## 7. POURQUOI ARRÊTER ICI (pas de méta-méta-audit)

Cette vérification P6 est le **dernier niveau** de contrôle. Pas de PROMPT-VERIF-VERIF-P6.

Raisons :
1. **Coût opportunité** : chaque niveau de méta-audit consomme 3-7h Claude. Au-delà du méta-audit, le ROI devient nul.
2. **Indépendance déjà acquise** : le méta-audit P6 lit les sources primaires indépendamment de ce que P6 a fait. Il ne dépend pas de P6 pour ses chiffres.
3. **Will est le juge final** : si méta-audit + P6 sont cohérents et que méta-audit conclut 🟢 FIABLE, Will tranche. Si discordances, Will consulte les sources directement.
4. **Principe de raison gardée** : à un moment il faut décider et agir. Le pipeline content-gen perfection 2026 a déjà ~50 documents produits. Ajouter un niveau de méta-méta serait du **gold-plating** (sur-ingénierie sans valeur ajoutée).

---

*Méta-audit Phase 6 — 3-4h autopilot — AUDIT-ONLY — Dernier niveau de contrôle pipeline content-gen perfection 2026*
