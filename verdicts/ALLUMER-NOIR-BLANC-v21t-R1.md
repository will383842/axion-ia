VERDICT OK sha=f8018466 (R1) — 3 fichiers (plages-noir-blanc.ts : constante à true + 2 tests) ; 4 fichiers noir-blanc verts (33 tests) ; 146 fichiers composition/avocat : 7 échecs, les mêmes 7 sur master ; tsc 0 erreur ; 6 mutations sur 6 tuées (7e équivalente)

Relecteur R1 (exactitude, régressions, cas limites). Tête vérifiée : `f8018466a09ededbc3ffaee362fc8ed7eb674716` (inchangée). Aucune fiche fournie : diff jugé seul.

## Diff (origin/master...origin/video/ALLUMER-NOIR-BLANC-v21t)

- `src/briques/composition/plages-noir-blanc.ts` : `NOIR_BLANC_ACTIF` passe de `false` à `true` ; l'en-tête est mis à jour. Le retour arrière (`false`) est documenté.
- `tests/briques/composition/noir-blanc-allume-v21t.test.ts` (neuf, 122 lignes).
- `tests/briques/composition/plages-noir-blanc.test.ts` : le test (g) est réécrit. Il exige `true`, une plage `[[1.05, 2.1]]` par défaut et `[]` avec `actif: false`. Il n'est pas affaibli : le chemin éteint reste prouvé par l'option `actif`.
- Rien sous `.github/**`, `deploiement/**`, `outils/gardes/**` ni `scripts/echecs-connus.json`, aucun secret. Le diff est petit et colle au nom de la branche.

## Tests lancés

- `npx vitest run` sur les 4 fichiers noir-blanc (allume-v21t, plages, branchement-v21s, motion/noir-blanc) : 33 réussis, 1 ignoré, 0 échec.
- `npx vitest run` sur les 146 fichiers de test qui citent `parametresComposition`, `noirBlanc`, `montage-avocat`, `NOIR_BLANC` ou `composerScene` :
  - branche : 7 échecs, 1860 réussis ;
  - master, même liste (145 fichiers, le neuf en moins) : les **mêmes 7 échecs**, 1854 réussis.
  - Les 7 échecs sont déjà sur master : `composition.test` (garde d'imports), `e2e-verif1-ef-video-heygen`, `garde-ecran`, `r0-connexions` ×3, `schemas-claude-limites`. L'allumage n'introduit **aucune régression**.
- `npx tsc --noEmit -p .` : 0 erreur sur la branche, 0 sur master.
- La suite complète n'est pas allée au bout : plus de 10 min, arrêtée. D'où la liste ciblée ci-dessus.

## Mutations (sur les 2 fichiers touchés, puis remise en état ; arbre propre)

| Mutation                                               | Tuée par                                     |
| ------------------------------------------------------ | -------------------------------------------- |
| M1 `NOIR_BLANC_ACTIF = false`                          | v21t (a), (b), (e) ; plages (g)              |
| M2 plans `double` non interdits (`parametres.ts:454`)  | v21t (b)                                     |
| M3 exclusion de l'argent retirée                       | v21t (c) ; plages (b)                        |
| M4 plafond `.slice(0, NB_PLAGES_MAX)` retiré           | v21t (e) ; plages (d)                        |
| M5 garde de l'étalonnage retirée (`parametres.ts:455`) | v21t (d)                                     |
| M6 garde du bord de début retirée                      | v21t (e) ; plages (e)                        |
| M7 `\|\| p.miseEnPage` retiré de `interditsNb`         | survit, mais **équivalente** (voir plus bas) |

Pourquoi M7 est équivalente : `poserMisesEnPage` (`habillage-facecam/mise-en-page.ts:138`) et `poserEcransPartages` (`ecran-partage.ts:96`) ne posent leur habillage que sur des plans de type `double`, et le type est conservé. Ces plans sont donc déjà interdits par `p.type === "double"`. Pareil pour une illustration sans fichier : elle devient `double` (`parametres.ts:262`), ce que v21t (b) prouve.

## Promesse → test nommé

- Allumé, plage en secondes exactes : v21t (a).
- Jamais sur Williams (plan double, illustration remplacée par le double) : v21t (b).
- Argent exclu : v21t (c).
- Rien sans mots, ou si l'étalonnage est coupé : v21t (d).
- 2 plages au plus, bords gardés : v21t (e).
- Jamais la v4 : v21t (f). C'est une recherche de texte (« plages-noir-blanc »). Je l'ai complétée à la main : aucun fichier de `motion-v4` ni de `montage-facecam-animee` ne cite `noirBlanc`, et aucun n'appelle `parametresComposition`.

## Remarques non bloquantes (commentaires restés « éteint »)

- `src/briques/composition/parametres.ts:453` : « (C10-05, éteint) » est périmé.
- `tests/briques/composition/noir-blanc-branchement-v21s.test.ts:3` et `:18` : « ÉTEINT (`NOIR_BLANC_ACTIF = false`) » et « La constante de la pièce a reste fausse en vrai » sont faux depuis cette branche. Le test reste juste, grâce au double par getter.
- `tests/briques/composition/plages-noir-blanc.test.ts:86` : « derrière NOIR_BLANC_ACTIF = false » est périmé.
- v21t (f) ne prouve que l'absence d'import, déjà exigée par plages (h). Pour la rendre plus forte, on pourrait aussi y refuser `noirBlanc` et `parametresComposition`.
