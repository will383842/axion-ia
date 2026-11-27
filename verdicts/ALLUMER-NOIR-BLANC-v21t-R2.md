VERDICT A CORRIGER sha=f8018466 (R2) : src/briques/composition/parametres.ts:454 — la garde « || p.miseEnPage » (jamais de noir et blanc sur un plan mis en page où Williams est visible) n'est couverte par AUCUN test : la retirer laisse tout vert ; ajouter dans tests/briques/composition/noir-blanc-allume-v21t.test.ts:79 (cas b) un plan illustration avec `miseEnPage` couvrant la plage ⇒ aucune clé `noirBlanc`.

Relecteur R2 indépendant, studio-axion-ia-public, branche video/ALLUMER-NOIR-BLANC-v21t, tête vérifiée : f8018466a09ededbc3ffaee362fc8ed7eb674716 (inchangée).

## 1. Diff (jugé seul, sans fiche)

`git diff --stat origin/master...origin/video/ALLUMER-NOIR-BLANC-v21t` : 3 fichiers, +130 / −7.

- `src/briques/composition/plages-noir-blanc.ts` : `NOIR_BLANC_ACTIF` passe de `false` à `true`, en-tête mis à jour. Petit et conforme au nom de la branche.
- `tests/briques/composition/noir-blanc-allume-v21t.test.ts` (neuf) : cas (a) à (f).
- `tests/briques/composition/plages-noir-blanc.test.ts` : le cas (g) attend désormais « allumé » et vérifie que `actif: false` éteint encore.
- Aucun fichier sous `.github/**`, `deploiement/**`, `outils/gardes/**` ni `scripts/echecs-connus.json`. Aucun secret dans le diff.

## 2. Tests et types

- `npx vitest run tests/briques/composition/noir-blanc-allume-v21t.test.ts tests/briques/composition/plages-noir-blanc.test.ts` : 2 fichiers, 14 tests verts.
- `npx vitest run tests/briques/motion/noir-blanc.test.ts tests/briques/composition/` : 15 fichiers, 138 verts, 5 ignorés.
- `npx tsc --noEmit -p .` (avec `--max-old-space-size=12000`, sinon OOM) : 154 erreurs sur la branche ET 154 sur `origin/master`, aux mêmes fichier:ligne:code. Aucune erreur neuve. Les seules différences de texte sont l'ordre des unions dans deux messages déjà présents.
- Dépendances : `pnpm install --frozen-lockfile` (magasin pnpm local, lockfile inchangé).

## 3. Mutations (9, toutes remises ; `git status` du Studio vide à la fin)

Lancées sur les 4 fichiers de test du noir et blanc :

| # | Mutation | Résultat |
|---|----------|----------|
| M1 | `NOIR_BLANC_ACTIF = false` | 4 rouges ✅ |
| M2 | parametres.ts : retirer `c.briques.etalonnage !== false &&` | 2 rouges ✅ |
| M3 | parametres.ts : retirer `p.type === "double" \|\|` (plan visage) | 2 rouges ✅ |
| **M4** | **parametres.ts:454 : retirer `\|\| p.miseEnPage`** | **0 rouge ❌ TROU** |
| M5 | `NB_PLAGES_MAX = 3` | 2 rouges ✅ |
| M6 | `NB_GARDE_BORDS_SEC = 0` | 2 rouges ✅ |
| M7 | retirer l'exclusion de l'argent | 2 rouges ✅ |
| M8 | chevauchement des plans interdits `fin > a` → `fin > b` | 3 rouges ✅ |
| M9 | ignorer `opts.actif` | 1 rouge ✅ |

M4 : sous `tests/`, seuls 4 fichiers citent `noirBlanc` ou `plages-noir-blanc`, et aucun ne construit un plan avec `miseEnPage`. Aucun autre test du dépôt ne peut donc attraper cette mutation.

Pourquoi c'est bloquant maintenant : avant cette branche, la garde était morte (le noir et blanc était éteint). En l'allumant, la branche rend vivante la promesse « jamais sur un plan où Williams est visible (visage, mise en page) » (commentaire de parametres.ts:453). La moitié « mise en page » n'est pas prouvée. Le titre du cas (b), « jamais sur Williams », annonce plus que ce qu'il vérifie : il ne couvre que le plan « double » et l'illustration remplacée par le double.

## 4. À corriger

1. **Obligatoire** : dans `tests/briques/composition/noir-blanc-allume-v21t.test.ts`, cas (b) (l. 79), ajouter un plan `illu(1, 0, 9, { miseEnPage: … })` qui couvre la plage [1,05 ; 2,1] et attendre `"noirBlanc" in couleurs === false`. Vérifier qu'il rougit si on retire `|| p.miseEnPage` de parametres.ts:454.
2. Détail : le commentaire de `src/briques/composition/parametres.ts:453` dit encore « (C10-05, éteint) ». Le passer à « allumé » pour qu'il soit cohérent avec l'en-tête du fichier modifié.

Le reste est prouvé : constante, étalonnage coupé, plan visage, argent, bornes, 2 plages au plus, retour arrière par `actif: false`, et absence d'appel depuis la v4 (cas f).
