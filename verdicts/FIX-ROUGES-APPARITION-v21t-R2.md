VERDICT OK sha=62e80d7f (R2) — effet net sur master = 1 fichier (tests/image-video/variete/apparition.test.ts) ; vitest apparition 12/12 réels (studio-rendu installé) sur la branche ET sur master 054d9551 + ce fichier, encart-3 16/16 ; tsc 0 erreur (master 0) ; 6 mutations, 4 rougissent, 2 ne rougissent pas, sans trou de comportement (détail plus bas)

# Relecture R2 indépendante — video/FIX-ROUGES-APPARITION-v21t (studio-axion-ia-public)

Tête vérifiée : `62e80d7fb7edf066a8ebd32e8d4daf6b707c95ca` (pas de « TÊTE CHANGÉE »). Aucune fiche fournie : le diff a été jugé seul.

## 1. Périmètre du diff

`git diff --stat origin/master...origin/video/FIX-ROUGES-APPARITION-v21t` liste 4 fichiers (+229/−9) :

- `src/domaine/site-videos/bornes-site.ts` (nouveau), `src/domaine/site-videos/controles.ts`, `tests/site-videos/encart-3-bornes-site.test.ts` (nouveau) ;
- `tests/image-video/variete/apparition.test.ts`.

Les trois premiers viennent du commit `dcb6ebff`, une **copie** de #1786 (`50fec39a`, déjà dans master) arrivée par une fusion de master. Leurs blobs sont **identiques** à ceux de master (`c8296b97`, `37c796a3`, `9377444b`). Ils n'apparaissent dans le diff à trois points que parce que la base commune précède #1786.
Preuve : `git merge-tree --write-tree origin/master HEAD` fusionne sans conflit, et le diff entre `origin/master` et l'arbre fusionné **ne contient que `tests/image-video/variete/apparition.test.ts`** (+30/−8).

Effet net = un seul fichier de test, ce qui correspond au nom de la branche (FIX-ROUGES-APPARITION). Le diff ne touche ni `.github/**`, ni `deploiement/**`, ni `outils/gardes/**`, ni `scripts/echecs-connus.json`, et ne contient aucun secret.

Ce que change le fichier :
1. `EMPREINTE_TOILE_REFERENCE` passe de `09542bc8…` (non reproductible, selon le commentaire) à `ff1dbf99…`, avec un historique des changements voulus en commentaire ;
2. un harnais de chargement : si `studio-rendu/node_modules/remotion` est absent, `remotion` est remplacé par un stub inerte et la suite est sautée (`describe.skipIf`). Si les dépendances sont là, rien ne change.

## 2. Tests et types

- Sans les dépendances de studio-rendu (pnpm seulement) : le fichier se charge, il est **sauté** (1 skipped, 12 skipped), et encart-3 passe 16/16. C'est le but annoncé : il ne fait plus planter les jobs « fichiers touchés ».
- Après `npm ci` dans `studio-rendu` : **12/12 passent** sur la branche.
- Sur la tête de master `054d9551` avec le fichier de la branche (état après fusion) : **12/12 passent**. L'empreinte `ff1dbf99…` tient donc aussi sur le master courant.
- `npx tsc --noEmit -p .` : 0 erreur sur la branche, 0 sur master. Aucune erreur neuve.
- Noms de tests : le test d'empreinte s'appelle « sans variété : le HTML de la toile est celui de master au 27/11 (ff1dbf99…) », ce qui dit sa promesse.

## 3. Mutations (toutes remises, rien poussé sur le Studio)

| # | Mutation | Résultat |
|---|----------|----------|
| M1 | `Noeud.tsx:25` `etat.etat === "absent"` → `!==` (carte éteinte APP-C) | ROUGE : « APP-C (rouge sans le lot)… » |
| M2 | `Noeud.tsx:114` `borderRadius: main ? 10 : 34` → `35` (rendu par défaut) | ROUGE : les 2 tests d'empreinte (sans variété, et APP-A/MAT-A) |
| M3 | `bornes-site.ts` `n < min` → `n <= min` | ROUGE : 2 tests de bornes exactes |
| M4 | `controles.ts` `dejaSignale` → toujours `false` | ROUGE : « un titre de plus de 60 caractères n'est signalé qu'une fois (SITE-11) » |
| M5 | harnais : `DEPS_RENDU = false` alors que les dépendances sont là | pas de rouge : 12 sautés |
| M6 | harnais : `vi.mock` renvoie toujours le stub | pas de rouge : 12/12 passent |

Les mutations qui n'ont pas compté :
- `Noeud.tsx:114` en touchant le `10`, et `:104` (`borderRadius: 34` → `35`). Ces deux lignes ne servent que dans des branches de variété (MAT-C, MAT-D) que l'empreinte ne parcourt pas. Ce n'est pas un trou de ce lot.

Lecture de M5 et M6 :
- **M6** : `Toile` et `Noeud` n'importent pas `remotion` ; le stub ne sert qu'au chargement transitif. Le rendu mesuré ne dépend pas de remotion, donc ce n'est pas un trou.
- **M5 — réserve, non bloquante** : le saut est **silencieux**. Un `DEPS_RENDU` faux saute la suite sans rien faire rougir. C'est le prix du design choisi, et l'exécution réelle reste garantie là où elle compte. Dans le Studio, `gv-tests-moteurs.yml` installe `studio-rendu` (`deps-rendu=oui` dès que `tests/image-video` est dans la liste). Il lance `tests/image-video` quand `src/moteurs/montage-image-video/**` change, et lance tout (`TOUT=1`) hors PR. Je n'ai pas vérifié `tests-cibles.yml`. Une amélioration possible, dans un lot à part : faire échouer le saut quand `CI` et `deps-rendu=oui` sont tous deux posés.

## 4. Autres remarques (non bloquantes)

- Le recalage de l'empreinte change un « figé avant le lot » en « recalé sur master ». C'est assumé et documenté (commits listés). L'invariant qui garde de la valeur est vérifié par M2 : sans variété et APP-A + MAT-A rendent le même HTML, et tout changement du rendu par défaut fait rougir.
- `pnpm-lock.yaml` d'axion-ia : identique entre la branche de départ et `origin/main`, rien à réinstaller.
