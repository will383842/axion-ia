# MATRICE DES 32 INDICATEURS RNQ — statut & preuve

Source : `src/server/qualiopi/conformite/conformite-service.ts` (`evaluerConformite`) +
`indicateurs-registre.ts`. Statut preuve : **RÉELLE** (calcul sur vraies données) /
**PROXY** (approximation) / **PROXY FAUX** / **NON COUVERT** (conditionnel APP/AFEST, `false` en dur).

| # | Critère | Couverture (condition `couvert`) | Statut | Ligne |
|---|---------|----------------------------------|--------|-------|
| 1 | C1 Info | `nbFormations>0 && nda≠""` | RÉELLE | :185 |
| 2 | C1 Résultats publiés | `nbSessionsRealisees>0` | PROXY | :187 |
| 3 | C1 Taux certif | `nbFormationsCertifiantes>0 && nbEvalFinales>0` | PROXY | :191 |
| 4 | C2 Analyse besoin | `nbFormations>0 && nbEvalInitiales>0` | RÉELLE | :201 |
| 5 | C2 Objectifs | `nbFormations>0` | PROXY | :206 |
| 6 | C2 Contenus | `nbFormations>0` | PROXY | :207 |
| 7 | C2 Adéquation certif | `nbFormationsCertifiantes>0` (+ preuve en dur) | PROXY+endur | :210 |
| 8 | C2 Positionnement | `nbEvalInitiales>0` | RÉELLE | :220 |
| 9 | C3 Info déroulement | `nbDocuments>0 && nbSessionsRealisees>0` | PROXY | :227 |
| 10 | C3 Adaptation | `nbEnrollmentsAdaptations>0` | RÉELLE | :232 |
| 11 | C3 Éval objectifs | `nbEvalFinales>0` | RÉELLE | :237 |
| 12 | C3 Engagement | `nbSessionsRealisees>0 && nbDocuments>0` | PROXY | :238 |
| 13 | C3 Coord. APP | `false` en dur (conditionnel APP) | NON COUVERT | :251 |
| 14 | C3 Citoyenneté APP | `false` en dur | NON COUVERT | :252 |
| 15 | C3 Droits/devoirs APP | `false` en dur | NON COUVERT | :253 |
| 16 | C3 Présentation certif | `nbFormationsCertifiantes>0` (+ preuve en dur) | PROXY+endur | :256 |
| 17 | C4 Moyens humains | `nbTrainers>0` | PROXY | :268 |
| 18 | C4 Coordination | `nbTrainers>0` | PROXY | :269 |
| 19 | C4 Ressources péda | `nbDocuments>0` | PROXY | :270 |
| 20 | C4 Personnels dédiés | `nbTraineesHandicap>0 \|\| nbAdaptations>0` | PROXY | :271 |
| 21 | C5 Compétences interv. | `nbTrainersAvecCV>0` (cvUrl≠null) | RÉELLE | :279 |
| 22 | C5 Dév. compétences | `nbTrainers>0` | PROXY | :287 |
| 23 | C6 Veille légale | `nbVeilleLegale>0` | RÉELLE | :290 |
| 24 | C6 Veille métiers | `nbVeilleMetiers>0` | RÉELLE | :291 |
| 25 | C6 Veille péda | `nbVeillePedagogique>0` | RÉELLE | :292 |
| 26 | C6 Handicap | `nbPartenariats>0 && referentHandicapNom≠""` | RÉELLE | :298 |
| 27 | C6 Sous-traitance | `nbSousTraitants>0` | RÉELLE | :309 |
| 28 | C6 AFEST | `false` en dur (conditionnel AFEST) | NON COUVERT | :310 |
| 29 | C6 Insertion | `nbSessionsRealisees>0` | **PROXY FAUX** | :311 |
| 30 | C7 Appréciations | `nbAppreciations>0` | RÉELLE | :315 |
| 31 | C7 Réclamations | `nbReclamations>0` | RÉELLE | :316 |
| 32 | C7 Amélioration continue | `nbRevues>0` où `nbRevues=count(statut:"validee")` | RÉELLE (gate OK) | :318 |

**Bilan** : 13 RÉELLES · 15 PROXY (dont 2 preuve-en-dur, 1 PROXY FAUX) · 4 NON COUVERT (conditionnels
APP/AFEST → `non_applicable` si l'OF ne déclare pas alternance/AFEST).

**À arbitrer par Will (P2, cf. QUESTIONS-WILL)** : off.29 (proxy faux insertion), off.20 (personnel
dédié), off.7/16 (preuves textuelles en dur), proxies faibles off.2/5/6/17/18/19/22. **off.32 est
correctement gaté** sur `statut=validee` (un brouillon ne couvre pas). Aucun indicateur « non vérifié »
silencieux : les 32 ont un statut explicite.
