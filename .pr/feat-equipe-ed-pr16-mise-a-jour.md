# Équipe éditoriale, PR 16 : mode « mise à jour » des articles anciens

## But

Permettre à l'équipe éditoriale de mettre à jour un article ancien désigné par les règles du suivi après publication (PR 14), sans changer son adresse. Tout est éteint par défaut derrière `CONTENT_EQUIPE_EDITORIALE` (valeur exacte `"true"`).

## Fichiers

- `src/server/content-gen/equipe/mise-a-jour.ts` (nouveau) : le circuit, dépendances injectées.
- `src/server/content-gen/equipe/mise-a-jour-reel.ts` (nouveau) : branchement réel (gardien, vérificateur en deux phases, conformité, rédacteur en chef, base, quota Redis).
- `src/server/queue/workers/content-refresh-worker.ts` : nouvelle tâche facultative `tache: "mise-a-jour"` (champ facultatif de la charge BullMQ).
- Tests : `mise-a-jour.test.ts`, `mise-a-jour-reel.test.ts`, `content-refresh-interrupteur.spec.ts` (complété).

## Règles

- Slug, mot-clé principal et URL cible inchangés, sinon refus ; le gardien confirme.
- Quota `equipe_maj_max_jour` (1 par jour par défaut) ; plafond de coût par article (3 $, coût de conformité compris).
- Le vérificateur refait la phase B sur les phrases chiffrées (25 au plus) ; le rédacteur ne réécrit que les sections concernées ; refus si une phrase refusée est introuvable ou subsiste, si un chiffre nouveau apparaît, ou si un titre h2 change.
- Conformité rejouée sur le texte final, puis le rédacteur en chef tranche.
- La date (`updatedAt`) n'est écrite que si le HTML a réellement changé (comparaison hors espaces) ; jamais de date seule.
- Quota atteint : les articles non traités sont dégagés du délai de 28 jours.
- Interrupteur éteint : requête et comportement du worker identiques à avant (test à l'appui, le corps n'est pas lu).

## Tests

`pnpm vitest run src/server/content-gen/equipe/mise-a-jour src/server/queue/workers/__tests__/content-refresh-interrupteur.spec.ts` : verts ; `pnpm typecheck` et eslint propres. Couvre : URL inchangée, mot-clé changé refusé, date seulement si contenu changé, quota, interrupteur éteint.

## Risques

- Aucun producteur n'enfile encore `tache: "mise-a-jour"` (comme pour les autres tâches) : lancement manuel ou futur planificateur.
- Issues « relecture humaine » / « refus » : seulement au journal du worker pour l'instant.
- Mot-clé principal tiré de la carte des requêtes (premier par ordre alphabétique) ; au-delà de 25 phrases chiffrées, seules les 25 premières sont vérifiées.
- Le corps est écrit tel quel en base (assaini au rendu) ; pas de revalidation de cache après écriture.
- `content-gen-worker.ts` non touché. Rebase sur origin/main à refaire au moment de la fusion de #2379 (même fichier worker).

## Relecture

Tour 1 : 17 remarques, corrigées en majorité. Tour 2 : un point restant (phrase refusée toujours présente), corrigé et testé.

VERDICT OPUS : BON
