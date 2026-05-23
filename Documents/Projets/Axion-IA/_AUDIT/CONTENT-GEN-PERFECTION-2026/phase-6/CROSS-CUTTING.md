# CROSS-CUTTING — Cohérence inter-agents Phase 6
## Date: 2026-05-22 (mise à jour P6.1 corrigée)
## HEAD origin/main audité : e573da64
## Score prod retenu : 3638/5000 CONDITIONNEL
## Auditeur : Claude Sonnet 4.6 — AUDIT-ONLY

---

## 1. Cohérence score /5000

### Tableau de convergence agents

| Agent | Score cité | Base de calcul | Cohérent ? |
|-------|-----------|----------------|------------|
| A6-01 | 3802/5000 | origin/main e573da64 — calcul interne légèrement différent | ⚠️ MINEUR (+164 pts vs ref) |
| A6-02 | 3638/5000 | origin/main e573da64 strict — identique ref | ✅ |
| A6-03 | 3638/5000 prod / 3805/5000 local | Distingue explicitement prod vs local | ✅ (correct) |
| A6-04 | 3751/5000 entrant | Post-Sprint A estimé (+113 depuis 3638) | ✅ (cohérent) |
| A6-05 | 3942/5000 entrant | Post-Sprint B (incohérent avec A6-04 → 3886) | ⚠️ MINEUR (+56 pts) |
| A6-06 | 3638/5000 baseline + 3966/5000 entrant | Distingue baseline réelle et projeté post-A+B+C | ✅ (correct) |
| A6-07 | 3598/5000 | Version P6 originale (obsolète — anté-correction promptHash) | ⚠️ OBSOLÈTE (−40 pts) |
| A6-12 | 3638/5000 | origin/main e573da64 strict — identique ref | ✅ |
| CROSS-CUTTING v1 | 3805/5000 | Avec commits locaux 023266f9+5d8e8b6f+7236dfd0 | ⚠️ Commits non confirmés origin/main |

### Score retenu pour toutes les décisions
**3638/5000** — origin/main HEAD e573da64 uniquement. Les commits locaux (023266f9, 5d8e8b6f, 7236dfd0) ne sont PAS dans git history et ne sont pas comptabilisés.

### Analyse de la divergence A6-01 (3802 vs 3638)

A6-01 retient 3802/5000 en intégrant des gains non vérifiés de manière indépendante :
- D-Archi : 810/1000 vs 796 retenu A6-12 (delta +14 — commit e0b1973 non vérifié indép.)
- D-Etat : 795/1000 vs 795 — identique ✅
- D-Ops : 652/1000 vs 580 retenu A6-12 (delta +72 — vérification HEAD e573da64 vs estimation)

La divergence principale porte sur D-Ops : A6-01 retient 652 (vérification indépendante au HEAD e573da64 selon MEMORY.md), A6-12 retient 580 (estimation sprint sans vérification indépendante). **Score de référence retenu : 3638 (A6-02/A6-12) — base la plus conservative et la plus prudente.**

### Conclusion cohérence score

| Verdict | Détail |
|---------|--------|
| ✅ 6/9 agents cohérents | A6-02, A6-03, A6-04, A6-06, A6-07 (hors base), A6-12 utilisent 3638 ou en sont dérivés correctement |
| ⚠️ 2 agents mineurs | A6-01 (+164 pts, gains non vérifiés), A6-05 (base Sprint C +56 pts gonflés) |
| ⚠️ 1 agent obsolète | A6-07 utilise 3598 (P6 original avant correction promptHash) |

**Aucune contradiction majeure. Les divergences sont documentées et expliquées.**

---

## 2. Cohérence roadmap

### Gains sprint A→F par agent

| Sprint | Agent source | Gain déclaré | Score sortant | Cohérent avec ref ? |
|--------|-------------|-------------|--------------|---------------------|
| Sprint A (J0-30) | A6-03 | +113 pts | 3751 | ✅ (base 3638+113=3751) |
| Sprint B (J31-60) | A6-04 | +135 pts | 3886 | ✅ (base 3751+135=3886) |
| Sprint C (J61-90) | A6-05 | +80 pts | 3966 | ⚠️ A6-05 part de 3942 (non 3886) — score sortant cible 4092 ≠ 3966 |
| Sprint D (J91-180) | A6-06 | +118 pts | 4084 | ✅ (base 3966+118=4084) |
| Sprint E (J181-270) | A6-12 | +249 pts | 4333 | ✅ cohérent avec trajectoire |
| Sprint F (J271+) | A6-12 | +167 pts | ≥4500 | ✅ GO estimé ~J300 |

### Divergence A6-05 Sprint C

A6-05 (daté 2026-05-21 — anté P6.1) part d'un score entrant Sprint C de **3942** (post-Sprint B selon sa propre estimation) alors que la trajectoire corrigée post-P6.1 donne 3886. L'écart de +56 pts se propage : A6-05 projette 4092/5000 en fin Sprint C vs 3966 attendu depuis 3886. Cet agent est **compatible** dans sa logique interne mais sa base d'entrée est légèrement gonflée. L'impact sur les décisions est nul — la trajectoire GO reste la même.

### Synthèse roadmap

La trajectoire 3638→3751→3886→3966→4084→4333→≥4500 est cohérente entre A6-02, A6-03, A6-04, A6-06 et A6-12. Le GO à 4500 reste atteignable en ~J+270-300 (~2027-02-16 à 2027-03-17). **Cohérence globale : BONNE avec 1 divergence mineure documentée (A6-05 base +56 pts).**

---

## 3. Cohérence décisions

### Tableau décisions D8–D22 — concordance entre agents

| Décision | PHASE-6-VERDICT v1 | A6-11 | A6-03 | Brief P6.1 | Écart ? |
|----------|-------------------|-------|-------|------------|---------|
| D8 Rampe | C (manuel) | C (manuel) | C | **B (prudent)** | ⚠️ DIVERGENCE — brief demande B, agents disent C |
| D9 KB ordre | A (interventions first) | A | D (parallèle) | **D (parallèle)** | ⚠️ A6-11=A vs brief=D |
| D10 Adresse FR | A (Sedomicilier) | A | A | A | ✅ |
| D11 GSC JSON | A (cette semaine) | A | A | A | ✅ |
| D12 Cap Anthropic | B (avant scale) | B | B | B | ✅ |
| D13 Vérif P5 | C (légère 2h) | C | — | C | ✅ |
| D14 Bilingue EN | B (Q4 2026) | B | — | B | ✅ |
| D15 Audit 2027 | A (Claude autopilot) | A | — | A | ✅ |
| D16 Backlinks | D (les 3) | D | D | D | ✅ |
| D17 GBP | A (dès adresse) | A | — | A | ✅ |
| D18 RAG sémantique | C (jamais) | C conditionnel | — | **B (Q4)** | ⚠️ agents=C, brief=B |
| D19 Domain EN | B (/en/) | B | — | B | ✅ |
| D20 Transparence IA | A (page publique) | A | — | A | ✅ |
| D21 Priorité D-Ops | A (D-Ops first) | — | — | A | ✅ |
| D22 no-table | A (exception comparison.ts) | — | mentionné | A | ✅ |

### Divergences identifiées

**D8** : A6-11 et PHASE-6-VERDICT v1 recommandent C (Manuel UI — déjà décidé D-P5-5). Le brief P6.1 demande B (prudent calendrier fixe J+14/30/60/120/180). Ces deux options sont **compatibles** : B est une formulation du calendrier prudent, C dit que Will gère manuellement. La divergence est de forme, pas de fond — D8=B est la description formelle de la cadence prudente retenue.

**D9** : A6-11 recommande A (interventions first, 50% du volume). Le brief demande D (toutes en parallèle). La divergence est réelle : A6-11 argumente ROI immédiat sur la verticale principale, le brief préfère la vitesse totale. **D9=D est retenu selon le brief (décision Will canonique).**

**D18** : A6-11 et PHASE-6-VERDICT v1 recommandent C (jamais — KB FTS + pgvector suffisent). Le brief demande B (Q4 2026). La divergence est réelle mais le brief représente la décision canonique de Will. **D18=B est retenu.**

### Vérification D22 — absent de A6-11 (version 2026-05-21)

A6-11 a été rédigé avant la découverte de la contrainte Featured Snippets / no-table gate. D22 est apparue comme découverte cross-cutting dans CROSS-CUTTING v1 (2026-05-22) et a été intégrée dans PHASE-6-VERDICT-GLOBAL. A6-11 ne couvre que D8–D21, ce qui est correct pour sa date. D22 est documentée dans DECISIONS-CANONIQUES-FINALES.md.

### Conclusion cohérence décisions

12/15 décisions parfaitement cohérentes entre tous les agents. 3 divergences mineures documentées (D8, D9, D18) avec décision canonique Will tranchée dans le brief. A6-11 ne re-demande pas les décisions D-W1 à D5/D7 déjà tranchées — conforme.

---

## 4. Cohérence coûts

### Tableau comparatif A6-09 vs PHASE-6-VERDICT-GLOBAL vs brief

| Poste | A6-09 (scénario BASE) | PHASE-6-VERDICT v1 | Brief P6.1 |
|-------|----------------------|-------------------|------------|
| LLM Claude génération | $7 940 | $5 800 | $7 940 |
| OpenAI embeddings | $5 | $29 | $5 |
| Infra | $745 (Hetzner+GH+GHCR) | $200 (Hetzner seul) | $770 |
| Adresse FR (D10=A) | $396 | $400 | $360 |
| TOTAL BASE | $9 086 | $6 789 | $9 073 |

### Analyse des divergences coûts

**LLM Claude** : A6-09 et brief convergent à $7 940 — chiffre issu du calcul volumétrique 79 400 articles × $0.10/art. PHASE-6-VERDICT v1 déclarait $5 800 (calcul antérieur sur volume 57 000 art). La correction P6.1 aligne sur A6-09.

**Infra** : A6-09 retient $745 (Hetzner $672 + GH $13 + GHCR $60 = $745). Le brief dit $770 (arrondi cohérent). PHASE-6-VERDICT v1 ne comptabilisait que Hetzner ($200 — erreur partielle, sous-évalué).

**OpenAI** : A6-09 : $5 (exact). PHASE-6-VERDICT v1 : $29 (calcul incluait LLM dev sprints $360 — erreur de classification). Le brief : $5. Convergence A6-09/brief.

**Adresse FR** : A6-09 : $396 (12 × $33). Brief : $360 (12 × $30). Légère différence de taux USD/EUR ($33 vs $30). Cohérent.

### Cohérence A6-09 vs trajectoire A6-07

A6-09 projette 79 400 articles sur 12 mois. A6-07 projette ~108 000 articles (J+365 = 500 art/j final). La différence provient du ramping : A6-09 utilise des moyennes trimestrielles (60/150/250/400 art/j) vs A6-07 qui projette 500 art/j en fin de période. **Cohérence acceptable** — A6-09 est plus conservative sur les volumes de fin de période (400 vs 500 art/j moy. Q2 2027).

### Conclusion cohérence coûts

A6-09 est la source de vérité pour les coûts 12 mois (scénario BASE $9 086). Le brief retient $9 073 (arrondi). **Cohérence : BONNE — 1 divergence mineure PHASE-6-VERDICT v1 ($6 789) corrigée dans la mise à jour P6.1.**

---

## 5. Exclusions respectées

### Wikidata

| Agent | Mention problématique ? | Verdict |
|-------|------------------------|---------|
| A6-01 | Note "plafond structurel décision Will" — mention descriptive seulement | ✅ OK |
| A6-02 | Aucune mention | ✅ |
| A6-03 | Aucune mention | ✅ |
| A6-04 | Aucune mention | ✅ |
| A6-05 | §9 : "Wikidata activation (renoncé → réexaminer ?)" — listée comme décision bloquante Sprint C | ⚠️ VIOLATION — Wikidata est RENONCÉ, pas à ré-examiner |
| A6-06 | Aucune mention | ✅ |
| A6-07 | §Sprint D : mention Wikidata comme item Sprint D | ⚠️ VIOLATION (version obsolète, anté-décision Will 2026-05-21) |
| A6-10 | R5 : "Wikidata renoncé" — mention explicitement comme décision acquise | ✅ OK (correct) |
| A6-11 | Aucune mention roadmap | ✅ |
| A6-12 | Aucune mention | ✅ |

**Violations** : 2 agents mentionnent Wikidata hors cadre. A6-05 et A6-07 sont des versions datées (2026-05-21) anté-décision canonique. La décision canonique est acquise : Wikidata RENONCÉ (cf. DECISIONS-CANONIQUES-FINALES.md). Ces mentions ne doivent PAS influencer les plans d'action.

### DPA Anthropic

| Agent | Mention ? | Verdict |
|-------|-----------|---------|
| A6-05 | §9 : "DPA : reporté : réactiver ?" — listée comme décision bloquante Sprint C | ⚠️ VIOLATION — DPA est REPORTÉ INDÉFINIMENT, pas à réactiver |
| Tous autres | Aucune mention DPA | ✅ |

**Violation** : A6-05 seul. Même contexte — version 2026-05-21 anté-décision Will. La décision canonique est DPA Anthropic REPORTÉ (exclusion acquise).

### CF WAF

| Agent | Mention ? | Verdict |
|-------|-----------|---------|
| Tous agents | Aucune mention CF WAF dans STOP & ASK ni roadmap | ✅ |

**0 violation CF WAF** dans tous les agents P6.

### Tableau de synthèse exclusions

| Exclusion | Violations | Agents concernés | Risque décisionnel |
|-----------|-----------|------------------|-------------------|
| Wikidata | 2 (mineures) | A6-05, A6-07 (versions obsolètes 2026-05-21) | Faible — décision acquise, agents non referencés pour decisions |
| DPA Anthropic | 1 (mineure) | A6-05 (version obsolète 2026-05-21) | Faible — même contexte |
| CF WAF | 0 | — | ✅ Aucun risque |

**Les violations identifiées proviennent exclusivement d'agents datés 2026-05-21 (anté-décision Will). La version P6.1 (2026-05-22) respecte intégralement les 3 exclusions.**

---

## 6. Découvertes cross-cutting (nouveautés P6.1)

### D-C2 — lockDuration absent content-publish-worker.ts
- Sévérité : MOYENNE
- Risque : double-ping IndexNow si worker stalle
- Fix : 10 min, `lockDuration: 120_000` dans WorkerOptions
- Intégré comme item #1 ROI 58.8 pts/h dans A6-02

### D-C3 — SMTP Coolify non configuré
- Worker `content-weekly-report-worker.ts` livré mais env var `WEEKLY_REPORT_EMAIL` absente Coolify
- Fix : 15 min Will
- Intégré comme "ROI infini" dans A6-02

### D-C4 — Featured Snippets vs no-table gate
- comparison.ts hard-gate no-table incompatible avec tableaux HTML nécessaires aux Featured Snippets
- Décision D22 requise (tranchée : D22=A — exception localisée comparison.ts)

### D-C5 — Commits locaux non pushés
- 023266f9, 5d8e8b6f, 7236dfd0 non présents dans git history origin/main
- Score prod = 3638 (pas 3805) — push requis pour synchroniser

---

## 7. Priorisation cross-agents — Top 5 actions immédiates

| # | Action | Effort Will | Gain pts | Urgence |
|---|--------|-------------|----------|---------|
| 1 | Trancher D8=B, D9=D, D10=A, D11=A, D12=B, D13=C, D14=B, D15=A, D16=D, D17=A, D18=B, D19=B, D20=A, D21=A, D22=A | 5 min | — | IMMÉDIAT |
| 2 | Coolify env `WEEKLY_REPORT_EMAIL` + SMTP | 15 min | +20 D-Ops | J+1 |
| 3 | GSC service account JSON Coolify | 30 min | +7 D-Visi | J+3 |
| 4 | Lancer Sprint A (KB + CampaignTemplate + tableau croisé) | 0 Will | +113 pts | J+1 Claude |
| 5 | Adresse FR Sedomicilier ~30€/mois | 1h admin | Débloque GBP | J+7 |

---

## 8. Score qualité cross-cutting : 82/100

| Critère | Note /25 | Commentaire |
|---------|----------|-------------|
| Cohérence scores inter-agents | 20/25 | 6/9 agents parfaitement alignés. 2 divergences mineures documentées. 1 agent obsolète (A6-07). |
| Cohérence roadmap | 22/25 | Trajectoire 3638→GO cohérente. 1 divergence A6-05 (+56 pts base) documentée. |
| Cohérence décisions | 22/25 | 12/15 parfaites. 3 divergences D8/D9/D18 tranchées par décision canonique Will. |
| Exclusions respectées | 18/25 | 3 violations mineures dans agents obsolètes 2026-05-21 (Wikidata ×2, DPA ×1). Version P6.1 propre. |

**Score qualité cross-cutting : 82/100 — ACCEPTABLE (seuil GO : 70/100)**

Points de prudence (-18 pts) :
- A6-07 utilise base 3598 obsolète (−6)
- A6-05 base Sprint C gonflée +56 pts (−4)
- Violations exclusions A6-05/A6-07 (versions anté-décision) (−6)
- Divergences D8/D9/D18 entre agents et brief (−2, tranchées)

---

*Cross-cutting mis à jour 2026-05-22 — Claude Sonnet 4.6 — AUDIT-ONLY*
*HEAD audité : e573da64 | Score référence : 3638/5000 | Société : Axion-IA (française)*
*Remplace CROSS-CUTTING v1 (2026-05-22, score 3805 avec commits locaux)*
