# Pied de page : fin des faux titres (F0)

## Quoi

Le pied de page du site ajoutait 4 titres `h2` et 1 titre `h3` à chaque page. Ils deviennent des paragraphes `<p>` avec exactement les mêmes classes, donc le même rendu. Chaque liste de liens est nommée par son intitulé visible (`aria-labelledby`). Aucun texte ni lien ne change.

## Pourquoi

Ces titres faussaient la hiérarchie des titres de toutes les pages (plan du document, lecteurs d'écran, lecture par les moteurs). Le pied de page ne doit pas écrire dans le plan de la page.

## Comment vérifier

- `pnpm vitest run src/components/nav` : tout passe, dont deux nouveaux contrôles : aucun h1-h6 ni `role="heading"` dans le pied rendu, et chaque liste pointe vers un intitulé non vide.
- `pnpm typecheck`, `pnpm lint` (0 erreur), `pnpm format:check` : verts.
- Visuel : ouvrir une page, le pied est identique à l'avant (mêmes classes, preflight Tailwind identique pour `p` et `h2`).
- Lecteur d'écran : le pied est un repère `nav` ; chaque colonne est une liste nommée.

## Mesures

- First Load JS : +0. Composant serveur, aucun JavaScript client ajouté ; seul le balisage HTML change. Mesure par build non faite ici (build complet trop long hors CI) ; `pnpm bundle:check` non lancé pour la même raison, à lire dans la CI.
- CLS : inchangé (mêmes classes, mêmes dimensions).

## À savoir

Les utilisateurs de lecteur d'écran ne peuvent plus sauter de titre en titre dans le pied (touche H) ; ils passent par les listes nommées.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01E7vxGfMKcgASuZQC3FPExQ

VERDICT OPUS : BON — relecture Opus faite : aucune régression visuelle ni test cassé ; ses deux remarques (aria-labelledby au lieu de aria-label, test sur le rendu réel) ont été appliquées. Reste : bundle:check et mesure du First Load JS à lire dans la CI.
