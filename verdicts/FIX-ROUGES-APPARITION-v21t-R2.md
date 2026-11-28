VERDICT A CORRIGER sha=4cee2811 (R2) : tests/image-video/variete/apparition.test.ts:42 — retirer le `skipIf(!DEPS_RENDU)` (garder le stub `remotion`) : la branche rend rouges ses propres jobs « tests des fichiers touchés » et « tests des nouveaux fichiers de test » (« ROUGE : fichier sauté … apparition.test.ts »), alors que la suite passe 12/12 sans les dépendances de studio-rendu une fois le saut retiré.

Relecteur R2 (indépendant), le 2026-11-28. Studio relu en lecture seule, aucune modification poussée.

## Tête

`origin/video/FIX-ROUGES-APPARITION-v21t` = `4cee28114ee7e939c1caf1bd98d38a525827120c` : conforme (pas de « TÊTE CHANGÉE »).

## Périmètre du diff

- `git diff --stat origin/master...HEAD` : 6 fichiers, +266/−14. Aucun fichier sous `.github/**`, `deploiement/**`, `outils/gardes/**`, ni `scripts/echecs-connus.json`, aucun secret.
- 3 des 6 fichiers (`src/domaine/site-videos/bornes-site.ts`, `src/domaine/site-videos/controles.ts`, `tests/site-videos/encart-3-bornes-site.test.ts`) viennent d'une **copie** de #1786 (`dcb6ebff`) qui porte un SHA différent de celui de master (`50fec39a`). Leur contenu est identique à master (même blob `c8296b97` pour `bornes-site.ts`, diff vide pour les deux autres). `git merge-tree origin/master HEAD` fusionne proprement et le diff net se réduit aux 3 fichiers de la branche : `scripts/comparer-echecs.mjs`, `tests/image-video/variete/apparition.test.ts`, `tests/scripts/comparer-echecs.test.ts` (+67/−13). C'est du bruit, pas un défaut, mais **fusionner master dans la branche** rendrait le diff de la PR lisible.
- Le diff net est cohérent avec le nom de la branche (empreinte d'apparition et rouges de CI).

## Défaut bloquant : les deux derniers commits se contredisent

- `62e80d7f` : quand `studio-rendu/node_modules/remotion` est absent (cas des jobs `verifier.yml › tests des fichiers touchés` et `tests-nouveau.yml`, qui ne lancent pas `npm ci` dans studio-rendu), le fichier se charge grâce à un stub `remotion` et **ses 12 cas sont sautés**.
- `4cee2811` : `comparer-echecs.mjs` rend ROUGE tout fichier dont tous les cas sont sautés. Le test ajouté prend précisément `apparition.test.ts` comme exemple.
- Résultat : sur cette PR, les deux jobs sont rouges.
  - Reproduit en local, dans les conditions de la CI (sélection `--selection`, `studio-rendu/node_modules` retiré) : `31 tests lancés / ROUGE : fichier sauté, aucun test n'a tourné : tests/image-video/variete/apparition.test.ts / ROUGE`, code 1.
  - Confirmé sur la CI réelle du commit `4cee2811` : `tests des fichiers touchés` = failure et `tests des nouveaux fichiers de test` = failure, avec la même ligne dans le journal (`173 tests lancés … ROUGE : fichier sauté … apparition.test.ts`).
- **Le saut est inutile.** Avec le seul stub, sans `studio-rendu/node_modules`, la toile se rend à l'identique (sonde : `DEPS_RENDU=false EMP=ff1dbf99264cf312…`, même empreinte qu'avec les vraies dépendances). Une fois `decrire.skipIf(!DEPS_RENDU)(nom, fn)` remplacé par `decrire(nom, fn)`, on obtient 12/12 verts sans les dépendances et, dans les conditions de la CI, `43 tests lancés / VERT`, code 0.
- **À faire** : retirer le `skipIf` à `apparition.test.ts:42` (garder le `vi.mock("remotion")`), corriger le commentaire d'en-tête l. 29-33 (« la suite est sautée »), puis relancer les deux jobs.

## Vérifications

- Installation : `pnpm install --frozen-lockfile` OK. `npm ci` dans `studio-rendu` (pour juger l'empreinte avec les vraies dépendances).
- `npx vitest run tests/scripts/comparer-echecs.test.ts tests/site-videos/encart-3-bornes-site.test.ts tests/image-video/variete/apparition.test.ts` :
  - avec les dépendances de studio-rendu : 43/43 verts (apparition 12/12, empreinte `ff1dbf99…` vérifiée) ;
  - sans ces dépendances : 31 verts et 12 sautés.
- `npx tsc --noEmit -p .` : 0 erreur.
- Noms de tests : les deux cas ajoutés à `comparer-echecs.test.ts` disent leur promesse. Le test d'empreinte est renommé « … celui de master au 27/11 (ff1dbf99…) ». Le comportement « sauté sans dépendances » n'a pas de test (et doit disparaître, cf. ci-dessus).

## Mutations (toutes remises en place, `git status` propre à la fin)

| #   | Mutation                                                         | Résultat                                     |
| --- | ---------------------------------------------------------------- | -------------------------------------------- |
| M1  | `fichiersSautes` : `!cas.some(...)` → `cas.some(...)`            | 5 tests rouges ✅                            |
| M2  | `comparer` : suppression de `&& sautes.length === 0`             | 1 rouge ✅                                   |
| M3  | `compterLances` : on compte aussi les cas sautés (filtre retiré) | 2 rouges ✅                                  |
| M4  | `fichiersSautes` : borne `cas.length > 0` → `>= 0`               | **0 rouge : trou**                           |
| M5  | `rapport` : suppression de la ligne « ROUGE : fichier sauté »    | 1 rouge ✅                                   |
| M6  | `EMPREINTE_TOILE_REFERENCE` : un chiffre changé                  | 2 rouges ✅                                  |
| M7  | `skipIf(!DEPS_RENDU)` → `skipIf(DEPS_RENDU)`                     | 0 rouge (12 sautés, vert local) : trou       |
| M8  | `skipIf` retiré, sans dépendances de studio-rendu                | 12/12 verts : prouve que le saut est inutile |

- **M4 (trou mineur)** : aucun test ne couvre un fichier à 0 cas (fichier qui ne se charge pas, ou fichier vide). Ajouter un cas `rapportVitest({ "tests/x.test.ts": [] })` → `fichiersSautes` = `[]`.
- **M7** : un fichier entièrement sauté reste vert en local. C'est justement ce que le nouveau `comparer-echecs` rattrape en CI, donc c'est cohérent une fois le `skipIf` retiré.
