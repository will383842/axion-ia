# T5 — Formation Engine EXCELLENCE (plan corrigé)

Extension du moteur T4 (ne pas recréer). Spec agent + **corrections** ci-dessous.

## Corrections vs spec agent (IMPORTANT)
- **PAS de nouveaux statuts** `FormationStatutGeneration` (backward_design_genere/critique_effectuee). → **ZÉRO migration schéma T5.** Les sous-étapes s'enchaînent DANS les transitions existantes :
  - transition `intention→structure_generee` : worker fait backwardDesign → persona → generateStructure (résultats dans `programmeDetaille.{backwardDesign,persona}`), puis avance à `structure_generee`.
  - transition `structure_generee→contenu_evalue` : worker fait critique adversariale → evaluateQuality (validations excellence), puis avance à `contenu_evalue`.
- **Grille v2** : nouveau seed `grille_qualite_v2` (10 critères, somme=100, scorePlancher 80, promptVersion 2, actif=true) ; désactive v1 (`actif=false`). Seed idempotent. Pas de changement à grille-schema.ts (générique).
- Tout stocké dans `programmeDetaille` Json (backwardDesign, persona, adversarialCritique, filRouge, livrables j0/j1/j30) — aucun nouveau modèle/colonne.

## Grille v2 — 10 critères (somme poids = 100)
objectifs_mesurables 15 / bloom_progression 10 / moments_cles 5 / alignement_objectifs_contenu_eval 15 / progression_pedagogique 12 / ratio_pratique 15 / kirkpatrick_l2 5 / clarte_structure 12 / faisabilite_exercices 8 / fil_rouge_narratif 7 = 100. scoreMin 65-70 selon critère. scorePlancher 80.

## Modules à créer (cloisonnés src/server/qualiopi/engine/**)
- `adversarial-critique.ts` : `runAdversarialCritique({formationId, structure, persona, backwardDesign})` → {scoreGlobal/10, angles(5: engagement/transferabilite/memorisation/adequation_public/realisme_exercices), pointsForts, axesAmelioration, verdict OK/ATTENTION/CRITIQUE, _meta}. Réutilise anthropicProvider + cost-tracker + cache. Parsing défensif.
- `validation-excellence.ts` : `validateExcellence(programme, backwardDesign)` → {synthesesOk (erreur si séquence >45min sans synthèse), filRougeOk, livrablesOk (j0/j1/j30), verdict, axesCorrection}. PUR (testable).

## prompts.ts — ajouts
- `buildBackwardDesignSystemPrompt()` + `buildBackwardDesignUserPrompt(formation)` (phase -1 : résultats 30j → preuves → activités).
- `buildPersonaSystemPrompt()` + `buildPersonaUserPrompt(publicVise, contexteIa?)`.
- Modifier `buildStructureUserPrompt` : injecter persona si présent + demander champs `fil_rouge`, `livrables_j0/j1/j30` dans le JSON de sortie.

## worker — intégration (qualiopi-formation-engine-worker.ts, édits additifs)
- `stepBackwardDesign(formation)` + `stepPersona(formation)` appelés au début de la transition `intention` (avant generateStructure), résultats merge dans programmeDetaille.
- `stepAdversarialCritique(formation)` appelé dans la transition `structure_generee` AVANT evaluateQuality ; si verdict CRITIQUE → force refine (axes injectés). Tracé FormationGenerationJob (etape adversarial_critique).
- `stepEvaluateQuality` : appeler `validateExcellence` + inclure dans metadata/commentaire.
- Chaque appel IA : cache + cost cap + trackCost + trace (comme T4).

## Découpage agents (2 //, non-overlap)
- **Agent A** : `adversarial-critique.ts` + `validation-excellence.ts` + seed `grille-v2.ts` (+ wire index) + tests (NEW files uniquement, n'édite PAS prompts.ts/worker).
- **Agent B** : ajouts `prompts.ts` (backward/persona builders + structure prompt update) + intégration worker (stepBackwardDesign/Persona/AdversarialCritique + validateExcellence) + tests. Importe les modules d'Agent A (interface : runAdversarialCritique, validateExcellence).
- Moi : seed run + nav (rien à ajouter ?) + gate + commit + push.

## Gate T5
typecheck heap + tests qualiopi/engine + isolation + i18n. Pas de migration. Seed grille v2 appliqué (vérifier v2 actif, v1 inactif).
