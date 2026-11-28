Gabarit d'article « Sélection (top X) » : options numérotées, bandeau à mi-liste, tableau de synthèse (derrière l'interrupteur éteint)

## Base de la PR

**Base : `main`**, après la fusion de S2 (la branche part de `feat/gabarits-articles-s2-composants`, verdict Opus BON) : tant que S1 et S2 ne sont pas sur `main`, le diff affiche aussi leurs fichiers. Indépendante de M-G3 (branche séparée).

## Ce que fait la PR

Implémente seulement le modèle M-G4 « Sélection » (DECOUPAGE.md, fiche G4, maquette v3 `selection.html`), derrière `BLOG_GABARITS_V2`, éteint par défaut : interrupteur coupé, la page V1 ne change pas.

- **Options numérotées par compteur CSS** (aucun JS) : chaque `<h2>` du corps qui n'est ni FAQ, ni sources, ni méthode, ni conclusion, ni résumé, ni tableau… reçoit `data-option` ; numéro « 01 sur N » (terracotta, Inconsolata) avant le titre. Un titre déjà numéroté en texte (« 1. Zapier ») n'est **pas** doublé par la CSS. Sous deux options, rien n'est marqué. Le « sur » vient d'un message (`data-sur`).
- **Bandeau « Par où commencer ? »** (`aside.par-ou`, titre en `<p>`) inséré une fois à mi-liste, à partir de 4 options.
- **Tableau de synthèse** : le premier tableau du corps est déplacé après la liste (vrai `<table>`, région défilante focusable nommée par son titre, entrée en fin de sommaire, ancre unique). Son titre d'origine (« Tableau récapitulatif » + phrase d'introduction) part avec lui, son entrée de sommaire aussi. Aucune note, aucun classement chiffré.
- **Phrase de neutralité** (`.neutralite`, `data-aeo="neutrality"`), **non affichée si le corps parle d'Axion-IA** (le prompt d'origine peut placer Axion-IA dans la liste : la promesse serait fausse).
- **Encart du milieu** : bouton principal **Journée IA** (terracotta), lien « Diagnostic IA, 45 min ».
- Fichiers : `GabaritSelection.tsx`, `src/lib/blog/selection.ts` (fonctions pures), `selection.css`, `selection.{fr,en}.json`, tests.

⚠️ **Fichier partagé touché (additif, défauts inchangés)** : `GabaritAnalyse.tsx` reçoit trois props facultatives (`ouvertureExtra`, `enveloppeCorps`, `apresCorps`). **M-G3 modifie le même composant** (`ouvertureExtra`, `ctaSecondaire`) : conflit de fusion attendu et trivial ; fusionner l'une, rebaser l'autre par merge. `selection.ts` reprend `extrairePremierTableau` / `ancreLibre`, jumeaux de `remonterPremierTableau` / `ancreLibre` de M-G3 (`comparatif.ts`) : à dédupliquer dans un `lib/blog/tableaux.ts` commun après fusion des deux.

## Périmètre NON livré (volontaire)

Critères de sélection en grandes pastilles ; `CarteSelection` avec rubriques pour qui / points forts / limites ; signe « 10 » dynamique : ces contenus n'existent pas comme données (le corps est du HTML libre généré), les reconstruire reviendrait à inventer du contenu. **Suites à décider** : données structurées côté générateur ; signe du héros (« 10 options passées en revue » est fixe, inexact pour `best_for_x_in_y`, 3 à 5 options : message commun de S2, hors périmètre).

⚠️ **À vérifier sur un vrai article avant d'allumer l'interrupteur** : la fiche G4 dit « options = H2 » ; le prompt `top_x_in_y` annonce une liste de 10 éléments qui pourraient être des H3 ou une `<ol>` sous un H2 « Les 10… ». Dans ce cas, le compteur numéroterait les sections et non les options. Un article réel de chaque type est à relire en préproduction (PLAN §7).

## Tests

- `tests/unit/blog/selection-lib.spec.ts` et `gabarit-selection.spec.tsx` : 3 et 10 options ; compteur limité aux options (ni FAQ, ni sources, ni résumé, ni bilan) ; pas de doublon avec un numéro du titre ; bandeau une fois, entre la 5e et la 6e option sur 10, absent sous 4 ; tableau déplacé une seule fois avec son titre ; neutralité masquée si Axion-IA dans le corps ; Journée IA principale ; un seul h1, ni `<main>` ni en-tête de site ; mots interdits.
- Verts en local : `tests/unit/blog` (144 tests), `pnpm typecheck`, `i18n:check`, `anti-hex:check`, `contrast:check`, `content-gen:isolation-check`, `image-bank:isolation-check`, eslint (0 erreur), prettier.
- **Non fait** : axe 1280/320 px, interrupteur coupé sur la page entière (T1 et tests de S1), mesure de temps, relecture visuelle du compteur (navigateurs sans `content: … / ""` : une déclaration de repli sans alternative est posée avant).

## Mesure (First Load JS, route article)

Aucun JavaScript client ajouté (aucun `"use client"`, composants serveur, fonctions pures) : **JS +0** par construction. CSS du gabarit ≈ 1 Ko gz, chargée avec la route. Build de mesure non relancé ici (mémoire) : le seuil de 75 Ko gz n'est mesuré par aucune gate ; à relire sur un build avant mise en ligne.

Remarque : la doctrine des générateurs rend Axion-IA très présent dans les corps ; la phrase de neutralité ne s'affichera donc que rarement tant que ce n'est pas changé côté génération (masquage volontaire, sens sûr). Exclusions de titres : ancrées en tête de titre (≤ 5 mots), jamais sur un titre déjà numéroté ; un titre d'option commençant par « Sources de… » ou « Résumé de… » de ≤ 5 mots serait exclu à tort (rare, à relire sur de vrais articles).

VERDICT OPUS : À CORRIGER (tour 2 sur 3 ; exclusions trop larges ou trop étroites, titre d'option retiré avant un tableau : corrigés ; troisième tour en cours)
