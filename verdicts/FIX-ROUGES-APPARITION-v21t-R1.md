VERDICT A CORRIGER sha=640f9f22 (R1) : scripts/comparer-echecs.mjs:72 — la règle « fichier entièrement sauté = rouge » rougit sans recours 18 fichiers sautés exprès (skipIf URL_ESSAI/ffmpeg/rendu) ; la borner (liste d'exemptions dans echecs-connus.json ou sauts exprès exclus) avec un test nommé, et rebaser sur master pour retirer la copie de #1786 du diff

# Relecture R1 — video/FIX-ROUGES-APPARITION-v21t @ 640f9f22

Tête vérifiée : `640f9f22f514ce9b4c181ec3ef7af6d21ca6e08e` (inchangée). Aucune fiche fournie : diff jugé seul.
Relecture en lecture seule : aucun code du Studio modifié ni poussé.

## Périmètre du diff

`git diff --stat origin/master...HEAD` : 6 fichiers, +275 / −16. Aucun fichier de `.github/**`, `deploiement/**`,
`outils/gardes/**`, `scripts/echecs-connus.json`, ni aucun secret.

- Le vrai changement de la branche tient en 3 fichiers : `scripts/comparer-echecs.mjs`,
  `tests/scripts/comparer-echecs.test.ts`, `tests/image-video/variete/apparition.test.ts`.
- ⚠️ Les 3 autres (`src/domaine/site-videos/bornes-site.ts`, `src/domaine/site-videos/controles.ts`,
  `tests/site-videos/encart-3-bornes-site.test.ts`, 200 lignes) viennent du commit `dcb6ebff`, une **copie de #1786**
  posée sur la branche. Elle est identique à `50fec39a` sur master (`git diff origin/master HEAD` ne montre rien sur ces
  fichiers), mais la base de fusion (`fa62d1b2`) étant plus ancienne, le diff à trois points l'attribue à la branche.
  Sans danger à la fusion, mais le diff n'est plus « petit et cohérent avec le nom » : **rebaser sur master** (ou
  y fusionner master) pour qu'il ne reste que les 3 fichiers.
- La branche a 9 commits de retard sur master ; la fusion `origin/master` + branche est propre (`git merge-tree`).

## Ce qui est prouvé (bon)

| Vérification | Résultat |
| --- | --- |
| Tests des fichiers touchés, SANS `studio-rendu/node_modules` (situation CI « fichiers touchés ») | 3 fichiers, 38 passés, 6 sautés ; `apparition.test.ts` se charge (suites « moteur » et « déterminisme » tournent) |
| Même fichier sur `origin/master`, sans dépendances de rendu | `Cannot find package 'remotion'` → fichier en échec, aucun test : le défaut corrigé est réel |
| `apparition.test.ts` AVEC les dépendances de rendu (`npm ci` dans `studio-rendu`) | 12/12 passés, empreinte `ff1dbf99…` retrouvée |
| Fusion de la branche dans master actuel (`88a2dc52`) : apparition + comparer-echecs + `tests/site-videos` | 41 fichiers, 363/363 passés (master seul : 2 échecs d'empreinte, ceux que corrige la branche) |
| `tsc --noEmit -p .` (8 Go de tas ; sans cela, plantage mémoire code 134 des deux côtés) | 43 erreurs sur la tête, 43 sur la base `fa62d1b2`, mêmes messages : aucune erreur nouvelle (celle de `comparer-echecs.test.ts:2`, `@ts-expect-error` inutile, existait déjà) |

Mutations (toutes tuées) :

- M1 `comparer` : retrait de `&& sautes.length === 0` → 1 test rouge.
- M2 `compterLances` : retour au compte de tous les cas (sautés compris) → 2 rouges.
- M3 `fichiersSautes` : retrait de `cas.length > 0` → 1 rouge (« fichier sans aucun cas »).
- M4 `rapport` : ligne « ROUGE : fichier sauté » supprimée → 1 rouge.
- M5 `EMPREINTE_TOILE_REFERENCE` altérée d'un caractère → 2 rouges (avec les dépendances de rendu).

Chaque comportement ajouté dans `comparer-echecs.mjs` a un test dont le nom dit la promesse (« 12 cas sautés : pas vert,
pas compté comme lancé », « un fichier sauté parmi des fichiers lancés reste rouge ; un cas sauté dans un fichier lancé
reste vert », « un fichier sans aucun cas n'est pas sauté »).

## Ce qui bloque

### 1. Régression : la nouvelle règle rougit pour toujours des tests sautés EXPRÈS (`scripts/comparer-echecs.mjs:72`)

`comparer()` rend maintenant `ok: false` dès qu'un fichier du rapport a tous ses cas `skipped`. Or le dépôt contient des
fichiers conçus pour être sautés hors de leur environnement, et aucun workflow qui appelle `comparer-echecs.mjs`
(`verifier.yml` « tests des fichiers touchés », `tests-nouveau.yml`, repli de `gv-tests-moteurs.yml`) ne fournit
`URL_ESSAI` (absent de tout `.github/workflows`) ni ffmpeg.

Mesuré : sur les 109 fichiers de test qui contiennent un `skip`/`skipIf`/`runIf`, lancés sans dépendances de rendu,
`fichiersSautes` en rend **18**, dont :

```
tests/numero-suivi-postgres-reel.test.ts          describe.skipIf(!URL_ESSAI)
tests/l3-01-verrou-credits-postgres-reel.test.ts  describe.skipIf(!URL_ESSAI)
tests/ffmpeg-reel.test.ts                         describe.skipIf(!version)   (FFmpeg absent)
tests/a2-preuve-reelle.test.ts, tests/remotion/determinisme-plage.test.ts, tests/studio-rendu/schema-flux.test.tsx,
tests/visuels/rendu-pages.test.ts, tests/tableau/formats/rendu-reel.test.ts, … (18 au total)
```

Preuve directe, rapport vitest de `tests/numero-suivi-postgres-reel.test.ts` seul (ce que fait `verifier.yml` pour une
PR qui touche ce fichier) :

- `comparer-echecs.mjs` de master → `3 tests lancés / VERT`, code 0 ;
- `comparer-echecs.mjs` de la branche → `0 tests lancés / ROUGE : aucun test lancé. / ROUGE : fichier sauté…`, code 1.

Toute PR qui modifie l'un de ces 18 fichiers devient rouge sans issue : `echecs-connus.json` ne sait déclarer que des
échecs, pas des fichiers sautés. (Le compte « lancés » ignore aussi désormais les cas sautés : une PR qui ne touche
QUE de tels fichiers tombe en plus sur « aucun test lancé ».) Aucun test de la branche ne couvre ce cas : les 3 tests
ajoutés n'emploient que des fichiers fictifs.

À faire, au choix, avec un test nommé qui le prouve :

- une liste explicite de fichiers dont le saut est voulu (par exemple `sautesConnus` dans `echecs-connus.json`, lue
  par `comparer`), qui reste rouge pour tout autre fichier entièrement sauté ;
- ou restreindre la règle au cas visé (fichier qui ne se charge pas / dépendance de rendu absente), sans toucher aux
  `skipIf` d'environnement.

Test attendu, par exemple : « un fichier sauté exprès (déclaré) reste vert ; un fichier sauté non déclaré est rouge ».

### 2. Diff gonflé par une copie de #1786

Voir plus haut : rebaser sur `origin/master` pour que le diff ne porte que les 3 fichiers du correctif.

## Remarques (non bloquantes)

- `apparition.test.ts` : le bouchon `remotion` (Proxy qui rend `() => null`) n'est utilisé que si
  `studio-rendu/node_modules/remotion` est absent, et seules les suites qui rendent du HTML sont sautées dans ce cas.
  Avec les dépendances, le vrai module est rechargé (vérifié : 12/12 et empreinte exacte). Correct.
- L'empreinte recalée (`ff1dbf99…`) est la même sur la tête de branche et sur sa fusion avec master du 28/11 : le
  commentaire « recalculée sur master au 27/11 » tient encore aujourd'hui.
