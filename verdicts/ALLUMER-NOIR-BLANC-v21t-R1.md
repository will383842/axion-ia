VERDICT OK sha=0889bc20 (R1) — 3 fichiers (plages-noir-blanc.ts : NOIR_BLANC_ACTIF à true + 2 tests) ; 4 fichiers noir-blanc verts (33 tests, 1 ignoré sans ffmpeg) ; 216 fichiers liés à la composition : 9 échecs, les 9 mêmes sur master ; tsc 154 erreurs, mêmes lignes que master (0 neuve) ; 8 mutations, 7 tuées, la 8e (regex argent) équivalente

Relecteur R1 (exactitude, régressions, cas limites). Tête vérifiée : `0889bc201e93daefb93cf13437a2f0919c32d851`, pas de « TÊTE CHANGÉE ». Aucune fiche fournie, le diff est jugé seul.

Ce verdict remplace le R1 précédent, rendu sur `f8018466` (commit `01b055e6a` de cette branche). `0889bc20` n'ajoute qu'une fusion de `origin/master`. Le diff net `origin/master...HEAD` est **identique ligne pour ligne** entre les deux têtes, et `git diff f8018466 0889bc20 -- src/briques/composition tests/briques/composition` est vide.

## Diff (origin/master...origin/video/ALLUMER-NOIR-BLANC-v21t), 3 fichiers, +130 / −7

- `src/briques/composition/plages-noir-blanc.ts` : `NOIR_BLANC_ACTIF` passe de `false` à `true`. L'en-tête est mis à jour et le retour arrière (`false`) est documenté. L'affirmation « importeur unique : parametres.ts » est vraie : `grep` sur `src`, `studio-rendu` et `tests` ne trouve que `parametres.ts:39` côté code.
- `tests/briques/composition/noir-blanc-allume-v21t.test.ts` (nouveau, 122 lignes, tests (a) à (f)).
- `tests/briques/composition/plages-noir-blanc.test.ts` : le test (g) de master, qui figeait l'état éteint, est réécrit. Il exige maintenant `true`, la plage `[[1.05, 2.1]]` par défaut et `[]` avec `actif: false`. Il n'est pas affaibli : le chemin éteint reste prouvé par l'option.
- `noir-blanc-branchement-v21s.test.ts` (master) moque la constante par un getter (`etat.actif`). Ses cas « éteint = identique » restent donc valides et passent sans modification.
- Aucun fichier sous `.github/**`, `deploiement/**`, `outils/gardes/**` ni `scripts/echecs-connus.json`, aucun secret. Le diff est petit et correspond au nom de la branche.

## Chaque promesse a un test nommé

| Promesse                                                   | Test                                    |
| ---------------------------------------------------------- | --------------------------------------- |
| allumé, plage en secondes exactes                          | v21t (a) ; plages (g)                   |
| jamais sur Williams (plan double, illustration remplacée)  | v21t (b)                                |
| argent exclu                                               | v21t (c) ; plages (b)                   |
| sans mots ou étalonnage coupé : aucune clé                 | v21t (d)                                |
| 2 plages au plus, bords gardés                             | v21t (e) ; plages (d), (e)              |
| jamais la v4 (motion-v4, montage-facecam-animee)           | v21t (f)                                |
| retour arrière possible (`actif: false` donne `[]`)        | plages (g)                              |

Le test (f) n'est pas vide : les deux dossiers existent et totalisent 127 fichiers `.ts/.tsx`. Aucun des deux n'appelle non plus `parametresComposition` ni `briques/composition` : la v4 n'est pas exposée par un chemin indirect.

## Tests lancés

- Dépendances : `pnpm install --frozen-lockfile` (avec `--store-dir` local, le magasin global étant en lecture seule).
- `npx vitest run` sur les 4 fichiers noir-blanc : 33 réussis, 1 ignoré (`skipIf(!ffmpeg)`, pas de ffmpeg sur la machine), 0 échec.
- `npx vitest run` sur les 216 fichiers de test qui citent `briques/composition`, `parametresComposition`, `image-ffmpeg`, `composition/ffmpeg`, `plages-noir-blanc`, `construireScene` ou `montage-avocat` : 8 fichiers en échec, 9 tests en échec, 2431 réussis.
- Les mêmes 8 fichiers lancés sur `origin/master` donnent les **9 mêmes échecs**, au test près : `plan-sur-texte-pur`, `e2e-verif1-ef-video-heygen`, `e7-series`, `fin-propre-reel` (ffmpeg absent), `garde-ecran`, `r0-connexions` ×3, `schemas-claude-limites`, `usine/inventaire/formats`. Ils sont déjà présents et indépendants du noir et blanc. **Aucune régression.**
- `npx tsc --noEmit -p .` (heap à 10 Go ; il manque de mémoire à 4 Go) : 154 erreurs sur la branche, 154 sur master. Le `diff` des deux listes triées est vide, et aucune erreur ne cite noir-blanc ou plages.
- La suite complète ne s'est pas terminée : arrêtée au bout de 10 min, d'où la liste ciblée ci-dessus.

## Mutations (sur la branche, remise en état après chaque mutation ; arbre propre, tête `0889bc20`)

| Mutation                                                              | Tuée par                         |
| --------------------------------------------------------------------- | -------------------------------- |
| M1 `NOIR_BLANC_ACTIF = false`                                         | v21t (a), (b), (e) ; plages (g)  |
| M2 garde `c.briques.etalonnage !== false` retirée (`parametres.ts:455`) | v21t (d)                         |
| M3 `plansInterdits: []` (`parametres.ts:455`)                         | v21t (b)                         |
| M4 `NB_PLAGES_MAX = 3`                                                | v21t (e) ; plages (d)            |
| M5 `NB_GARDE_BORDS_SEC = 0`                                           | v21t (e) ; plages (e)            |
| M6 regex `MOTS_ARGENT` neutralisée                                    | **survit, mutation équivalente** |
| M6b appel `argent(fait)` retiré de la boucle                          | v21t (c) ; plages (b)            |
| M7 `p.type === "double"` retiré des interdits (`parametres.ts:454`)   | v21t (b)                         |

M6 est équivalente sur les cas testés : « € » est déjà intercepté par `familleUnite(unite) === "argent"`. Le regex ne sert qu'à un passage sans unité monétaire mais avec « prix » ou « tarif » dans le texte. Ce cas n'est testé ni sur master ni sur la branche. C'est un trou de couverture déjà présent, hors du périmètre de ce diff, donc non bloquant.

## Remarques non bloquantes (hors diff)

- `src/briques/composition/parametres.ts:453` : le commentaire dit encore « NOIR-BLANC-b (C10-05, éteint) ». Il est devenu faux avec l'allumage ; une prochaine retouche pourrait écrire « allumé (ALLUMER-NOIR-BLANC-v21t) ».
- `tests/briques/composition/noir-blanc-branchement-v21s.test.ts:3` : l'en-tête décrit l'état « ÉTEINT ». Les tests restent justes (constante moquée), mais le texte est daté.
- Ajouter un cas « de 30 à 10, prix » sans unité fermerait la mutation M6.

Le code du Studio n'a pas été modifié.
