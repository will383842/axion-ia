VERDICT A CORRIGER sha=b78179da (AUDIT) : src/components/generateur/FeuilleSerie.tsx:97, la correction demandée par l'audit précédent (sha 0fb9246c) n'est pas faite : la phrase de notification n'est toujours exécutée par aucun test (tests/serie-hors-domaine-v21s.test.ts (e) ne fait que lire le source) et la mutation « `${aCompleter}` affiché à la place de `${horsDomaine}` » reste VERTE (10/10). Extraire `phraseLancementSerie({ partis, restes, horsDomaine, aCompleter })` en fonction pure, l'appeler depuis FeuilleSerie et la tester avec des comptes distincts (ex. 3/1/2/1).

# Audit argent / sécurité / données — studio-axion-ia-public, branche video/FIX-SERIE-PARTI-v21s

- Tête vérifiée : `b78179da5cedaa125cea4f5a03ec37681e184f43` (tête inchangée).
- Ce verdict remplace celui de l'audit précédent (sha `0fb9246c`, commit `28d3fbebf` de cette branche). Depuis, la branche n'a reçu que des fusions de `origin/master` : le diff utile est le même, et son unique reproche reste valable.
- Diff jugé seul (pas de fiche : dépôt des plans privé). Studio en lecture seule : mutations locales annulées, `git status` propre en fin d'audit.
- Dépendances : `pnpm install --frozen-lockfile` (magasin local, le magasin par défaut est en lecture seule).

## Le reproche bloquant

`FeuilleSerie.tsx:97` construit la notification dans le composant, en ligne. Test (e) : `expect(f).toContain("hors du domaine d'Axion-IA")`, `toMatch(/horsDomaine/)`, `toMatch(/aCompleter/)` sur le TEXTE du fichier. Mutation jouée sur b78179da :

```diff
- ${horsDomaine ? ` · ${horsDomaine} hors du domaine d'Axion-IA` : ""}
+ ${horsDomaine ? ` · ${aCompleter} hors du domaine d'Axion-IA` : ""}
```

Résultat : `tests/serie-hors-domaine-v21s.test.ts` 10/10 VERT ; `tests/garde-ecran.test.ts` et `tests/paquet4-jonctions.test.ts` (les deux autres fichiers qui citent FeuilleSerie) ne rougissent que sur leurs échecs déjà présents sur master (voir plus bas). Will lirait « 1 hors du domaine » pour 2 idées hors domaine : la promesse principale de la branche (dire vrai sur ce qui est parti) n'est pas prouvée à l'écran.

## Diff (`git diff --stat origin/master...origin/video/FIX-SERIE-PARTI-v21s`)

```
src/app/(studio)/ecrire/serie/actions.ts   |   6 +-
src/components/generateur/FeuilleSerie.tsx |   4 +-
src/services/serie-ecriture.ts             |  20 ++--
tests/e2e-verif1-bc-serie.test.ts          |  11 +-
tests/l2-13c-plafonds-claude.test.ts       |   5 +-
tests/paquet4-jonctions.test.ts            |   3 +-
tests/serie-hors-domaine-v21s.test.ts      | 163 +++++++++++++++++++++++++++++
```

Petit et conforme au nom : une idée de la série arrêtée à 0 € (`lancerGeneration` rend `ok: false`) prend le sort `a-completer` (avec `manque`) au lieu de `parti`. Aucun fichier sous `.github/**`, `deploiement/**`, `outils/gardes/**`, `scripts/echecs-connus.json` ; aucun secret ; `pnpm-lock.yaml` identique à master.

## Argent — conforme

- Aucune ligne de chemin payant modifiée : `calculerPlanSerie`, `planSerie`, `exigerTotalConfirme` et son appel sont ceux de master. Le changement est en aval de `lancerGeneration` (classement du résultat), jamais avant l'appel.
- Les tests branchent Claude sur un `fetch` qui interdit tout réseau : 0 appel dans (a) et (c).
- `tests/e2e-verif1-bc-serie.test.ts` : plancher de l'appel fantôme abaissé de `> 0,25` à `> 0,15` $. Valeur mesurée : **0,199513 $** (pire cas du rôle « angle » de la chaîne courte). La promesse tient (l'appel sans réponse reste compté, rien d'effacé). Ce fichier était **rouge sur master** (10 échecs : le faux Claude ne connaissait pas les rôles de la chaîne courte) ; la branche le répare. Vert sur la branche.
- `tests/l2-13c-plafonds-claude.test.ts` : `parti ×3` → `a-completer ×3`. Pas un affaiblissement : sur master ces idées s'arrêtaient déjà à 0 € et étaient mal étiquetées ; `plan.partiront === 3`, aucun `refuse`/`reste`, aucun montant écrit restent vérifiés.

## Données — conforme

Aucune suppression. Idée de « Idées » hors domaine reliée à son sujet (g) ; idée refusée comptée dans « restes » (j) ; même geste renvoyé = même série, aucun sujet de plus (h).

## Tests lancés (branche)

- `npx vitest run tests/serie-hors-domaine-v21s.test.ts tests/e2e-verif1-bc-serie.test.ts tests/l2-13c-plafonds-claude.test.ts tests/paquet4-jonctions.test.ts` → 40 passés, 1 échec : `paquet4-jonctions` « Jonction 4 · rappel … geste TikTok » (`ZERNIO_NON_RELIE`) — **identique sur origin/master**, sans lien.
- `tests/garde-ecran.test.ts` : « aucun texte affiché … jargon technique » rouge — **identique sur origin/master**, sans lien.
- Autres consommateurs du sort de série (`c5-serie-ecriture`, `ciblage/relecture-c2c3`, `ordre-25-10/formats-sans-accord`, `paquet4-relecture-exactitude`, `paquet4-rerelecture-exactitude`, `r7-origine-usine-serie`) → 60/60.
- `npx tsc --noEmit -p .` (heap 8 Go) : 154 erreurs sur la branche, 154 sur master, mêmes lignes (seul l'ordre d'affichage des unions diffère ; `remotion` absent, etc.). **Aucune erreur neuve.**

## Mutations

| #   | Mutation                                                      | Résultat                        |
| --- | ------------------------------------------------------------- | ------------------------------- |
| M1  | `serie-ecriture.ts` : `lance.ok` → `true`                     | ROUGE : (a) (b) (c) (e) (g) (j) |
| M2  | `actions.ts` : `restes` = `sort !== "parti"`                  | ROUGE : (c) (e) (j)             |
| M3  | `suiviSerie` : `a-completer` ignoré                           | ROUGE : (f) (j)                 |
| M4  | Journal sans « hors du domaine »                              | ROUGE : (b) (c)                 |
| M5  | Notification sans « hors du domaine »                         | ROUGE : (e) (lecture du source) |
| M6  | Notification : `${aCompleter}` à la place de `${horsDomaine}` | **VERTE** → bloquant            |

## Pour passer OK

1. Fonction pure exportée (ex. `src/components/generateur/phrase-serie.ts` ou dans `domaine/`) qui rend la phrase à partir de `{ partis, restes, horsDomaine, aCompleter }` ; FeuilleSerie l'appelle.
2. Test exécuté avec des comptes tous distincts (ex. partis 3, restes 1, horsDomaine 2, aCompleter 1) qui vérifie la phrase exacte, et le cas sans aucun manque (phrase inchangée).
3. Rejouer M6 : doit rougir.

Réserve non bloquante : plancher `> 0,15` à 0,05 $ sous la mesure ; un `toBeCloseTo(0.1995, 3)` serait plus serré.
