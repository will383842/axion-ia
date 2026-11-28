VERDICT A CORRIGER sha=640f9f22 (R2) : scripts/comparer-echecs.mjs:73 — « sautes.length === 0 » rend ROUGE, sans échappatoire, toute PR qui touche un test légitimement conditionnel (ex. tests/numero-suivi-postgres-reel.test.ts : vert sur master, rouge sur la branche) ; borner la règle (liste permise de fichiers conditionnels, ou simple avertissement hors `ok`) et ajouter un test « un fichier conditionnel à l'environnement ne rougit pas le job »

# Relecture R2 indépendante — video/FIX-ROUGES-APPARITION-v21t

- Tête vérifiée : `640f9f22f514ce9b4c181ec3ef7af6d21ca6e08e` (inchangée).
- Dépôt : `will383842/studio-axion-ia-public`, en lecture seule. Aucun code du Studio n'a été modifié ni poussé.

## Périmètre du diff

`git diff --stat origin/master...HEAD` affiche 6 fichiers. Deux d'entre eux (`src/domaine/site-videos/bornes-site.ts`, `controles.ts` et le test `encart-3-bornes-site.test.ts`) viennent de #1786, **déjà sur master** : blob `c8296b97` identique, arrivé par la fusion de master (dcb6ebff) dont le merge-base (`fa62d1b2`) est antérieur.
La fusion réelle dans master (`git merge-tree --write-tree origin/master HEAD`) ne change que **3 fichiers, +76/−15** :

- `scripts/comparer-echecs.mjs`
- `tests/image-video/variete/apparition.test.ts`
- `tests/scripts/comparer-echecs.test.ts`

Le diff ne touche ni `.github/**`, ni `deploiement/**`, ni `outils/gardes/**`, ni `scripts/echecs-connus.json`, et ne contient aucun secret. Il est petit et cohérent avec le nom de la branche.

## Tests lancés

| Arbre | Dépendances `studio-rendu` | Résultat (3 fichiers touchés + encart-3) |
| --- | --- | --- |
| branche 640f9f22 | absentes (cas des jobs CI « fichiers touchés ») | 38 passés, 6 sautés, 0 échec ; le fichier n'est pas entièrement sauté |
| branche 640f9f22 | installées (`npm ci`) | **44/44 passés**, l'empreinte `ff1dbf99…` comprise |
| fusion avec master (arbre `1af98b57`) | installées | **44/44 passés** |

`tsc --noEmit -p .` (avec `--max-old-space-size=12000`, sinon OOM à 4 Go) donne **43 erreurs sur master et 43 erreurs identiques sur la fusion** (comparaison par `diff`). Ce sont toutes des `TS2307 remotion` dans `docs/**/prototypes`. **Aucune erreur neuve.**

## Mutations (8, code remis à chaque fois avec `git checkout`, rien poussé)

| # | Mutation | Résultat |
| --- | --- | --- |
| M1 | `compterLances` compte de nouveau les cas sautés | 🔴 2 tests rouges |
| M2 | retrait de `&& sautes.length === 0` dans `ok` | 🔴 1 rouge |
| M3 | retrait de la borne `cas.length > 0` dans `fichiersSautes` | 🔴 1 rouge |
| M4 | retrait de la ligne « ROUGE : fichier sauté » du rapport | 🔴 1 rouge |
| M5 | `!cas.some(…)` → `!cas.every(…)` (inversion) | 🔴 1 rouge |
| M6 | empreinte `ff1d…` → `ff1e…` | 🔴 2 rouges (avec les dépendances) |
| M7 | garde `existsSync` du `vi.mock` inversée | 🟢 vert : **mutant équivalent**. Avec les dépendances, `remotion` se résout vers `studio-rendu/node_modules`, si bien que le mock n'est jamais appelé (preuve : un mock qui lève passe 12/12 avec les dépendances et casse le chargement sans elles). |
| M8 | `skipIf(!DEPS_RENDU)` → `skipIf(DEPS_RENDU)` | 6 sautés au lieu de 0. Aucun test du fichier ne rougit ; c'est le comparateur qui rattrape un fichier entièrement sauté. |

Chaque comportement ajouté dans `comparer-echecs.mjs` est tenu par un test dont le nom dit la promesse.

## Défaut bloquant : la nouvelle règle rougit des PR légitimes

`comparer()` rend désormais `ok = false` dès qu'un fichier du rapport a tous ses cas sautés. Or ce script juge trois jobs : `verifier.yml` « tests des fichiers touchés », `tests-nouveau.yml`, et le repli de `gv-tests-moteurs.yml`. Ces jobs lancent les fichiers de test touchés par la PR.

J'ai lancé les 102 fichiers qui contiennent `skip`/`skipIf`/`runIf`, sans les dépendances de rendu, comme ces jobs. Résultat : **18 fichiers sont entièrement sautés**. Plusieurs le sont **par conception**, sur une variable qu'**aucun workflow ne fournit** (`grep` vide dans `.github/workflows`) :

- `tests/numero-suivi-postgres-reel.test.ts` et `tests/l3-01-verrou-credits-postgres-reel.test.ts` : `skipIf(!STUDIO_ESSAI_PG_URL)` ;
- `tests/a2-preuve-reelle.test.ts` : `skipIf(A2_PREUVE_REELLE !== "1")` ;
- `tests/ffmpeg-reel.test.ts`, `tests/remotion/determinisme-plage.test.ts`, `tests/visuels/rendu-pages.test.ts`, etc. : outils réels absents.

Reproduction de l'étape CI exacte, sur le même rapport vitest de `tests/numero-suivi-postgres-reel.test.ts` :

```
master  : node scripts/comparer-echecs.mjs r.json scripts/echecs-connus.json → « 3 tests lancés / VERT », code 0
branche : → « 0 tests lancés / ROUGE : aucun test lancé. / ROUGE : fichier sauté … », code 1
```

(Le décompte de 3 sur master compte les cas sautés comme « lancés ». La branche corrige ce point, à juste titre, mais le seuil `lances > 0` rougit alors lui aussi.)

Conséquence : toute PR qui ajoute ou modifie un de ces fichiers sera **rouge en permanence**. `echecs-connus.json` ne liste que des échecs et ne peut pas l'exempter, et l'auteur ne peut rien y faire dans sa PR. C'est un rouge que personne ne peut fermer, donc une régression de la gate.

**À faire** (`scripts/comparer-echecs.mjs:73` et `compterLances`) :
1. Borner la règle. Soit une liste fermée, dans le script, des fichiers conditionnels à l'environnement qui ont le droit d'être entièrement sautés. Soit un **avertissement** (ligne « ATTENTION ») hors `ok`. Soit une règle qui ne vise que les fichiers dont le saut vient d'une dépendance installable (cas d'`apparition.test.ts`).
2. Appliquer la même exception au seuil `lances > 0` : un rapport qui ne contient que des fichiers conditionnels permis ne doit pas être « aucun test lancé ».
3. Ajouter un test dont le nom dit la promesse, par exemple « un fichier conditionnel à l'environnement (postgres-reel) entièrement sauté ne rougit pas le job ». Garder le test des 12 cas sautés d'`apparition.test.ts`, qui doit rester rouge.

## Remarque non bloquante

`apparition.test.ts` saute ses 6 cas de rendu quand les dépendances de `studio-rendu` manquent. J'ai forcé ces suites sans les dépendances (stub inerte du `vi.mock`) : **12/12 passent, empreinte `ff1dbf99…` comprise**. Le chemin de rendu de `Toile` n'utilise donc pas `remotion`, et le `skipIf` coupe sans nécessité 6 tests dans les deux jobs sans dépendances. Pour garder la couverture partout, on peut retirer `describeRendu`. Sinon, écrire dans le commentaire que c'est une prudence.

Par ailleurs, `gv-tests-moteurs.yml` ne déclenche `tests/image-video` (avec les dépendances) que sur `src/moteurs/montage-image-video/`. Une PR qui ne toucherait que `studio-rendu/compositions/image-video/Toile.tsx` n'y relancerait donc pas l'empreinte. C'est un trou préexistant, hors du périmètre de la branche, mais à connaître.

---

## Second relecteur R2 (session indépendante, même tête 640f9f22) : A CORRIGER aussi, deuxième point bloquant

**Constat ci-dessus reproduit** : `tests/numero-suivi-postgres-reel.test.ts` lancé sans base Postgres puis passé à `comparer()` donne `ok=false` sur la branche (« ROUGE : fichier sauté … ») et `ok=true` sur master (3 tests lancés).

**Point bloquant supplémentaire** : tests/image-video/variete/apparition.test.ts:44. La mutation `skipIf(!DEPS_RENDU)` → `skipIf(DEPS_RENDU)` reste verte (6 passed, 6 skipped). Ajouter un test toujours lancé qui rougit si la condition de saut s'inverse.


Relecteur R2 indépendant. Tête vérifiée : 640f9f22f514ce9b4c181ec3ef7af6d21ca6e08e (inchangée). Code du Studio non modifié (toutes les mutations restaurées, `git diff` propre).

### Diff relu (`git diff origin/master...origin/video/FIX-ROUGES-APPARITION-v21t`)

6 fichiers, +275/−16 : `scripts/comparer-echecs.mjs`, `tests/scripts/comparer-echecs.test.ts`, `tests/image-video/variete/apparition.test.ts`, plus `src/domaine/site-videos/bornes-site.ts`, `src/domaine/site-videos/controles.ts` et `tests/site-videos/encart-3-bornes-site.test.ts`.
- Ces trois derniers viennent du commit `dcb6ebff` (#1786), un doublon de `50fec39a` déjà sur master. Le blob `bornes-site.ts` est identique (`c8296b97`), donc la fusion ne change rien net. C'est du bruit dans le diff à trois points, pas un écart de périmètre.
- Rien sous `.github/**`, `deploiement/**`, `outils/gardes/**` ni `scripts/echecs-connus.json`, et aucun secret. Le diff est petit et cohérent avec le nom de la branche. La fusion dans `origin/master` (88a2dc52) se fait sans conflit.

### Preuves

- Install : `pnpm install --frozen-lockfile` à la racine, et `npm ci` dans `studio-rendu`.
- Tests des fichiers touchés, sans les dépendances de `studio-rendu` : 3 fichiers, 38 passed, 6 skipped. Avec ces dépendances : 44/44 passed.
- Branche fusionnée dans master : `vitest run tests/scripts/comparer-echecs.test.ts tests/site-videos/ tests/image-video/variete/apparition.test.ts` donne 41 fichiers et 363/363 passed. L'empreinte `ff1dbf99…` est bien celle de master courant.
- `tsc --noEmit -p .` (avec `--max-old-space-size=10240`, le tas par défaut fait un OOM) : 43 erreurs sur la branche et 43 sur master, identiques ligne à ligne (`remotion` introuvable dans `docs/**/prototypes`). Aucune erreur neuve.
- Chaque comportement ajouté dans `comparer-echecs` a un test nommé d'après sa promesse : fichier entièrement sauté = rouge, cas sauté non compté, fichier sans cas ≠ sauté.

### Mutations (9 au total, chacune restaurée)

| # | Mutation | Résultat |
|---|----------|----------|
| 1 | `comparer` : retrait de `&& sautes.length === 0` | 🔴 1 failed |
| 2 | `compterLances` : retrait du filtre passed/failed | 🔴 2 failed |
| 3 | `fichiersSautes` : `cas.length > 0` → `>= 0` | 🔴 1 failed |
| 4 | `rapport` : ligne « fichier sauté » supprimée | 🔴 1 failed |
| 5 | `fichiersSautes` : `!cas.some` → `cas.some` | 🔴 6 failed |
| 6 | `EMPREINTE_TOILE_REFERENCE` modifiée d'un caractère | 🔴 2 failed |
| 7 | **`apparition.test.ts:44` `skipIf(!DEPS_RENDU)` → `skipIf(DEPS_RENDU)`** | **🟢 6 passed, 6 skipped : TROU** |
| 8 | `bornes-site.ts` `n < min` → `n <= min` | 🔴 2 failed |
| 9 | `controles.ts` `dejaSignale` : `=== "titreWeb"` → `!==` | 🔴 1 failed |

### Pourquoi la mutation 7 bloque

La branche pose une règle : un fichier entièrement sauté est rouge (« un vert qui ne regarde rien »). Dans le même temps, elle rend `apparition.test.ts` **partiellement** sautable. La condition de saut peut alors s'inverser sans qu'aucun test ne rougisse.

Avec la condition inversée, les deux suites qui portent la promesse de la branche sont sautées en silence partout où `remotion` est installé, y compris dans `gv-tests-moteurs`, qui installe `studio-rendu`. Ces deux suites sont « APP · référence inchangée » (l'empreinte `ff1dbf99`) et « APP · dessin » (« rouge sans le lot »). Les 6 tests moteur suffisent à garder `comparer-echecs` au vert.

À corriger : ajouter dans une suite toujours lancée un test qui lie la condition de saut à la présence réelle de `remotion`. Par exemple, `const SAUTER_RENDU = !DEPS_RENDU; const describeRendu = decrire.skipIf(SAUTER_RENDU);` et `it("les suites de rendu ne sont sautées que si remotion manque", () => expect(SAUTER_RENDU).toBe(!existsSync(join(process.cwd(), "studio-rendu/node_modules/remotion/package.json"))))`. Ensuite, refaire la mutation 7 et vérifier qu'elle rougit.

### Remarques non bloquantes

- Hors des jobs qui installent `studio-rendu` (« tests des fichiers touchés », `tests-nouveau`), l'empreinte recalculée n'est jamais vérifiée. Elle ne l'est que dans `gv-tests-moteurs`, sur la zone `src/moteurs/montage-image-video/` ou `studio-rendu/`, et dans les passages complets. C'est cohérent avec le commentaire du fichier, mais il faut le savoir.
- Le dernier commit (« correction ») ne dit pas ce qu'il corrige.
