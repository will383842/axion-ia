# Équipe éditoriale — PR 11 : rédacteur en chef

Dépend de #2366 et #2367.

## But

Ajouter le rédacteur en chef de l'équipe éditoriale, derrière `CONTENT_EQUIPE_EDITORIALE` (actif seulement si la valeur vaut exactement `"true"`). Le juge Opus existant (`reviewer/llm-judge.ts`) devient le rédacteur en chef dans ce circuit : il n'y a pas de second juge. Il ne sert qu'à noter l'utilité pour un dirigeant (Q12) ; tout le reste est du code pur.

## Fichiers

- `src/server/content-gen/equipe/redacteur-en-chef.ts` (nouveau) : grille Q1 à Q13, règles de décision, circuit complet.
- `src/server/content-gen/equipe/redacteur-en-chef.test.ts` (nouveau) : 44 tests.
- `.pr/feat-equipe-ed-pr11-redacteur-en-chef.md` : ce texte.

Aucun fichier existant modifié par cette PR (hors fusion des deux branches dont elle dépend). Pas de migration, pas de frontend. Une seule résolution de conflit lors de la fusion de #2366 : une ligne d'import dans `blog-from-title.ts` (on garde celle de #2366).

## Fonctionnement

- Bloquants Q1 à Q6 : échec → renvoi au rôle responsable (Q1 rédacteur avec les passages exacts ; Q2 vérificateur puis rédacteur ; Q3 arrêt ; Q4 mailleur ; Q5 architecte ; Q6 éditeur SEO).
- Q7 et Q13 (relecture) : échec → relecture humaine.
- Q8 à Q12 (renvoi) : un seul renvoi groupé, ou publication si la note globale est ≥ 8,5 et que les écarts sont mineurs (Q9, Q10, Q11 seulement).
- Tout vert : « à relire » si le sujet touche la Journée IA (réutilise `relecture-journee-ia.ts`), sinon publier.
- Au plus 2 renvois, puis relecture humaine avec `blockCauses` (liste de libellés, comme le format existant).
- Plafond de 3,00 $ par article atteint → relecture humaine, sans appel au modèle.
- Erreur du modèle → relecture humaine. Un P0 relevé par le modèle → relecture humaine.
- Si un bloquant échoue déjà, on décide sans appeler le modèle (pas de note achetée pour rien).
- Interrupteur éteint : `jugerPourCircuit` appelle le juge actuel avec exactement les mêmes arguments ; `redacteurEnChef` rend « inchangé » sans aucun appel.

## Tests lancés

- `pnpm vitest run src/server/content-gen/equipe` : 10 fichiers, 222 tests, tous verts.
- `pnpm exec eslint` sur les deux fichiers ajoutés : propre.
- `pnpm exec prettier --write` passé.
- `pnpm typecheck` : propre.

## Risques et limites

- Le module est livré et testé mais **pas encore branché** dans `content-quality-improver-worker.ts` : le brancher demande que les rapports des rôles (gardien, mailleur, conformité, éditeur SEO) soient disponibles dans la sortie du job, ce qui relève d'un lot suivant. Tant qu'il n'est pas branché, rien ne change en production.
- Les seuils « mineur » (Q9 à Q11) et le critère Q12 (dimension `valueToReader` du juge) sont des choix de cette PR, à confirmer.
- Q3 : « doublon » = le gardien a écarté ou renvoyé vers une mise à jour.

## Relecture Opus (1 tour)

Corrigé après la relecture : panne d'un contrôle (rapport de conformité absent ou en erreur, gardien absent ou en relecture humaine) → relecture humaine au lieu d'un renvoi inutile ; Q3 (arrêt) passe avant le plafond de coût ; le modèle n'est plus appelé quand Q7 ou Q13 échoue ; tests ajoutés pour tous ces cas.

Restant, non corrigé (à trancher) :

- le coût de l'appel du juge n'est pas rendu à l'appelant, donc le plafond de 3,00 $ ne voit pas la dépense du rédacteur en chef lui-même (à traiter au branchement dans le worker) ;
- un renvoi pour bloquant n'embarque pas encore les écarts Q8 à Q11 relevés en même temps ;
- Q1 et Q2 ensemble produisent deux renvois au rédacteur non fusionnés ;
- aucune exigence de note globale quand toute la grille est verte (seul Q12 compte) : moins strict que le juge actuel ;
- le deuxième tour de relecture n'a pas été relancé après ces corrections.

VERDICT OPUS : À CORRIGER
