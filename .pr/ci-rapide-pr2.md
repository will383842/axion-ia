# CI rapide, PR 2 : cache webpack et Playwright de gate-b

## Ce qui change

- `ci.yml`, job `gate-b` :
  - `actions/cache@v4` sur `~/.cache/ms-playwright` (clé `pw-<hash pnpm-lock.yaml>`). L'installation
    `playwright install --with-deps chromium` est conservée : cache chaud, le navigateur n'est pas
    retéléchargé, les dépendances système restent posées.
  - `actions/cache/restore@v4` sur `.next/cache/webpack`, après « Relocate .next to /mnt » (`.next` est
    alors un bind mount : le chemin du dépôt est le bon) et avant « Build ». Clé : hash de
    `pnpm-lock.yaml`, `next.config.*`, `tsconfig.json` + sha ; `restore-keys` par préfixe.
  - `actions/cache/save@v4` après « Build », **seulement** si `schedule` et tranche 1 : une seule écriture,
    jamais depuis une PR.
- Commentaire périmé (attente du nettoyage disque / `apt-get clean`) remis en accord avec l'ordre réel.
- Garde `tests/unit/ci/gate-b-cache-sur.spec.ts` ; défaut mineur de la PR 1 corrigé dans
  `gate-a-caches-surs.spec.ts` (`project:` interdit dans la config ESLint).

## Pourquoi

La compilation webpack (~4 min) repart de zéro à chaque run. Les PR peuvent lire un cache écrit sur la
branche par défaut ; en n'écrivant que depuis le passage quotidien, on évite l'empoisonnement par une PR
et la multiplication des entrées (limite de 10 Go du dépôt).

## Comment mesurer

Sur un run `gate-b` avant/après, cache chaud : durée de l'étape **Build** et ligne
« Compiled successfully in … ». Le temps varie d'un run à l'autre sur le runner partagé : comparer
plusieurs runs (médiane). Le premier run après fusion est à froid tant que le passage quotidien n'a pas écrit le cache.
