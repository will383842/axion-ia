Gabarit d'article « Comparatif » : neutralité, face-à-face, tableau récapitulatif (derrière l'interrupteur éteint)

## Base de la PR

**Base : `main`**, après la fusion de S2 (cette branche part de `feat/gabarits-articles-s2-composants`, verdict Opus BON) : tant que S1 et S2 ne sont pas sur `main`, le diff affiche aussi leurs fichiers.

## Ce que fait la PR

Implémente seulement le modèle M-G3 « Comparatif » (DECOUPAGE.md, fiche G3, maquette v3 `comparatif.html`), derrière `BLOG_GABARITS_V2`, éteint par défaut : interrupteur coupé, la page V1 ne change pas.

- **Phrase de neutralité** (`.neutralite`, `data-aeo="neutrality"`) : « ce comparatif ne classe aucune offre d'Axion-IA et n'est financé par aucun éditeur ».
- **Face-à-face A / « ou » / B** (`.duel`, `role="group"`) tiré du **titre** (« A ou B », « vs », « contre », « versus », « or ») ; camps courts (≤ 4 mots), jamais une question ni une phrase ; sinon rien. Camp A terracotta, camp B prune, **jamais de bleu**.
- **Premier tableau du corps remonté** dans l'ouverture (« Tableau récapitulatif », entrée en tête du sommaire, ancre unique), retiré du corps (une seule occurrence). Vrai `<table>`, région défilante focusable et nommée par son titre. Les cellules « Oui » / « Non » / « Partiel » portent une classe et une coche CSS (texte alternatif vide : le texte reste la seule information lue).
- **Encart du milieu** : bouton « Diagnostic IA, 45 min », lien « Écrire un message ».
- Fichiers : `GabaritComparatif.tsx`, `src/lib/blog/comparatif.ts` (fonctions pures), `comparatif.css`, `comparatif.{fr,en}.json`, tests.

⚠️ **Fichiers partagés touchés (additif, valeurs par défaut inchangées)** : `CtaMilieu.tsx` (prop `secondaire`), `GabaritAnalyse.tsx` (props `ctaSecondaire`, `ouvertureExtra`), `scripts/check-contrast.ts` (3 paires : sage et ocre sur paper/ivoire, ocre ajouté au miroir). G4, G6 et G7 auront besoin du même point d'extension : à fusionner en premier ou à reprendre en petite PR socle.

## Périmètre NON livré (volontaire)

Points forts / limites en deux colonnes, cartes « Pour qui ? », arbre de décision, verdict « ça dépend », surtitre « Alternatives à… » : ces contenus n'existent pas comme données (le corps est du HTML libre généré) et le type de contenu n'est pas transmis aux gabarits ; les reconstruire reviendrait à inventer du contenu. **Suite à décider** : données structurées côté générateur, puis gabarit. Mention « Sur téléphone, faites défiler » non reprise. Le titre H2 et l'introduction du tableau restent dans le corps une fois le tableau remonté (inhérent à la fiche). Un tableau qui porterait une colonne de prix gagne en visibilité : à surveiller sur des articles réels.

## Tests

- `tests/unit/blog/comparatif-lib.spec.ts` et `gabarit-comparatif.spec.tsx` (rendu serveur : un h1, ni `<main>` ni en-tête de site, pas de svg dans la photo, neutralité, duel, tableau non dupliqué, ancre unique, région unique, coches, sommaire, sans tableau, article en fichier, CtaMilieu, mots interdits ; **injection `$'` dans `class` verrouillée**).
- Verts en local : `tests/unit/blog` (150 tests), `pnpm typecheck`, `i18n:check`, `anti-hex:check`, `contrast:check` (56 paires), `content-gen:isolation-check`, `image-bank:isolation-check`, eslint (0 erreur), prettier.
- **Non fait** : axe 1280/320 px, défilement horizontal à 320 px, interrupteur coupé sur la page entière (T1 et tests de S1), mesure de temps.

## Mesure (First Load JS, route article)

Aucun JavaScript client ajouté (aucun `"use client"`, composants serveur, fonctions pures). **JS : +0** par construction. CSS du gabarit : 1,0 Ko gz, chargée avec la route (la feuille est importée par le gabarit). Build de mesure non relancé ici (mémoire) : le seuil de 75 Ko gz n'est pas mesuré par une gate ; à relire sur un build avant mise en ligne.

Points mineurs restants (relecture tour 2) : camp B parfois long ou en minuscule dans le face-à-face ; coches seulement pour Oui / Non / Partiel (pas « Yes / No », ni cellule balisée) ; « ou » central masqué aux lecteurs d'écran ; note du tableau générique.

VERDICT OPUS : BON (tour 2 sur 3 ; aucun défaut bloquant ni important ; mineurs ci-dessus)
