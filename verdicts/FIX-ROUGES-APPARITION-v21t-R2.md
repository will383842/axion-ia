VERDICT A CORRIGER sha=fd974f22 (R2) : tests/image-video/variete/apparition.test.ts:67, le commentaire renvoie à « journal/FIX-ROUGES-APPARITION-v21t.md », qui n'existe ni dans la branche, ni dans master, ni dans aucun commit du dépôt : versionner ce tableau ou retirer le renvoi (la liste des commits est déjà dans le commentaire). Secondaire : deux mutations survivent (M5, M6 ci-dessous), des trous antérieurs à la branche.

# Relecture R2 (indépendante) — video/FIX-ROUGES-APPARITION-v21t

- Tête vérifiée : `fd974f22cd370b857a38a1265f147d54a26e162f` (pas de « TÊTE CHANGÉE »).
- Aucune fiche fournie : diff jugé seul.

## Diff

`git diff --stat origin/master...origin/video/FIX-ROUGES-APPARITION-v21t` : 1 fichier, `tests/image-video/variete/apparition.test.ts`, +8 / −1.

- La constante `EMPREINTE_TOILE_REFERENCE` passe de `09542bc8…` à `ff1dbf99264cf312a1d6791daac5bad74dc120ef61c398492e30726c78fe719f`, avec un commentaire qui explique pourquoi.
- Le diff est petit et cohérent avec le nom de la branche.
- Aucun chemin interdit n'est touché : `.github/**`, `deploiement/**`, `outils/gardes/**`, `scripts/echecs-connus.json`. Aucun secret.
- Aucun code de production n'est modifié : seule l'empreinte attendue change. Les deux tests qui la lisent gardent des noms qui disent leur promesse (« sans variété : le HTML de la toile est identique… », « recette de référence (APP-A, MAT-A)… même HTML que sans variété »).

## Preuves

- Dépendances installées : `pnpm install --frozen-lockfile` (magasin local), plus `npm ci` dans `studio-rendu/`.
- Sur la branche, `npx vitest run tests/image-video/variete/apparition.test.ts` → **12/12 verts**.
- Sur `origin/master` (commit `aa83d0d1`), avec seulement le fichier de test de la branche → **12/12 verts**. L'affirmation « master seul donne la même » est donc vérifiée : l'empreinte est reproductible.
- `npx tsc --noEmit -p .` donne **43 erreurs sur la branche et 43 sur master**. Le seul écart est l'ordre d'affichage des unions dans 2 messages. **Aucune erreur neuve.** Ces erreurs existaient déjà : `remotion` manque dans `docs/`, et `RouteContext`/`LayoutProps` viennent de typegen.

## Mutations (toutes remises, `git status` propre, rien poussé)

| #   | Mutation                                                                                        | Résultat                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| M1  | `axes/apparition.ts` : `code === "APP-A"` → `!==` (garde inversée)                              | 6 rouges ✅                                                                                              |
| M2  | `axes/apparition.ts` : `NOEUDS_MIN = 3` → `2` (borne)                                           | 1 rouge (« possibles ») ✅                                                                               |
| M3  | `Toile.tsx:73` : `app.code !== "APP-C"` → `===`                                                 | 2 rouges (APP-B, APP-D) ✅                                                                               |
| M4  | `Toile.tsx:136` : `o > 0` → `o >= 0`                                                            | survit, **hors périmètre** (`SchemaMuet` n'est pas rendu par `Toile`)                                    |
| M5  | `Toile.tsx:39` : `precedent = d[k-1][1] + surgir` → `- surgir` (heure d'apparition de la place) | **survit : trou**                                                                                        |
| M6  | `Toile.tsx:70` : `Math.min(filetDe…)` → `Math.max` (opacité d'étiquette)                        | **survit : trou ou mutant équivalent sur ces 6 cartes**                                                  |
| M7  | `Toile.tsx:97` : `t0 - avanceNoeud` → `t0 + avanceNoeud`                                        | 1 rouge (APP-D) ✅                                                                                       |
| M8  | `Toile.tsx:96` : `vu ? ETAT_VU` → `!vu ? ETAT_VU` (chemin de référence)                         | 5 rouges, **dont les 2 tests d'empreinte** ✅ : la nouvelle empreinte est bien vivante, pas tautologique |

M5 et M6 existaient avant cette branche : le diff ne les crée pas.

- M5 : les tests APP-B et APP-D ne vérifient que la présence de `data-place`, jamais son opacité dans le temps.
- M6 : l'empreinte ne distingue pas `min` de `max`, sans doute parce que les deux filets valent toujours la même chose sur les fixtures.

À traiter dans ce fichier de test ou dans un lot dédié.

## Ce qu'il faut corriger pour passer OK

1. Ligne 67 : retirer « (tableau : journal/FIX-ROUGES-APPARITION-v21t.md) » ou versionner ce journal. Aujourd'hui, la justification annoncée est invérifiable.
2. Facultatif, mais demandé par la règle des mutations : ajouter une assertion sur l'opacité de la place (APP-B/APP-D) à deux instants, pour tuer M5.
