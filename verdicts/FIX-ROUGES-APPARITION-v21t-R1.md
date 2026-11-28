VERDICT A CORRIGER sha=62e80d7f (R1) : tests/image-video/variete/apparition.test.ts:34-42, la suite sautée sans studio-rendu/node_modules est comptée « 12 tests lancés, VERT » par scripts/comparer-echecs.mjs:39-45 et aucun job de CI ne lance ce fichier avec les dépendances sur cette PR : faire exécuter vraiment ce fichier en CI ou rendre le saut rouge ; puis fusionner origin/master pour que le diff à trois points ne porte plus #1786.

# Relecture R1 — video/FIX-ROUGES-APPARITION-v21t @ 62e80d7f

Tête vérifiée : `62e80d7fb7edf066a8ebd32e8d4daf6b707c95ca` (tête inchangée). Aucune fiche fournie (dépôt des plans privé) : jugement sur le diff seul.
Dépendances : `pnpm install --frozen-lockfile` (magasin local, le magasin par défaut est en lecture seule) + `npm ci` dans `studio-rendu/`.

## Ce qui est prouvé (correct)

- **Diff réel par rapport à master = 1 fichier** : `git diff origin/master 62e80d7f -- src/domaine/site-videos tests/site-videos/encart-3-bornes-site.test.ts` est vide ; seul `tests/image-video/variete/apparition.test.ts` diffère (+30/-8). Aucun fichier sous `.github/**`, `deploiement/**`, `outils/gardes/**`, `scripts/echecs-connus.json`, aucun secret.
- **Le rouge existe sur master et la branche le corrige** : sur `origin/master` (054d9551), avec les dépendances de rendu, `apparition.test.ts` → **2 échecs** (attendu `09542bc8…`, reçu `ff1dbf99…`). Sur la branche → **12/12 passent** ; sur la fusion locale branche + master courant (33b0d22e, fusion sans conflit) → **12/12 passent** (+ 16/16 pour `encart-3-bornes-site.test.ts`).
- **Empreinte reproductible** : `ff1dbf99…` obtenue sur la branche, sur la fusion et (en reçu) sur master seul : trois calculs identiques.
- **Mutation** : `ff1dbf99264cf312` → `…313` dans la constante → 2 échecs (le test d'empreinte et l'invariant « APP-A + MAT-A = sans variété » qui la compare aussi). Le test mord.
- **Nom du test** : « sans variété : le HTML de la toile est celui de master au 27/11 (ff1dbf99…) » dit la promesse ; le commentaire trace les recalages (25/11, 27/11) et les PR qui expliquent le changement.
- **tsc** : `npx tsc --noEmit -p .` → 0 erreur sur la branche, 0 sur master (aucune erreur neuve).

## À corriger

### 1. Bloquant : le saut produit un vert qui ne regarde rien (apparition.test.ts:34-42)

Le commit 62e80d7f ajoute un `vi.mock("remotion")` de remplacement et un `describe` en `skipIf(!DEPS_RENDU)`, pour que le fichier se charge dans les jobs « tests des fichiers touchés » (verifier.yml) et « tests des nouveaux fichiers de test » (tests-nouveau.yml), qui n'installent pas `studio-rendu/`.

Mesuré, sans `studio-rendu/node_modules` :
```
vitest --reporter=json … apparition.test.ts → 12 × "skipped"
node scripts/comparer-echecs.mjs r.json scripts/echecs-connus.json
  12 tests lancés
  VERT        (code 0)
```
`compterLances` (scripts/comparer-echecs.mjs:39-45) compte toutes les `assertionResults`, y compris `skipped` : la garde « ROUGE : aucun test lancé » ne se déclenche pas.

Et sur CETTE PR, aucun job n'exécute le fichier avec les dépendances :
- `gv-tests-moteurs` ne se déclenche pas : ses `paths` ne couvrent pas `tests/image-video/**`, et sa zone `tests/image-video` ne s'allume que sur `^src/moteurs/montage-image-video/` (`studio-rendu/**` déclenche le workflow sans allumer cette zone) ;
- `tests-cibles` installe `studio-rendu` mais ne liste que `tests/image-video/sujets-traites/…`, pas `variete/apparition.test.ts`.

Conséquence : la seule chose que fait cette PR (la nouvelle empreinte) n'est vérifiée par aucune CI. La CI affiche 12 lancés, vert. Toute PR future qui touche ce fichier aura le même faux vert. Avant la PR, le fichier rendait un rouge franc (`Cannot find package 'remotion'`, mesuré sur master).

Ce qu'il faut faire, au choix (le premier se fait sans toucher aux zones interdites) :
- a. `scripts/comparer-echecs.mjs` : ne compter dans `lances` que les cas `passed`/`failed`, et signaler en ROUGE (ou au moins en ligne visible « sauté : <fichier> ») un fichier dont tous les cas sont `skipped`. Ajouter un test nommé qui le prouve (rapport à 12 `skipped` → pas VERT). Fichier hors liste interdite, mais il sort du périmètre « APPARITION » : à décider par Will.
- b. Faire tourner ce fichier avec les dépendances : l'ajouter à la liste de `tests-cibles.yml`, ou ajouter `tests/image-video/**` aux `paths` et au `zone` de `gv-tests-moteurs.yml`. Cela touche `.github/**`, interdit sur cette branche : il faut une PR séparée, fusionnée AVANT ou avec celle-ci.
- c. À défaut : retirer le saut (garder le rouge de chargement, honnête) et écrire l'échec connu à sa place, hors de cette branche.

Tant qu'aucune de ces options n'est en place, le « vert » de la PR ne prouve pas son contenu. Ma passe locale (12/12 avec les dépendances) le prouve, mais elle ne remplace pas une gate.

### 2. Diff à trois points incohérent avec le nom de la branche

`git diff --stat origin/master...origin/video/FIX-ROUGES-APPARITION-v21t` affiche 4 fichiers / +229 : `src/domaine/site-videos/bornes-site.ts` (+76), `controles.ts` (+11/-2), `tests/site-videos/encart-3-bornes-site.test.ts` (+113). C'est l'encart vidéo PR 3 (#1786), arrivé par la fusion de `dcb6ebff`. Ce commit est celui de la branche de #1786, pas sa fusion écrasée `50fec39a` sur master, et la base commune est restée `fa62d1b2`. Le contenu est identique à master (diff à deux points vide), mais la PR telle qu'elle s'affiche présente 229 lignes de code « site-videos » sous une branche « APPARITION ».
À faire : `git merge origin/master` (fusion testée en local : sans conflit, diff ramené à 1 fichier, 28/28 tests verts), puis repousser. La relecture devra porter sur la nouvelle tête.

## Points mineurs (non bloquants)

- `apparition.test.ts:34` : `DEPS_RENDU` ne teste que `remotion` ; `react`/`react-dom` sont aussi chargés depuis `studio-rendu` (repli sur ceux de la racine, sans dommage aujourd'hui).
- `describe = Object.assign(fn, decrire)` : `describe.skip/only/each` contournent le `skipIf` (non utilisés dans le fichier).

## Commandes lancées

- `npx vitest run tests/image-video/variete/apparition.test.ts tests/site-videos/encart-3-bornes-site.test.ts` → 28/28 (branche) ; 28/28 (fusion avec master 054d9551)
- même chose sur `origin/master` → 2 échecs d'empreinte (rouge d'origine reproduit)
- sans `studio-rendu/node_modules` : branche → 12 skipped ; master → fichier en échec de chargement
- `node scripts/comparer-echecs.mjs` sur le rapport sauté → « 12 tests lancés / VERT »
- mutation de l'empreinte → 2 échecs
- `npx tsc --noEmit -p .` → 0 erreur (branche et master)
