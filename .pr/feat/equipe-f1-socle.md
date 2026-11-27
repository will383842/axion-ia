# Pages équipe · F1 : socle `src/lib/equipe/`

## Quoi

Un module pur (aucun accès base, aucun composant React, aucune interface) qui pose les règles des pages « équipe » :

- `types.ts` : la fiche d'un collaborateur et sa version publique.
- `categories.ts` : les cinq catégories (direction, apporteur, développeur, spécialiste IA, partenaire) avec libellé, jeton de couleur (jamais une valeur hex), forme du point sur la carte, ordre du hub.
- `regles.ts` : nom affiché (prénom seul pour tous, nom complet pour le seul dirigeant principal), initiales, slug (prénom, puis prénom-ville, puis suffixe numérique), indexabilité, et `fichePublique`, la seule sortie à transmettre à une page.
- `geo.ts` : coordonnées d'un lieu (ville connue, sinon chef-lieu du département), projection conique vers le repère SVG de la carte de France, décalages en couronne. Le dirigeant principal n'a pas de point.

## Pourquoi

Le nom de famille d'un collaborateur ne doit jamais atteindre une page. La garantie est structurelle : `fichePublique` recopie champ par champ, retire les textes contenant un fragment du nom de famille ou une formulation interdite (prix, commission, frais de déplacement, etc.), régénère un slug qui le contient, et n'expose la photo qu'avec un consentement daté.

## Comment vérifier

- `pnpm vitest run src/lib/equipe` : 87 tests (cas limites : prénoms composés, accents, lettres spéciales, prénom vide, doublons de slug, noms à particule, valeurs nulles, départements inconnus).
- `pnpm typecheck`, `eslint src/lib/equipe`, `prettier --check` : verts.
- Aucune page touchée : pas de mesure Web Vitals ni de `bundle:check` à faire. `src/server/content-gen/equipe/` n'est pas touché.

## Points à trancher plus tard

- Le chef-lieu de département sert de repli pour placer un point : si la ville est écartée d'un texte, le point reste posé sur le chef-lieu.
- Un nom de famille saisi dans le champ prénom n'est détecté que si le nom complet est fourni ; la console devra valider ce champ.
- Un prénom en écriture non latine donne un slug nul (pas de fiche publique).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01E7vxGf7B5HLEtyCwwFTERs

VERDICT OPUS : À CORRIGER — 2 tours faits. Corrigé après le tour 2 : fuites du nom dans les textes, photo sans consentement, slug réservé, noms à particule. Restent à confirmer par un 3e passage : ce dernier jeu de corrections n'a pas été relu ; et les points ci-dessus (repli chef-lieu, validation du champ prénom).
