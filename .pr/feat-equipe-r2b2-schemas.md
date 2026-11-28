# Pages équipe R2b2 : blocs « Vous êtes… » et « Partout en France »

## Résumé

Deux nouveaux blocs visuels pour la fiche équipe, sans toucher aux fichiers des autres lots.

- **Vous êtes…** : le dirigeant se reconnaît. 3 cartes « par taille » (dirigeant seul, TPE, PME), puis une grille « par métier » (6 à 8 cartes). Chaque carte suit trois temps : Coût, Action, Gain, avec un chevron SVG entre eux ; le gain est en terracotta foncé et en gras. Un titre h3 par carte, listes `ul/li`. Le bloc est masqué sans donnée.
- **Partout en France** : H2 en question, réponse directe, pastilles des régions (source `REGIONS`), 12 villes au plus, chacune avec le lien « Nous intervenons à … », carte de France SVG décorative (réutilise le contour déjà dans le dépôt), lien optionnel vers l'index des villes (`/implantations`, existant), phrase de lieu optionnelle pour un collaborateur.

Les textes de Williams viennent du lot R2c1 : ici, uniquement des données de test. Aucun composant n'importe `ContenuFiche`.

## Fichiers

- `src/components/equipe/visuels/VousEtes.tsx` (remplace `PourQuiEntreprises`, non créé)
- `src/components/equipe/visuels/Silhouettes.tsx`
- `src/components/equipe/visuels/PartoutEnFrance.tsx`
- `src/lib/equipe/villes-phares.ts`
- `src/components/equipe/__tests__/r2b2-schemas.spec.tsx`

## Point à trancher

Les villes viennent de `getVillesCitablesMaillage()` (la source des pages « par ville », triée par population). Depuis la décision du 18/11/2026, les pages `/audit/par-ville/<slug>` sont en `noindex, follow` ; la page indexée d'une ville est `/implantations/<région>/<ville>`. Les liens suivent la consigne (`/audit/par-ville/<slug>`). Si l'on préfère lier la page indexée, il suffit de changer `href` dans `villes-phares.ts`.

## Hors de ce lot (non fait ici)

Les autres éléments du § 4.3 (`AvantApres`, `Rassurance`, `PorteEntree`, `MetiersCollaborateur`, `CitationsTerrain`) ne sont pas traités : la consigne limitait le lot aux deux blocs. Le branchement dans la fiche est pour R2d.

## Vérifications

- `vitest run r2b2-schemas.spec.tsx` : 13 tests verts
- eslint et prettier : propres sur les fichiers du lot
- grep des mots interdits sur les fichiers du lot : rien
- typecheck : passe (sans erreur)

`pnpm-lock.yaml` : non touché.

Relecture Opus : corrigé le mouvement au survol (désormais sous `motion-safe:`) et le plafond de villes (constante). Reste le point ci-dessus : l'Opus recommande `/implantations/<région>/<ville>` (page indexée) ; la consigne demandait `/audit/par-ville/<slug>`, conservé.

VERDICT OPUS : À CORRIGER (seulement le choix du lien ci-dessus, à trancher par le propriétaire)
