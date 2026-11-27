VERDICT A CORRIGER sha=fd974f22 (R1) : tests/image-video/variete/apparition.test.ts:90 (+ l. 4-5, 60) — le nom du test et l'en-tête promettent encore « le HTML d'avant le lot / empreinte figée avant toute modification », ce qui est faux depuis que l'empreinte est recalée sur master au 27/11 : renommer (ex. « sans variété : le HTML de la toile est celui de master au 27/11 (ff1dbf99…) ») et corriger l'en-tête ; l. 67 renvoie à journal/FIX-ROUGES-APPARITION-v21t.md, absent du dépôt (ni sur la branche, ni sur master, ni dans l'historique) : verser ce tableau dans le dépôt ou retirer le renvoi.

Relecteur R1 (exactitude, régressions, cas limites). Tête vérifiée : `fd974f22cd370b857a38a1265f147d54a26e162f` (pas de « TÊTE CHANGÉE »). Aucune fiche fournie (dépôt des plans privé) : jugement sur le diff seul.

## Périmètre du diff

`git diff --stat origin/master...origin/video/FIX-ROUGES-APPARITION-v21t` : **1 fichier, +8 −1**,
`tests/image-video/variete/apparition.test.ts` seulement. Rien dans `.github/**`, `deploiement/**`,
`outils/gardes/**`, `scripts/echecs-connus.json`, aucun secret. Cohérent avec le nom de branche : il
s'agit de faire repasser un rouge du test d'apparition. Seul changement de code : la constante
`EMPREINTE_TOILE_REFERENCE` passe de `09542bc8…` à `ff1dbf99…`, avec un commentaire « MAJ 25/11 » et « MAJ 27/11 ».

Note : la base de fusion est `85d71124` ; master a avancé d'un commit (`aa83d0d1`, Pinterest PR 4) depuis la
dernière fusion. Sans effet ici (voir plus bas : la nouvelle valeur passe aussi sur master seul).

## Ce qui est prouvé (lancé par moi)

Dépendances : `pnpm install --frozen-lockfile` (racine) + `npm ci` (`studio-rendu/`), les deux à 0.

| Contrôle                                                                              | Résultat                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx vitest run tests/image-video/variete/apparition.test.ts` sur `fd974f22`          | **12/12 verts**                                                                                                                                                                              |
| Même fichier sur `origin/master` (`aa83d0d1`)                                         | **2 rouges** : reçu `ff1dbf99…`, attendu `09542bc8…` — le rouge à corriger existe bien                                                                                                       |
| Fichier de test de la branche posé sur `origin/master`                                | **12/12 verts** — l'affirmation « master seul donne la même, ff1dbf99… » est vraie                                                                                                           |
| Mutation 1 : `data-m="1"` ajouté au `<div>` racine de `Toile.tsx` (l. 79)             | **2 rouges** (sans variété + APP-A/MAT-A) — l'empreinte garde bien le HTML de `Toile`                                                                                                        |
| Mutation 2 : `ContexteVariete` rend un `<i />` en plus quand une variété est présente | **1 rouge** (« recette de référence (APP-A, MAT-A)… ») — l'invariant « la référence ne change rien » est bien gardé                                                                          |
| `NODE_OPTIONS=--max-old-space-size=6144 npx tsc --noEmit -p .` branche vs master      | 43 `error TS` des deux côtés, **mêmes erreurs** (diff = ordre des unions seulement), aucune dans `apparition.test.ts` : **aucune erreur neuve** (sans la mémoire élargie, tsc avorte en OOM) |

Le correctif fait donc ce qu'il dit : le test repasse et il discrimine toujours.

## Ce qui doit être corrigé

1. **Le nom du test ne dit plus sa promesse** (critère de la consigne). `apparition.test.ts:90` :
   `"sans variété : le HTML de la toile est identique à celui d'avant le lot"`, et l'en-tête l. 4-5
   (« rendent EXACTEMENT le HTML d'avant le lot (empreinte figée avant toute modification) ») + l. 60
   (« figée AVANT le lot ») affirment une chose que le diff vient de rendre fausse : la valeur est désormais
   **la sortie de master au 27/11**, pas celle d'avant le lot APP-MAT. Le test garde aujourd'hui « rien ne change
   à partir de master du 27/11 » — c'est utile, mais il faut l'écrire. Renommer le test et corriger les
   trois passages, sinon le prochain lecteur croit qu'une garde « pré-lot » existe.
2. **Renvoi pendant** : l. 67 cite « tableau : journal/FIX-ROUGES-APPARITION-v21t.md ». Ce fichier n'existe
   ni sur la branche, ni sur master, ni nulle part dans l'historique (`git log --all -- 'journal/FIX-ROUGES*'`
   vide). La justification des six « changements voulus depuis le 23/10 » (#30, #42, #120, #130, #241, #280)
   repose donc sur un document invisible pour un relecteur du dépôt public. Verser le tableau dans le dépôt
   (ou résumer dans le commentaire ce qu'il prouve), ou retirer le renvoi.

## Point non prouvé (à signaler, non bloquant à lui seul)

Le commentaire affirme « même sur 55d99567, la version du 23/10, on reçoit 2332d320… ». Je n'ai pas reproduit
cette valeur : sur `55d99567` avec les dépendances de la branche (les lockfiles diffèrent : `pnpm-lock.yaml`
−37 lignes, `studio-rendu/package-lock.json` −69), j'obtiens `878678b2…`. Ce n'est pas `09542bc8…` non plus,
ce qui va dans le sens de « l'ancienne valeur n'était pas reproductible », mais la valeur précise citée ne l'est
pas dans mes conditions (dépendances différentes de celles du 23/10). Préciser dans le commentaire avec quelles
dépendances ce chiffre a été obtenu, ou ne garder que le constat vérifiable (« 09542bc8… n'est reproduit par
aucun `npm ci` actuel »).

## Remarque de forme

Le message du dernier commit, « correction (robot crédits API) », ne décrit pas le changement (recalage de
l'empreinte après les fusions de master du 25-27/11). Non bloquant.
