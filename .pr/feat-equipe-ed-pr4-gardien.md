# Gardien anti-doublon et anti-cannibalisation (équipe éditoriale, PR 4)

**Dépend de #2357.**

## But

Un module qui décide, AVANT tout appel d'écriture payant, si un brief peut être rédigé : `feu_vert`, `reorienter` (avec angle), `mettre_a_jour` (avec l'article visé), `ecarter`, ou `relecture_humaine`. Éteint par défaut : actif seulement si `CONTENT_EQUIPE_EDITORIALE` vaut exactement `"true"`.

## Fichiers

- `src/server/content-gen/equipe/gardien.ts` (nouveau)
- `src/server/content-gen/equipe/gardien.test.ts` (nouveau)
- Aucun fichier de contenu, aucune migration, aucun changement du frontend.

## Règles

1. Mot-clé déjà possédé par une autre URL (carte des requêtes) → `mettre_a_jour`. Si le propriétaire est l'URL cible du brief, ce n'est pas un blocage.
2. Voisin publié ≥ seuil doublon (0,85, seuils du fournisseur d'embeddings actif) → `mettre_a_jour`, ou `ecarter` si le voisin n'a pas d'URL. Pour un brief `mise-a-jour`, l'article visé lui-même est exclu des voisins ; pas pour un brief `neuf`.
3. Zone 0,80–0,85 seulement → arbitrage par claude-sonnet-5-5 (porte `blog-claude`, rôle « court »), injectable. Erreur, sortie illisible, lecture des voisins en échec, similarité invalide → `relecture_humaine` (échec fermé, jamais `ecarter`).
4. Une question du brief déjà traitée par une FAQ (comparaison normalisée : minuscules, accents, ponctuation) → `reorienter`, y compris après un `feu_vert`/`reorienter` de l'arbitre.
5. Sinon `feu_vert`, sans appel au modèle.
6. `gardienPuisEcrire` n'appelle l'écriture que sur `feu_vert`/`reorienter`. Interrupteur éteint : `desactive`, et l'écriture est appelée comme avant.

FAQ lues en lecture seule : `questions-reference.ts` et la FAQ de `journee-ia/contenu.ts` (exception documentée à la règle de frontière ESLint). `paires-similaires.ts` (paires de titres par Jaccard, écrites par le worker) a été examiné mais n'est pas utilisé : il ne porte pas d'embedding du brief.

## Tests

28+ tests Vitest : chaque seuil (0,799 / 0,80 / 0,849 / 0,85), arbitrage simulé (toutes décisions, erreur, sortie invalide), `arbitreClaude`, aucune écriture sur `ecarter`/`mettre_a_jour`/`relecture_humaine`, normalisation FAQ, interrupteur éteint. Typecheck et lint OK.

## Risques

- Rien ne l'appelle encore : le module est inerte tant qu'il n'est pas branché.
- L'arbitre par défaut dépend aussi de `CONTENT_GEN_BLOG_CLAUDE` et des plafonds : s'ils refusent, la zone part en relecture humaine (voulu).
- Injection de prompt : le brief et le titre du voisin sont passés comme données JSON ; la sortie de l'arbitre est bornée à quatre décisions, mais un `feu_vert` abusif en zone reste possible. L'`angle` (texte du modèle) doit être traité comme une donnée par l'appelant.
- Seul le voisin le plus proche est arbitré.
- Seuils Voyage réglables par variables d'environnement : le prompt dit « environ 0,80 à 0,85 ».
- Pas de changement de `pnpm-lock.yaml`.

VERDICT OPUS : BON
