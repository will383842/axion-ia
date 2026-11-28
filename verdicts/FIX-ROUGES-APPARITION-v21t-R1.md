VERDICT A CORRIGER sha=4cee2811 (R1) : scripts/comparer-echecs.mjs:73 (+ tests/image-video/variete/apparition.test.ts:34-42) — la PR se rend rouge elle-même : dans « tests des fichiers touchés » (verifier.yml) et tests-nouveau.yml, sans studio-rendu/node_modules, apparition.test.ts est entièrement sauté par 62e80d7f puis déclaré ROUGE par 4cee2811 (reproduit : code 1). Choisir UNE voie : soit le job installe les dépendances de studio-rendu (touche .github/** → STOP & ASK), soit un fichier entièrement sauté reste un avertissement non bloquant, soit on retire le stub.

# Relecture R1 — FIX-ROUGES-APPARITION-v21t, tête 4cee2811

Dépôt relu : `will383842/studio-axion-ia-public`, branche `video/FIX-ROUGES-APPARITION-v21t`.
Tête vérifiée : `4cee28114ee7e939c1caf1bd98d38a525827120c` (pas de « tête changée »).
Aucune fiche fournie (dépôt des plans privé) : le diff est jugé seul.

## 1. Périmètre du diff

- `git diff --stat origin/master...origin/video/FIX-ROUGES-APPARITION-v21t` annonce 6 fichiers, dont
  `src/domaine/site-videos/bornes-site.ts`, `controles.ts` et `tests/site-videos/encart-3-bornes-site.test.ts`.
  Ces 3 fichiers ne sont **pas** du travail de la branche : le commit `dcb6ebff` (#1786) porte **exactement le même
  correctif** que `50fec39a` déjà sur master (comparaison des lignes `+/-` : identiques). Ils n'apparaissent que parce
  que la base de fusion (`fa62d1b2`) est antérieure à `50fec39a`.
- Résultat réel d'une fusion dans master (`git merge-tree --write-tree origin/master HEAD`, sans conflit) :
  **3 fichiers, +67/−13** : `scripts/comparer-echecs.mjs`, `tests/image-video/variete/apparition.test.ts`,
  `tests/scripts/comparer-echecs.test.ts`. Cohérent avec le nom de la branche.
- Aucun fichier sous `.github/**`, `deploiement/**`, `outils/gardes/**`, ni `scripts/echecs-connus.json`. Aucun secret.
- Les fichiers de verrouillage (`pnpm-lock.yaml`, `studio-rendu/package-lock.json`) ne changent pas.

## 2. Ce qui est prouvé (OK)

| Vérification                                                                                                   | Résultat                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vitest run` apparition + comparer-echecs + encart-3, AVEC `studio-rendu/node_modules` (`npm ci`), sur la tête | 43 tests, tous `passed` ; `comparer-echecs` → VERT                                                                                                |
| Mêmes deux fichiers sur l'arbre FUSIONNÉ avec master (`6486db47`, local)                                       | 27/27 `passed` : l'empreinte `ff1dbf99…` tient sur master + branche                                                                               |
| Mutation : `ff1dbf99264cf312` → `…313` dans `EMPREINTE_TOILE_REFERENCE`                                        | 2 tests rouges (empreinte + identité APP-A/MAT-A)                                                                                                 |
| Mutation : retirer `&& sautes.length === 0` de `comparer`                                                      | 1 test rouge (« un fichier sauté parmi des fichiers lancés reste rouge… »)                                                                        |
| Mutation : `compterLances` recompte les cas sautés                                                             | 2 tests rouges                                                                                                                                    |
| Mutation : `rapport` n'écrit plus la ligne « fichier sauté »                                                   | 1 test rouge                                                                                                                                      |
| `npx tsc --noEmit -p .` (8 Go de tas)                                                                          | 43 erreurs sur la tête, 43 sur master, mêmes fichiers : **aucune erreur neuve** (`TS2578` de `comparer-echecs.test.ts:2` déjà présent sur master) |
| `eslint` sur les 3 fichiers                                                                                    | 0 problème                                                                                                                                        |

Chaque comportement ajouté dans `comparer-echecs.mjs` (cas sauté non compté, fichier entièrement sauté rouge, ligne
de rapport) a un test dont le nom dit la promesse, et chacun tombe sous mutation.

## 3. Ce qui bloque (A CORRIGER)

### 3.1 La PR se rend rouge elle-même — `scripts/comparer-echecs.mjs:73`

Les deux commits de tête se contredisent :

- `62e80d7f` rend `apparition.test.ts` _chargeable_ sans les dépendances de `studio-rendu` (stub `vi.mock("remotion")`
  - `describe.skipIf(!DEPS_RENDU)`), précisément pour les jobs « tests des fichiers touchés » (`verifier.yml`) et
    « tests des nouveaux fichiers de test » (`tests-nouveau.yml`), qui ne font que `pnpm install` à la racine ;
- `4cee2811` déclare ROUGE tout fichier dont aucun cas n'a tourné.

Reproduit dans les conditions exactes de ces jobs (pas de `studio-rendu/node_modules`) :

```
pnpm exec vitest run --reporter=json --outputFile=r.json tests/image-video/variete/apparition.test.ts tests/scripts/comparer-echecs.test.ts
node scripts/comparer-echecs.mjs r.json scripts/echecs-connus.json
15 tests lancés
ROUGE : fichier sauté, aucun test n'a tourné : tests/image-video/variete/apparition.test.ts
ROUGE            (code 1)
```

Ces deux jobs se déclenchent sur cette PR (elle touche `tests/**` et `scripts/comparer-echecs.mjs`). Le « fichier qui
ne se chargeait pas » est remplacé par un « fichier sauté » tout aussi rouge : le rouge visé par la branche n'est pas
fermé, il change seulement de libellé. Et `echecs-connus.json` ne peut pas l'absoudre : `sautes` n'est filtré par
aucune liste.

### 3.2 Régression latente pour les autres PR

La nouvelle règle n'a pas d'échappatoire. Parmi les 61 fichiers qui utilisent `describe.skipIf/runIf`, **16 sont
entièrement sautés** sans `studio-rendu/node_modules` ni base Postgres réelle (mesuré localement, `fichiersSautes`) :
`tests/a2-preuve-reelle.test.ts`, `tests/ffmpeg-reel.test.ts`, `tests/l3-01-verrou-credits-postgres-reel.test.ts`,
`tests/numero-suivi-postgres-reel.test.ts`, `tests/remotion/determinisme-plage.test.ts`,
`tests/studio-rendu/schema-flux.test.tsx`, `tests/visuels/rendu-pages.test.ts`, `tests/raccords/*image-composee*.test.tsx`,
`tests/tableau/**/rendu*.test.ts`, etc. (une partie dépend de ffmpeg, peut-être présent sur `ubuntu-latest` ; les
fichiers Postgres réel et `studio-rendu` sont sautés en CI à coup sûr). Toute PR future qui modifie l'un d'eux sera
rouge dans les deux jobs, sans moyen de le déclarer. Aucun test ne fige ce choix (le cas « fichier volontairement
sauté selon l'environnement » n'est pas couvert).

### 3.3 Ce qu'il faut faire (une seule voie, au choix de Will)

1. **Installer les dépendances de `studio-rendu`** dans les deux jobs (comme `tests-cibles` et `gv-tests-moteurs`) :
   le test tourne vraiment et la règle « fichier sauté = rouge » devient juste — mais cela touche `.github/**`,
   hors périmètre de cette branche → **STOP & ASK**.
2. **Garder le stub, rendre la règle non bloquante** : `fichiersSautes` produit un avertissement visible
   (`AVERTISSEMENT : fichier sauté…`) sans entrer dans `ok` ; adapter les deux tests (le nom doit dire « signalé,
   pas rouge »). Le vert ne vaut alors que pour les fichiers lancés, à écrire dans le rapport.
3. **Liste explicite** de fichiers dont le saut est attendu, lue par `comparer` (hors `echecs-connus.json`, qui est
   interdit à cette branche), avec un test qui prouve qu'un fichier sauté NON listé reste rouge.

Dans tous les cas, un test doit reproduire la situation de CI de cette PR (rapport où `apparition.test.ts` est
entièrement `skipped`) et dire explicitement le résultat attendu.

## 4. Remarques non bloquantes

- `EMPREINTE_TOILE_REFERENCE` est recalée (`09542bc8…` → `3ffc05c6…` → `ff1dbf99…`) sur la valeur que produit
  master, ce qui fait d'une empreinte « figée avant le lot » une photographie de master : elle ne détecte plus que les
  changements FUTURS. Le commentaire le dit (« voulue, à relire ») et la liste des PR qui ont changé le HTML est
  donnée ; je confirme seulement que `ff1dbf99…` est reproductible sur la tête et sur l'arbre fusionné. L'invariant
  qui compte (sans variété ≡ APP-A + MAT-A) reste testé et tombe sous mutation.
- La branche est en retard sur master (base `fa62d1b2`) : la fusionner avec master avant la relecture suivante
  rendrait `diff --stat` lisible (3 fichiers au lieu de 6).
- Le stub `remotion` répond `() => null` à tout accès : sans les dépendances, il ne vérifie rien — d'où l'importance
  que la voie choisie en 3.3 ne laisse pas ce saut passer pour un vert.

Relecteur : R1 (exactitude, régressions, cas limites). Aucun code du Studio modifié.
