# V6-01 — Complétude des sources lues par P6
## Date : 2026-05-22 | HEAD audité : e573da6 | Score : 141/150

---

## Tableau des 21 sources

| # | Source attendue | Preuve textuelle dans P6 | Fichiers P6 | Statut | Pts |
|---|---|---|---|---|---|
| 1 | PHASE-1-VERDICT.md → "531.5" | `D-ETAT (état pipeline) | 531.5 /1000` — baseline P1 citée | A6-01:11 | ✅ | 7.1 |
| 2 | RAPPORT-VERIFICATION-FINALE P1.5 → "192/200" | `192/200 (vérif 11 agents)` + `ancré sur la vérification indépendante 192/200 (96%)` | A6-01:11,20,92 ; PHASE-6-VERDICT-GLOBAL:40 | ✅ | 7.1 |
| 3 | PHASE-2-VERDICT.md → "726" | `baseline 726 /1000` (D-ARCHI) ; `726 points de la baseline` | A6-01:12,22,104 | ✅ | 7.1 |
| 4 | PHASE-3-VERDICT.md → "689" | `689 /1000 | 761 (pré-commits tardifs)` (D-VISI baseline) | A6-01:13 | ✅ | 7.1 |
| 5 | PHASE-4-VERDICT.md → "547" | `547 /1000 | 662 (pré-fixes)` (D-QUAL baseline) | A6-01:14 | ✅ | 7.1 |
| 6 | PHASE-5-VERDICT.md → "315" | `315 /1000 | ~593` (D-OPS baseline) | A6-01:15 | ✅ | 7.1 |
| 7 | Vérif Sprint P3 → "761" | `Vérification indépendante 761/1000 avant deux commits tardifs` | A6-01:13,24,94 | ✅ | 7.1 |
| 8 | Vérif Sprint P4 → "712" | `D-QUAL 712/1000` score retenu post-vérif P4 ; commit 364f2c6 cité | A6-01:14,26,95 | ✅ | 7.1 |
| 9 | Sprint P5 score → "593"/"652" | `~593 déclaré vs 519 vérifié = -74 pts = 12.5% d'inflation` | A6-01:15,28,96 | ✅ | 7.1 |
| 10 | Vérif P2 correctif AI Act → "AI Act CONFORME" | `AI Act art. 50 deadline 2026-08-02` 10+ occurrences ; `aiGenerated:true` | VERDICT-GLOBAL, RISQUES, ROADMAP, A6-05 | ✅ | 7.1 |
| 11 | Décisions Will D7 → "D7" + "société française" | `D7 | Société française pure` (A6-11:26) ; `D7 = société française` (CROSS-CUTTING:94) | A6-11, CROSS-CUTTING, DECISIONS-CANONIQUES, VERDICT-GLOBAL | ✅ | 7.1 |
| 12 | axionia_p4_decisions_canoniques → D1-D5 | `D1 Seuil REJECT 6.0/10` ; D2, D3, D4, D5 tous listés | A6-11:21-25 | ✅ | 7.1 |
| 13 | axionia_p5_decisions_canoniques → D-P5 / presets | `D-P5-1 6 presets CampaignTemplate` ; D-P5-2 à D-P5-6 tous listés | A6-11:15-20 ; VERDICT-GLOBAL:179 | ✅ | 7.1 |
| 14 | PROMPT-MASTER → "/5000" + 5 dimensions | `/5000` présent 40+ fois ; D-Etat/D-Archi/D-Visi/D-Qual/D-Ops structurent P6 | A6-01, VERDICT-GLOBAL, ROADMAP | ✅ | 7.1 |
| 15 | axionia_decisions_will_final → "Wikidata"/"DPA" exclusion | `Wikidata RENONCÉ par décision Will` ; `DPA Anthropic (reporté)` ; `Exclusions absolues` | DECISIONS-CANONIQUES:6 ; VERDICT-GLOBAL:180 ; CROSS-CUTTING:91-92 | ✅ | 7.1 |
| 16 | axionia_sprint_p3_corrections → score sprint P3 | Score référencé via 689→761 D-VISI et `P3-VERDICT (SEO/AEO/GEO)` dans A6-06 | A6-01, A6-02, A6-06 | ⚠️ | 3.0 |
| 17 | axionia_sprint_p4_corrections → score sprint P4 | Score P4 référencé via 547→662→712 ; commit 364f2c65 cité | A6-01, A6-06:478 | ⚠️ | 3.0 |
| 18 | axionia_sprint_p5_corrections → score sprint P5 | `~593 déclaré` ; `e573da64` (commit P5 follow-up) cités | A6-01:15,28,96 ; VERDICT-GLOBAL:77 | ✅ | 7.1 |
| 19 | axionia_verif_sprint_p2_corrections → "P0-1"/"RESTRICT" | `P0-1 CASCADE→RESTRICT` cité 8+ fois ; pattern P0-1/P0-5/P0-6 | A6-01:107,154 ; A6-03:31 ; RISQUES-MITIGATION:25 | ✅ | 7.1 |
| 20 | axionia_verif_sprint_p3_corrections → "TOC"/"AuthorByline" | `ArticleTOC blog` ; `AuthorByline blog` dans commits tardifs | A6-01:24 ; A6-02:45 ; A6-12:26 ; VERDICT-GLOBAL:20 | ✅ | 7.1 |
| 21 | axionia_verif_sprint_p4_corrections → "AiContentDisclaimer" | `AiContentDisclaimer /implantations + faq-standalone persona` commit 364f2c6 | A6-01:26 ; A6-11:23 ; VERDICT-GLOBAL:20 | ✅ | 7.1 |

### Légende
- ✅ Preuve directe (chiffre/terme clé trouvé) : 7.1 pts
- ⚠️ Preuve indirecte (via verdict phase, pas via fichier mémoire sprint) : 3.0 pts
- ❌ Absent : 0 pts

### Notes sur les ⚠️

**Source 16 (axionia_sprint_p3_corrections)** : P6 cite 689→761 D-VISI et `P3-VERDICT (SEO/AEO/GEO)` comme source, mais le fichier mémoire sprint correctif P3 spécifiquement (~745/1000) n'est pas cité avec son chiffre propre.

**Source 17 (axionia_sprint_p4_corrections)** : P6 cite 547→662→712 D-QUAL et le commit 364f2c6, mais le score sprint correctif P4 (~740/1000 déclaré dans la mémoire) n'apparaît pas.

### Calcul score

| Statut | Nb | Pts | Total |
|---|---|---|---|
| ✅ Preuve directe | 19 | 7.1 | 134.9 |
| ⚠️ Preuve indirecte | 2 | 3.0 | 6.0 |
| ❌ Absent | 0 | 0 | 0 |

**Score V6-01 : 141/150** 🟢
