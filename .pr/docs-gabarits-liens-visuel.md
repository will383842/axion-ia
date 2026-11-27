# docs(gabarits) : rendu visuel des liens dans les articles

Conception seulement : une maquette et un document de règles. **Aucun code applicatif touché.** Tout est dans `docs/design/gabarits-articles/liens/`. `PLAN.md`, `DECOUPAGE.md` et `maquettes-v2/` n'ont pas été modifiés (une autre tâche y travaille).

## Pourquoi

Le propriétaire veut que les liens internes et externes ne fassent ni « textuel » ni « bloc de texte ». Ils doivent être beaux, donner envie de lire, et servir la prospection et la visibilité.

## L'idée

Une signature visuelle par intention, reconnaissable d'un coup d'œil :

- **bleu + flèche** pour lire la suite sur le site ;
- **icône de sortie + pastille du domaine** (`insee.fr`) pour vérifier une source ;
- **pointillé terracotta + définition en note de marge** pour un mot du glossaire ;
- **terracotta, carte mocha et vrais boutons** pour passer à l'action (Diagnostic IA, 45 min · Journée IA · contact).

Les cartes « À lire aussi » avec vignette, le panneau sable numéroté « Pour aller plus loin » et la carte mocha cassent l'effet « bloc de texte ».

## Ce qu'il y a dans la PR

- `maquette.html` : un article d'exemple (« Automatiser vos devis avec l'IA ») qui montre **tous** les types de liens. Fichier autonome, CSS inline, zéro JavaScript, version ordinateur et téléphone. Les étiquettes ocre en pointillés ne servent qu'à la maquette.
- `LIENS.md` :
  - pour chaque élément : quand l'utiliser, combien au maximum par article, et le balisage exact (`data-lien`, classes) que le générateur doit produire ;
  - la politique `rel` (`nofollow` et `sponsored` selon le cas) et le choix du même onglet ;
  - les changements à prévoir dans le sanitizer, les contrastes vérifiés et le budget CSS mesuré ;
  - l'avis des 5 spécialistes et les arbitrages entre eux ;
  - ce que S2, G1 à G8 et la tâche `feat/contenu-lisibilite-valeur` doivent reprendre.

## Plafonds par article

6 liens internes dans le texte, 4 liens externes, 3 termes de glossaire, 1 bloc de 3 cartes « À lire aussi », 3 liens « Pour aller plus loin », 8 sources, et **3 emplacements d'action au maximum** : 1 lien dans le texte, 1 carte au milieu, 1 bloc de fin.

## Points à connaître

- **Budget CSS** (mesuré sur la maquette, gzip -9) :
  - styles des liens dans le texte : 1,33 Ko ;
  - ensemble des blocs : 3,6 Ko, soit **au-delà** des + 2 Ko accordés à toute la refonte.
  - Règle posée : seule la partie « texte » va dans `base.css` (cible ≤ 1 Ko). Les blocs passent en utilitaires Tailwind. S2 mesure, et au-delà du budget c'est STOP & ASK.
- **Écart trouvé dans le code, non corrigé ici** : le sanitizer et `persist-citations.ts` ne classent pas les sources de la même façon. Une source fiable peut donc sortir en `nofollow`. Le commentaire en tête de `trust-tier.ts` contredit aussi le code. Ces deux points sont confiés à la tâche du générateur.
- **Contenu** : aucun prix, aucun frais de déplacement, aucune ville. La réassurance « gratuit · 45 minutes · sans engagement » est rattachée au seul Diagnostic IA.
- **Prettier** : `pnpm exec prettier` est indisponible ici (pas de `node_modules`). Prettier 3 a été lancé à part, avec les mêmes options : il n'a rien changé.

## Équipe et relecture

Cinq spécialistes ont travaillé en parallèle : design éditorial, SEO, conversion, accessibilité et performance. Un arbitre qualité a relu la maquette en trois tours, avec captures à 1366 et 375 px et parcours au clavier.

- Tour 1 : 10 défauts, dont un bloquant (la réassurance « gratuit » semblait s'appliquer aussi à la Journée IA).
- Tour 2 : 2 restes.
- Tour 3 : rien à corriger.

VERDICT OPUS : BON

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01E7vxGdT5qdXxzwjZ53MhCm
