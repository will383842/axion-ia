VERDICT OK sha=182184f8 (AUDIT) — 7 fichiers (actions.ts, FeuilleSerie.tsx, serie-ecriture.ts + 4 tests), aucun chemin interdit ni secret ; vitest des 4 tests touchés 40/41 (seul échec Jonction 4 Zernio, identique sur master), famille « série » 115/117 vs 96/107 sur master ; tsc 188 erreurs identiques master/branche (0 neuve) ; 5 mutations, toutes rouges.

# Audit argent · sécurité · données — studio-axion-ia, branche video/FIX-SERIE-PARTI-v21s

- Tête vérifiée : `182184f87235a045b8c3dd5d809019e46d81d349` (commence bien par 182184f8, tête inchangée).
- Base : `origin/master` du dépôt public, au 2026-11-28. Dépendances : `pnpm install --frozen-lockfile` (magasin pnpm local, lockfile respecté).
- Le jugement porte sur le diff seul, sans fiche (le dépôt des plans est privé).

## 1. Périmètre du diff (`git diff --stat origin/master...HEAD`)

| Fichier                                                                                                        | +/-  | Rôle                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/serie-ecriture.ts`                                                                               | 20   | nouveau sort `a-completer` (+ `manque`) quand `lancerGeneration` rend `ok: false` ; journal qui détaille hors domaine / à compléter ; suivi qui lit `a-completer` comme `parti` |
| `src/app/(studio)/ecrire/serie/actions.ts`                                                                     | 6    | renvoie `horsDomaine` et `aCompleter` ; `restes` = `reste` + `refuse` seulement                                                                                                 |
| `src/components/generateur/FeuilleSerie.tsx`                                                                   | 9    | phrase de notification extraite en fonction pure `phraseLancementSerie`                                                                                                         |
| `tests/serie-hors-domaine-v21s.test.ts`                                                                        | +163 | nouveau, cas (a) à (j)                                                                                                                                                          |
| `tests/e2e-verif1-bc-serie.test.ts`, `tests/l2-13c-plafonds-claude.test.ts`, `tests/paquet4-jonctions.test.ts` | 19   | attentes mises à jour                                                                                                                                                           |

- Petit, cohérent avec le nom de la branche : une idée arrêtée à 0 € n'est plus dite « partie » ni « en écriture ».
- Rien dans `.github/**`, `deploiement/**`, `outils/gardes/**`, `scripts/echecs-connus.json`. Aucun secret : la recherche `sk-ant|api_key|password|secret|token` sur le diff ne trouve rien. `CLE_ESSAI_CLAUDE` est une aide de test déjà présente.
- Aucune donnée de personne supprimée ni exposée : le diff ne fait que classer et compter des éléments de série. Une idée hors domaine garde son `scriptMaitreId`, et une idée de la page « Idées » reste reliée à son sujet (test g).

## 2. Argent : plafond écrit et refus AVANT l'appel

- Le chemin payant n'est pas modifié. `calculerPlanSerie`, `planSerie`, `exigerTotalConfirme` et son appel avant toute écriture (`serie-ecriture.ts:172`) sont inchangés. Le diff ne fait que lire le résultat de `lancerGeneration`, qui s'arrêtait déjà à 0 € sur un manque.
- Les tests (a) et (c) lancent la série avec un faux `fetch` qui interdit tout réseau : `appelsClaude` reste à 0 pour les idées hors domaine et pour celles qui manquent d'ancrage.
- Mutation M5 (retirer `await exigerTotalConfirme(...)`) : 6 tests rouges. Le test (i) est textuel, mais 5 tests de comportement rougissent aussi (r7 « Usine sans total vu : CONFIRMATION_REQUISE, rien n'est créé », l2-13c, formats-sans-accord…). Le refus avant l'appel est donc gardé par du comportement, pas seulement par une chaîne de caractères.

## 3. Gardes de test : rien d'affaibli sans preuve

- `e2e-verif1-bc-serie.test.ts` : sur **master**, ce fichier est rouge, **9 échecs**. Son faux Claude ne reconnaît pas les rôles de la chaîne courte. La branche ajoute `ROLES_CHAINE_COURTE` et `ROLES_CHAINE_COURTE_HORS_RECETTE`, et le fichier passe à 14/14.
- Le plancher « appels fantômes comptés » descend de `> 0.25` à `> 0.15` $. J'ai **mesuré** la valeur réelle sur la branche en instrumentant le test (sans rien committer) : `fantomes = 0.199513` $, ce qui correspond au commentaire (« ~0,20 $ »). Le plancher prouve toujours que l'appel sans réponse est compté à son pire cas, et non à zéro. L'affaiblissement est justifié par la mesure.
- `l2-13c` (fondateur) : `["parti"×3]` devient `["a-completer"×3]`, avec en plus l'assertion « aucun `refuse`/`reste` ». La garantie d'origine (aucune limite ne retient, aucun montant écrit) est conservée : `plan.partiront === 3` et l'absence de montant sont toujours vérifiés.
- `paquet4` Jonction 1 : `every parti` devient `["parti","a-completer"]` avec `manque: "HORS_DOMAINE"`. L'attente est plus précise qu'avant.

## 4. Tests lancés

- `npx vitest run` sur les 4 fichiers de tests touchés : **40 réussis, 1 échec** sur 41. L'échec est Jonction 4 (« rappel Votre marque… geste TikTok », `ZERNIO_NON_RELIE`). Il est **identique sur master**, donc préexistant et sans lien avec ce diff.
- Toute la famille qui touche `lancerSerie`/`suiviSerie`/`FeuilleSerie` (12 fichiers) : **branche 115/117, master 96/107**. Les deux échecs restants sur la branche sont Jonction 4 (ci-dessus) et `garde-ecran` (30 textes techniques). La sortie de `garde-ecran` est **identique** sur master, et aucun fichier touché n'y figure.
- `npx tsc --noEmit -p .` (avec `--max-old-space-size=9000`, sinon la mémoire manque) : 188 lignes d'erreurs, **identiques** sur master et sur la branche (`remotion` absent, `RouteContext`/`LayoutProps` non générés sans `next typegen`). Aucune erreur neuve.
- Chaque comportement ajouté a un test dont le nom dit la promesse : (a) « une idée hors domaine n'est pas partie », (b) « le Journal dit vrai », (c) « un autre manque est à compléter », (d) « toutes du domaine : rien ne change », (e) « l'action et la notification », (f) « le suivi est inchangé », (g) « reste reliée à son sujet », (h) « même geste renvoyé : aucun sujet de plus », (i) « l'argent n'a pas bougé », (j) « une idée refusée compte dans restes ».

## 5. Mutations (les miennes, annulées après chaque essai, code du Studio jamais modifié durablement)

| #   | Mutation                                                                                             | Résultat                                                                           |
| --- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| M1  | `serie-ecriture.ts` : `ok: false` remis en `sort: "parti"` (le défaut d'origine)                     | **rouge**, 10 tests (a, b, c, e, g, j, fondateur l2-13c, constat e2e, Jonction 1…) |
| M2  | `actions.ts` : `restes` recompté comme `sort !== "parti"` (les « à compléter » comptés comme gardés) | **rouge**, 4 tests (c, e, j)                                                       |
| M3  | `suiviSerie` : condition remise à `e.sort !== "parti"` (les « à compléter » disparaissent du suivi)  | **rouge**, 4 tests (f, j, constat e2e)                                             |
| M4  | `FeuilleSerie.tsx` : segment « N à compléter » retiré de la phrase                                   | **rouge**, test (e)                                                                |
| M5  | `serie-ecriture.ts` : refus `exigerTotalConfirme` retiré                                             | **rouge**, 6 tests (i + 5 tests de comportement)                                   |

(Dans les décomptes « Failed Tests » bruts, il faut ajouter Jonction 4, rouge sur master comme sur la branche.)

## 6. Remarques, non bloquantes

- Le test (i) vérifie seulement que les lignes d'argent sont présentes (garde textuelle). C'est acceptable parce que M5 montre que les tests de comportement couvrent le refus.
- Le diff répare en passant une dérive de master : le faux Claude de l'e2e et le plancher à 0,15 $, mesuré à 0,1995 $. Sans cette réparation, les tests du fichier touché seraient rouges. Cela reste dans le périmètre.
- Deux échecs préexistants sur master, hors de ce lot et non listés dans `scripts/echecs-connus.json` : Jonction 4 `paquet4-jonctions` (Zernio non relié) et `garde-ecran` (30 textes). Ils sont à traiter ailleurs.
- Côté axion-ia : `pnpm-lock.yaml` est identique entre le `main` local et `origin/main`. Rien n'a été réinstallé.
