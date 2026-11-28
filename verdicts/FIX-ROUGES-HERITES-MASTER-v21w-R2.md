VERDICT OK sha=7d11e170 (R2) — 1 fichier (tests/tableau/prete-avec-remarques-reglage-v20j.test.ts, +1/−1) ; vitest du fichier 5/5 vert sur la branche, 4/5 sur master (rouge hérité (c) reproduit puis corrigé) ; tsc 154 erreurs avant = 154 après, identiques, aucune neuve ; 7 mutations sur 7 rougissent (3 faux seconds lecteurs, === true → !== false, défaut false → true, catch → true, retrait du lookahead).

# Relecture R2 indépendante — studio-axion-ia-public, branche video/FIX-ROUGES-HERITES-MASTER-v21w

## Tête

`git rev-parse HEAD` = `7d11e1702c60f1d1f9bad83e8b72861718a9e79d` : la tête attendue (7d11e170) est bien celle-là. Un seul commit
au-dessus de `origin/master` (`05f8a270`).

## Diff

`git diff --stat origin/master...origin/video/FIX-ROUGES-HERITES-MASTER-v21w` :

```
 tests/tableau/prete-avec-remarques-reglage-v20j.test.ts | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

Changement unique, dans le test (c) « un seul lecteur de la clé dans src/** » :
`/PARAM_PRETE_AVEC_REMARQUES|…/` devient `/PARAM_PRETE_AVEC_REMARQUES(?![A-Z_])|…/`.

- **Cohérent avec le nom de la branche** : sur master, le test (c) est rouge parce que
  `src/services/prete-avec-remarques-iv.ts` (constante `PARAM_PRETE_AVEC_REMARQUES_IV`, clé
  `imageVideo.preteAvecRemarques`, autre réglage) est compté à tort comme lecteur de `tableau.preteAvecRemarques`.
  Le lookahead exclut le suffixe `_IV` sans affaiblir la promesse : même nom de test, mêmes deux `expect`.
- **Petit** : une ligne.
- **Chemins interdits** : aucun fichier sous `.github/**`, `deploiement/**`, `outils/gardes/**`,
  `scripts/echecs-connus.json` ; aucun secret.
- **Pas de code de production modifié** : aucun comportement ajouté, donc aucun test de comportement neuf exigé ;
  le nom du test (c) dit toujours la promesse qu'il vérifie.

## Tests lancés

Dépendances : `pnpm install --frozen-lockfile` (magasin pnpm privé dans le dossier temporaire, `--ignore-scripts`).

| Commande                                                                           | Résultat                                                                                                                                                          |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx vitest run tests/tableau/prete-avec-remarques-reglage-v20j.test.ts` (branche) | 5 passed (5)                                                                                                                                                      |
| même commande, fichier de test remis à `origin/master`                             | 1 failed / 4 passed — (c) : `["src/services/prete-avec-remarques-iv.ts", "src/services/tableau-remarques.ts"]` au lieu de `["src/services/tableau-remarques.ts"]` |
| `npx tsc --noEmit -p .` (branche ; `--max-old-space-size=8192`, sinon OOM)         | 154 erreurs                                                                                                                                                       |
| même commande, fichier de test remis à `origin/master`                             | 154 erreurs, liste **identique** (`diff` vide)                                                                                                                    |

Les 154 erreurs préexistantes viennent de l'environnement de relecture (`remotion` absent, types `RouteContext` /
`LayoutProps` générés par `next typegen` non produits, etc.) ; aucune ne touche le fichier modifié.

## Mutations (chacune appliquée seule, puis code remis ; `git status` propre à la fin, témoin 5/5 vert)

| #   | Mutation                                                                                                                             | Résultat            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| M1  | Ajout de `src/services/zz-mutant.ts` : `lireParametre<unknown>(PARAM_PRETE_AVEC_REMARQUES, false)` (second lecteur via la constante) | **rouge** (c)       |
| M2  | Second lecteur via la chaîne littérale `"tableau.preteAvecRemarques"`                                                                | **rouge** (c)       |
| M3  | Second lecteur via import renommé `PARAM_PRETE_AVEC_REMARQUES as K`                                                                  | **rouge** (c)       |
| M4  | `src/services/tableau-remarques.ts:10` : `=== true` → `!== false`                                                                    | **rouge** (3 tests) |
| M5  | `src/services/tableau-remarques.ts:10` : défaut `false` → `true`                                                                     | **rouge** (2 tests) |
| M6  | `src/services/tableau-remarques.ts:12` : `catch` rend `true`                                                                         | **rouge** (a bis)   |
| M7  | Retrait du lookahead `(?![A-Z_])` (retour à l'état master)                                                                           | **rouge** (c)       |

M1 à M3 prouvent que le lookahead n'a pas aveuglé la garde : un vrai second lecteur de la clé est toujours attrapé.

## Remarque (non bloquante)

Une mutation du test lui-même, `(?![A-Z_])` → `(?!.)`, reste verte : le lecteur légitime est aussi attrapé par
l'alternative `tableau\.preteAvecRemarques`, donc la branche « constante » du motif ne porte pas seule le cas
nominal. Ce n'est pas un trou du code relu (M1 et M3 montrent que la branche « constante » attrape bien un second
lecteur qui n'écrit pas la chaîne) ; c'est une redondance du motif, déjà présente sur master.

## Note environnement

`pnpm-lock.yaml` d'axion-ia : identique entre `10ac89bc0` (copie de travail installée) et `origin/main`
(`7d5b92d62`), aucune réinstallation nécessaire.
