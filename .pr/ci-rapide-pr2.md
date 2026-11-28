# CI rapide, PR 2 : cache webpack et Playwright de gate-b

## Ce qui change (après relecture Opus, « A CORRIGER »)

Gate B ne tourne pas sur `schedule` : la sauvegarde du cache dans `gate-b` était inatteignable.

- `ci.yml`, job `gate-b` : **restaure seulement** (`actions/cache/restore@v4`) le cache webpack
  (`.next/cache/webpack`, après « Relocate .next to /mnt », avant « Build ») et les navigateurs Playwright
  (clé exacte `pw-<hash pnpm-lock.yaml>`, SANS `restore-keys` ; `playwright install --with-deps chromium`
  reste lancé après la restauration). Plus aucune étape de sauvegarde.
- Nouveau job `gate-b-cache-chauffe` : `if: github.event_name == 'schedule' || (github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main')`.
  Checkout, pnpm/node, install, Prisma, libération du disque, Playwright (+ `actions/cache/save`), Relocate,
  Build (mêmes stubs), `actions/cache/save` du cache webpack (même clé que la restauration). Non exigé, hors
  `gate-b-verdict`, jamais sur `pull_request` ni `merge_group`.
- Commentaire du `cron` corrigé : Gate B ne tourne pas sur `schedule`.
- Garde `tests/unit/ci/gate-b-cache-sur.spec.ts` durcie (voir ci-dessous) ; `gate-a-caches-surs.spec.ts`
  (`project:` interdit dans la config ESLint) inchangée depuis la PR.

## Mutations (les gardes rougissent)

| Mutation                                                                 | Résultat             |
| ------------------------------------------------------------------------ | -------------------- |
| sauvegarde ajoutée dans `gate-b`                                         | rouge (tests a et b) |
| `\|\| github.event_name == 'pull_request'` ajouté au `if:` de la chauffe | rouge (tests b et c) |
| `restore-keys: pw-` sur le cache Playwright                              | rouge                |
| `--with-deps` supprimé de `playwright install`                           | rouge                |

`ci.yml` restauré après chaque mutation.

## Procédure de mesure

1. Après fusion : `gh workflow run ci.yml --ref main` (ou attendre le passage quotidien) pour chauffer les caches.
2. Relever la taille de l'entrée `gate-b-webpack-v1-*` (onglet Caches) et la durée de « Cache webpack — restauration » :
   si l'archive pèse plusieurs Go, le téléchargement peut manger le gain.
3. Comparer l'étape **Build** d'un run `gate-b` de PR avant/après (médiane de plusieurs runs : le temps varie sur
   le runner partagé). Le premier run après fusion est à froid tant que la chauffe n'a pas écrit.
