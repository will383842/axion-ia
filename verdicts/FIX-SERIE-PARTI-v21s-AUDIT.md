VERDICT OK sha=96c2af63 (AUDIT) — 7 fichiers (3 src, 4 tests), aucun chemin interdit ; vitest des 4 fichiers touchés + 9 fichiers série voisins : seuls rouges = 3 échecs identiques sur master ; tsc 0 erreur ; eslint propre ; 5 mutations, toutes rouges (M1 restes, M2 toujours « parti », M3 phrase, M4 suivi, M5 = mutation restée verte à l'audit précédent, rouge désormais).

# Audit FIX-SERIE-PARTI-v21s — argent, sécurité, données

Tête vérifiée : `origin/video/FIX-SERIE-PARTI-v21s` = `96c2af63951ce9231ae9716203eb67d8c185f94b` (inchangée).
Dépendances : `pnpm install --frozen-lockfile` (magasin pnpm dans un répertoire temporaire), sans erreur.
Le code du Studio n'a pas été modifié ; les mutations ont été faites en local puis annulées (`git checkout src`).

Suite de l'audit précédent (sha b78179da, « à corriger ») : la correction demandée est faite et prouvée par M5 (voir la section 5).

## 1. Périmètre du diff (`git diff --stat origin/master...HEAD`)

| Fichier | +/- |
| --- | --- |
| src/app/(studio)/ecrire/serie/actions.ts | 6 |
| src/components/generateur/FeuilleSerie.tsx | 9 |
| src/services/serie-ecriture.ts | 20 |
| tests/e2e-verif1-bc-serie.test.ts | 11 |
| tests/l2-13c-plafonds-claude.test.ts | 5 |
| tests/paquet4-jonctions.test.ts | 3 |
| tests/serie-hors-domaine-v21s.test.ts (nouveau) | 163 |

Petit et cohérent avec le nom de la branche : une idée de série arrêtée à 0 € sur un manque reçoit le statut neuf `sort: "a-completer"` (avec `manque`), au lieu de `"parti"`.
Aucun fichier sous `.github/**`, `deploiement/**`, `outils/gardes/**`, ni `scripts/echecs-connus.json`. Aucun secret, aucune clé, aucune donnée de personne dans le diff.

## 2. Argent (chemins payants)

- `lancerGeneration`, `calculerPlanSerie`, `planSerie`, `exigerTotalConfirme` et l'appel `await exigerTotalConfirme(plan, totalConfirme, partirontConfirme, origine)` ne sont **pas touchés** par le diff (lu ligne à ligne). Les plafonds Claude (`plafondChaineUsd`, `plafondMensuelClaudeUsd`, `engageClaudeDuMoisCentimes`) ne sont pas modifiés. Le changement porte seulement sur le **libellé** du résultat de `lancerGeneration` (`lance.ok`), une fois l'appel rendu.
- Le refus avant l'appel est inchangé : une idée hors domaine s'arrête dans `lancerSurSujet` (`donneesDe` → `z.ok === false`), avant tout appel Claude. Le test neuf le prouve avec un faux `fetch` qui lève une erreur à chaque appel : `appelsClaude` vaut 0 en (a) et en (c).
- **Seuil de test abaissé, examiné** : `tests/e2e-verif1-bc-serie.test.ts:280`, `fantomes > 0.25` devient `> 0.15`. Valeur mesurée sur la branche : **0,199513 $** (pire cas d'un appel `angle` de la chaîne courte). Sur master, ce fichier est **rouge sur 9 tests** : le faux Claude ne connaissait pas les rôles `ROLES_CHAINE_COURTE*`. Le recalage suit donc master ; il n'affaiblit pas la garde. Les assertions qui portent l'argent restent strictes : `plafondUsd` vaut exactement l'ancien plafond plus les fantômes (`toBeCloseTo(…, 6)`), la dépense reste ≤ plafond, et un second relèvement vaut 0.
- `tests/l2-13c-plafonds-claude.test.ts` (« fondateur ») : `["parti" ×3]` devient `["a-completer" ×3]`, car ces idées n'ont pas de matière. Le test garde ses deux promesses : aucun refus, et aucun montant dans le texte écrit. Il ajoute une assertion (aucun `refuse` ni `reste`). Le comportement d'argent n'a pas changé : ces idées s'arrêtaient déjà à 0 € sur master, sous l'étiquette « parti ».

## 3. Données

Rien n'est supprimé. L'idée reste reliée à son sujet (`d.idees.modifier(ideeId, { scriptMaitreId })` est toujours appelé ; test (g)). Le même geste renvoyé avec la même clé redonne la même série, sans sujet de plus (test (h)). Les anciennes séries en base, où l'étiquette est encore « parti », sont lues comme avant par `suiviSerie`. Le seul consommateur de `ElementSerie.sort` est `serie-ecriture.ts` et `actions.ts` (recherche faite dans `src/`).

## 4. Tests lancés (branche `96c2af63`)

- `npx vitest run` sur les 4 fichiers de tests touchés : 40 réussis, 1 en échec, `paquet4-jonctions` « Jonction 4 » (ZERNIO_NON_RELIE). Ce test est **rouge aussi sur master** et n'a pas de lien avec la série.
- Sur 13 fichiers liés à la série (c5-serie-ecriture, ciblage/relecture-c2c3, e2e-verif1-bc-serie, garde-ecran, l2-13c, ordre-25-10/formats-sans-accord, paquet4-jonctions, paquet4-relecture-exactitude, paquet4-rerelecture-exactitude, r7-origine-usine-serie, serie-hors-domaine-v21s, stk-02-mes-textes, c1-argent-b6-confirmation) : **120 réussis, 3 en échec, tous présents sur master** :
  - `c1-argent-b6-confirmation` (B6) : déjà listé dans `scripts/echecs-connus.json`.
  - `garde-ecran` : les 30 constats sont **identiques** sur master et sur la branche (comparaison triée des fichiers et règles) ; aucun ne vient du diff.
  - `paquet4-jonctions` Jonction 4 : rouge sur master (ZERNIO_NON_RELIE). ⚠️ Il n'est pas listé dans `echecs-connus.json`. C'est une dette de master, pas de cette branche.
- Effet de bord positif : `e2e-verif1-bc-serie` est **rouge sur 9 tests sur master**, et **vert sur la branche**.
- `npx tsc --noEmit -p .` : 0 erreur sur la branche, 0 sur master.
- `npx eslint` sur les 7 fichiers touchés : aucun constat.

## 5. Mutations (chacune annulée après usage) — toutes rouges

| # | Mutation | Tests rouges |
| --- | --- | --- |
| M1 | `actions.ts` : `restes` revient à « tout ce qui n'est pas parti » | (c), (e), (j) |
| M2 | `serie-ecriture.ts` : toujours `sort: "parti"` (sans `lance.ok`) | (a), (b), (c), (e), (g), (j) |
| M3 | `FeuilleSerie.tsx` : la phrase n'affiche plus le compte « hors du domaine » | (e) |
| M4 | `suiviSerie` : `a-completer` traité comme « reste » | (f), (j) |
| M5 | `FeuilleSerie.tsx` : `${aCompleter}` affiché à la place de `${horsDomaine}`. Restée verte à l'audit précédent (sha b78179da) ; elle **rougit** désormais, car `phraseLancementSerie` est une fonction pure, appelée par `FeuilleSerie` et testée avec les comptes 3/1/2/1 et 1/4/3/2 | (e) |

## 6. Comportements ajoutés et test qui les nomme

- Une idée hors domaine n'est pas « partie » : test (a).
- Le Journal dit le nombre d'idées hors domaine et à compléter (y compris en essai) : tests (b) et (c).
- Les autres manques sont classés « à compléter », séparés de « hors domaine » : test (c).
- Le comportement ne change pas si toutes les idées sont du domaine : test (d).
- L'action et la phrase de notification donnent chaque compte à sa place : test (e).
- Le suivi garde « À compléter » : test (f). Le lien entre l'idée et son sujet est gardé : test (g). La reprise du même geste est idempotente : test (h). Une idée refusée compte dans « restes » : test (j).

## Remarques (non bloquantes)

- Le test (i) vérifie seulement la présence de 4 chaînes dans `serie-ecriture.ts` : c'est une garde faible. La preuve réelle que l'argent n'a pas bougé est la lecture du diff (section 2).
- `paquet4-jonctions` « Jonction 4 » est rouge sur master et absent de `scripts/echecs-connus.json` : à traiter dans un lot à part.
- Sur l'axion-ia, `pnpm-lock.yaml` n'a pas été réinstallé ; ce verdict ne touche aucun code.
