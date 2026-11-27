VERDICT A CORRIGER sha=0fb9246c (AUDIT) : src/components/generateur/FeuilleSerie.tsx:97, la phrase de notification (« N hors du domaine d'Axion-IA · M à compléter · K gardée(s) en idée ») n'est prouvée par aucune exécution : extraire sa construction dans une fonction pure (ex. `phraseLancementSerie({ partis, restes, horsDomaine, aCompleter })`), l'appeler depuis FeuilleSerie et la tester avec des comptes distincts (ex. 3/1/2/1), car la mutation « afficher aCompleter à la place de horsDomaine » reste verte.

## Contrôles

- Tête de `origin/video/FIX-SERIE-PARTI-v21s` : `0fb9246ccf41f5a081cc2ef9d651750880b36b9a`, conforme (0fb9246c).
- Dépendances : `pnpm install --frozen-lockfile` (avec un magasin local `--store-dir /tmp/pnpm-store`, le magasin global étant en lecture seule), lockfile inchangé.

## Diff (`origin/master...origin/video/FIX-SERIE-PARTI-v21s`) : 7 fichiers, +195 / -17

- `src/services/serie-ecriture.ts` : nouveau sort `"a-completer"` + champ `manque` quand `lancerGeneration` rend `ok: false` (arrêt à 0 €) ; ligne de Journal séparant hors domaine et « à compléter » ; le suivi traite `a-completer` comme un sujet existant.
- `src/app/(studio)/ecrire/serie/actions.ts` : `restes` = `reste` + `refuse` seulement ; compteurs facultatifs `horsDomaine` et `aCompleter`.
- `src/components/generateur/FeuilleSerie.tsx` : phrase de notification avec les deux nouveaux compteurs.
- Tests : `tests/serie-hors-domaine-v21s.test.ts` (nouveau, 10 cas), et 3 tests existants recalés.
- Le diff est petit et cohérent avec le nom de la branche. Il ne touche ni `.github/**`, ni `deploiement/**`, ni `outils/gardes/**`, ni `scripts/echecs-connus.json`. Aucun secret (recherche `sk-|api_key|secret|password|token` dans le diff : rien).

## Argent, sécurité, données

- Aucune ligne d'argent modifiée : `calculerPlanSerie`, `planSerie`, `exigerTotalConfirme` et leur appel sont intacts (vérifié dans le diff et verrouillé par le cas (i)). Le plafond et le refus avant appel restent ceux de master : le chemin `ok: false` de `lancerGeneration` est un arrêt avant tout appel Claude (cas (a) et (c) : `appelsClaude` = 0 avec un faux fetch qui interdit tout).
- Aucune donnée de personne supprimée ni exposée ; l'idée liée garde son `scriptMaitreId` (cas (g)).
- Gardes de test :
  - `tests/e2e-verif1-bc-serie.test.ts:280` : le plancher passe de `> 0.25` à `> 0.15`. Valeur mesurée sur la branche : `fantomes = 0.199513` (le commentaire annonce ~0,20 $). Le recalage est justifié, et ce fichier était **rouge sur master** (9 échecs : le faux Claude ne connaissait pas les rôles de la chaîne courte). La branche le remet au vert ; ce n'est pas un affaiblissement.
  - `tests/l2-13c-plafonds-claude.test.ts:152` : les 3 idées (hors domaine) passent de `parti` à `a-completer`. La promesse « aucune limite ne retient, aucun refus » est gardée par `plan.partiront === 3` et l'absence de `refuse`/`reste`. Remarque, antérieure à la branche : ces idées s'arrêtent avant la garde d'argent, donc ce test n'a jamais prouvé qu'une écriture du fondateur passe les plafonds jusqu'à l'appel. Non bloquant ici.
  - `tests/paquet4-jonctions.test.ts:108` : recalé (`["parti", "a-completer"]` + `manque HORS_DOMAINE`), plus précis qu'avant.

## Tests lancés (branche)

`npx vitest run tests/serie-hors-domaine-v21s.test.ts tests/e2e-verif1-bc-serie.test.ts tests/l2-13c-plafonds-claude.test.ts tests/paquet4-jonctions.test.ts` : **40 passés, 1 échec**. L'échec, `paquet4-jonctions` « Jonction 4 · rappel « Votre marque » … geste TikTok » (`ZERNIO_NON_RELIE`), est **antérieur** : il échoue à l'identique sur `origin/master` et n'a aucun lien avec le diff.

Sur master, pour comparaison : `e2e-verif1-bc-serie` + `paquet4-jonctions` = 10 échecs sur 23 (9 dans e2e-verif1, corrigés par la branche).

`npx tsc --noEmit -p .` : 0 erreur sur la branche, 0 sur master.

## Mutations (toutes annulées ensuite, `git status` propre)

1. `serie-ecriture.ts` : une idée arrêtée à 0 € redevient `sort: "parti"` → **8 échecs** (rouge ✔).
2. `actions.ts` : `restes` recompte tout ce qui n'est pas `parti` → **3 échecs** (rouge ✔).
3. `serie-ecriture.ts` : le suivi ignore de nouveau `a-completer` → **3 échecs** (rouge ✔).
4. `FeuilleSerie.tsx:97` : la phrase affiche `${aCompleter}` à la place de `${horsDomaine}` → **0 échec** (reste VERTE ✘).

## Ce qui bloque

Le cas (e), « l'action et la notification », ne prouve la notification que par la présence de chaînes dans le source (`toContain("hors du domaine d'Axion-IA")`, `toMatch(/horsDomaine/)`). Une notification qui donne à Will un mauvais compte (mutation 4) reste verte. Le comportement ajouté côté écran n'a donc pas de test qui exécute sa promesse. Correction demandée : extraire la phrase dans une fonction pure et la tester (comptes distincts, ordre des segments, cas sans aucun manque identique à master : « 3 idées en écriture »).
