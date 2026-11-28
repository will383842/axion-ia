VERDICT A CORRIGER sha=79f9fce2 (R2) : studio-rendu/compositions/tableau/reference/PageReference.tsx:33 et PageReference3.tsx:46 — le fondu de fin en boucle n'est testé qu'en TEXTE ; couper le fondu en boucle (`r.derniere && !r.finEnBoucle ? …`) laisse les 5 tests verts : ajouter un test de comportement (opacité/couleur du voile à finVideoMs, finEnBoucle vrai vs absent) qui rougit sur cette mutation.

## Contexte

- Dépôt : `will383842/studio-axion-ia-public`, branche `video/BOUCLE-TABLEAU-b-v21u`, tête vérifiée `79f9fce2ee09f9af5967bb1e5cabe508be4a9873` (pas de « TÊTE CHANGÉE »).
- Relecteur R2, indépendant, sans fiche (dépôt des plans privé). Lecture seule sur le Studio : aucune modification poussée, toutes les mutations ont été remises (worktree jetable, `git status` propre avant suppression).
- Dépendances : `pnpm install --frozen-lockfile --store-dir <tmp> --ignore-scripts` (magasin global en lecture seule ; `npm ci` impossible, pas de `package-lock.json`).

## Diff (7 fichiers, +82 / −7) — périmètre conforme

- `src/briques/tableau-scene/proprietes.ts` (+3) : champ d'entrée `finEnBoucle?: true` ; posé sur la DERNIÈRE scène seulement, et seulement si `=== true`.
- `src/briques/tableau-scene/reference/types.ts` (+2) : `ProprietesReference.finEnBoucle?: true`.
- `studio-rendu/.../reference/PageReference.tsx`, `PageReference3.tsx` (1 ligne chacun) : couleur du voile de fin = fond de la charte si `finEnBoucle`, sinon `#000000`.
- `studio-rendu/.../trois-styles/PageTableau.tsx` (+5/−2) : en boucle, redessine `sc.sup.fond` (HTMLCanvasElement) à l'opacité `f` au lieu du noir.
- `tests/segments-rendu/version-compositions.json` : 3 empreintes mises à jour (test `version-compositions.test.ts` vert).
- `tests/tableau/boucle-tableau-rendu-v21u.test.ts` (nouveau, 5 tests).
- Petit, cohérent avec le nom de branche. Aucun fichier sous `.github/**`, `deploiement/**`, `outils/gardes/**`, `scripts/echecs-connus.json` ; aucun secret. Porte éteinte par défaut, aucun appelant (test (e)).

## Tests lancés

- `npx vitest run tests/tableau/boucle-tableau-rendu-v21u.test.ts tests/segments-rendu/version-compositions.test.ts` : 2 fichiers, 13/13 verts.
- `npx vitest run tests/segments-rendu tests/tableau` : 239 fichiers verts (2 ignorés), 3777 tests verts, 45 ignorés, 0 échec.
- `npx vitest run tests/charte tests/palette-v7-08a.test.ts tests/tableau/{mise-en-page,compositions,controles,gabarit-finitions}` : 4 échecs `garde-charte` + 1 suite `jetons-charte` (paquet `remotion` absent de l'installation `--ignore-scripts`) — **les mêmes 4 échecs `garde-charte` existent sur `origin/master`** (vérifié sur un worktree de master), aucun ne porte sur un fichier du diff. Un `dessins-finis (c)` en dépassement de 5 s sous charge (tsc en parallèle) est vert dans la passe complète ci-dessus.
- `npx tsc --noEmit -p .` (heap 12 Go) : 154 erreurs sur la branche, 154 sur `origin/master`, liste **identique** (diff vide, numéros de ligne retirés) → aucune erreur neuve ; aucune erreur dans un fichier du diff.

## Mutations (8 essayées, toutes remises)

| #  | Mutation | Résultat |
| -- | -------- | -------- |
| M1 | `proprietes.ts` : `entree.finEnBoucle === true &&` → `entree.finEnBoucle &&` | ROUGE (b) ✅ |
| M2 | `proprietes.ts` : garde « dernière scène » supprimée | ROUGE (b) ✅ |
| M3 | `PageTableau.tsx` : `!r.finEnBoucle` → `r.finEnBoucle` (condition inversée) | ROUGE (c) ✅ |
| M7 | `PageTableau.tsx` : `if (r.finEnBoucle) return;` avant le fondu | ROUGE (c) ✅ |
| **M4** | `PageReference.tsx:33` : `const fondu = r.derniere && !r.finEnBoucle ? borne(…)` (fondu supprimé en boucle) | **VERT — TROU** ❌ |
| **M5** | `PageReference3.tsx:46` : même mutation | **VERT — TROU** ❌ |
| M6 | `PageTableau.tsx` : `g.globalAlpha = f * 0;` réécrit aussitôt | vert — mutant équivalent, écarté |
| M8 | `proprietes.ts` : `{ finEnBoucle: undefined }` sur les autres scènes | vert — mutant équivalent (JSON identique), écarté |

M4/M5 coupent la promesse même du lot (« la fin s'efface vers la page vide ») pour les styles reference/2 et reference/3, et aucun test ne le voit : les tests (c)/(d) vérifient la présence d'une CHAÎNE (`backgroundColor: r.finEnBoucle ? … : "#000000"`) et le NOMBRE d'occurrences de `FIN_REFERENCE.fonduImageMs` (inchangé par la mutation), pas le comportement.

## À corriger

1. **(bloquant)** `tests/tableau/boucle-tableau-rendu-v21u.test.ts` : ajouter un test de comportement du voile de fin pour reference/2 et reference/3 (rendre `PageReference`/`PageReference3` à t = `finVideoMs`, ou extraire en fonction pure le calcul `{ couleur, opacite }` du voile et la tester) : à la fin, opacité 1 et couleur = fond de la charte avec `finEnBoucle`, `#000000` sans ; il doit rougir sur M4 et M5. Idéalement, faire de même pour le canevas de `PageTableau` (aujourd'hui seulement couvert par le texte).
2. **(à reprendre)** test (a), lignes 21-27 : compare `proprietesScenes(entree())` à `proprietesScenes({ ...entree() })` — deux appels identiques, l'égalité est tautologique ; seule l'assertion `not.toContain("finEnBoucle")` porte. Comparer plutôt à une sortie de référence (ou à l'empreinte de master).
3. **(fragile)** test (c), ligne 44 : `pt.split("\n")[875]` épingle un numéro de ligne de `PageTableau.tsx` ; la moindre ligne ajoutée au-dessus le casse sans rapport avec la promesse. Rechercher le motif au lieu d'un index.
