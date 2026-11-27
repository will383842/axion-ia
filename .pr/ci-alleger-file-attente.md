# CI : alléger la file d'attente (PR en brouillon)

## Quoi
1. Job `portee` (léger, PR seulement) : calcule `git diff --name-only --no-renames base...head`. Sortie `docs_seulement=true` uniquement si le calcul réussit et que TOUS les fichiers sont de la documentation (`docs/**` hors code/config, `.pr/**`, `_PLANS/**`, `*.md` hors `src/ tests/ scripts/ public/ messages/ prisma/ .github/`, hors AGENTS.md/CLAUDE.md, et hors tout fichier cité par `src`/`tests`/`scripts`). Diff vide, échec, doute : tout est lancé.
2. Si `docs_seulement=true` : morceaux de couverture et tranches Gate B sautés. Les verdicts exigés (« Gate A · couverture », « Gate B · per-PR ») gardent leur nom et passent dans ce seul cas (portee `success` + sortie `true` + job amont `skipped`). « Gate A · per-commit » et « Gate D » inchangés.
3. Sur PR seulement : couverture et Gate B ont `needs: [gate-a, portee]` et ne tournent que si Gate A est `success` (`!cancelled()`). Commentaire daté du 18/08 complété (doctrine inversée pour les PR). File de fusion, quotidien, dispatch : même comportement, ils démarrent seulement après Gate A.
4. Garde `la-suite-vitest-tourne-une-fois.spec.ts` mise à jour (needs/if des morceaux, dispense unique d'étape du verdict).

## Pourquoi
20 places de jobs gratuites partagées ; une PR = 10 jobs, ~78 min-machine ; charge ~1,4× la capacité ; runners payants refusés. Rien d'autre touché (seuils, push main, cron, lhci, merge queue).

## Gain estimé
PR docs seule : ~66 min-machine économisées. PR de code dont lint/types échouent : ~66 min évitées.

## Risques
- Une PR dont Gate A échoue ne révèle plus les défauts de tests dans la même passe.
- Le filtre « cité par src/tests » ne voit pas une lecture de dossier (`readdirSync`) : un .md hors dossiers de code, lu ainsi, peut passer pour doc. Rattrapé par le passage quotidien.
- Validation : YAML (python) ; actionlint indisponible ; `vitest tests/unit/ci` : seuls 3 fichiers échouent, pour cause de client Prisma non généré (échec identique sans mon diff).

Relecture Opus : 1re passe À CORRIGER (filtre trop large pour les .md de code ; garde de test) ; correctifs appliqués.
VERDICT OPUS : À CORRIGER
