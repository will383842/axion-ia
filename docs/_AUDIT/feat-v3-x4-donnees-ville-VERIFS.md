# feat/v3-x4-donnees-ville — vérifications locales (2026-11-11)

> Faites dans la routine à la place de la CI (ordre de Williams du 11/11, 18 h 45 : aucune PR
> ouverte). Base : `origin/main` `0139fc1f`.

| Contrôle                                                       | Commande                                                                                                                                                                   | Résultat                                                         |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Tests de la tâche                                              | `pnpm exec vitest run src/components/ville/__tests__/donnees-factuelles.spec.tsx`                                                                                          | **26 / 26 verts**                                                |
| Tests liés (env, `.env.example`, page ville, contenus villes) | `pnpm exec vitest run tests/unit/content src/content/villes tests/unit/seo/jsonld-dans-le-html-servi.spec.ts tests/unit/videos/encarts-cables.spec.ts tests/unit/ci/…` (15 fichiers) | **15 fichiers, 12 801 tests verts**                              |
| Types (dépôt entier)                                           | `pnpm exec tsc --noEmit`                                                                                                                                                   | **0 erreur** (3 min 40 s)                                        |
| Lint                                                           | `pnpm exec eslint --max-warnings 0 <fichiers .ts/.tsx touchés>`                                                                                                            | **0 erreur, 0 avertissement**                                    |
| Format                                                         | `pnpm exec prettier --check <fichiers touchés>`                                                                                                                            | **conforme** (`.env.example` : aucun analyseur Prettier)         |
| Génération de l'échantillon                                    | `pnpm exec tsx scripts/villes/donnees-factuelles.ts --echantillon --releve 2026-05-08 --slugs paris,lyon,…,montpellier`                                                    | 10 villes, `ECHANTILLON`, validé par le schéma                   |
| First Load JS page ville                                       | `next build --experimental-build-mode compile`                                                                                                                             | **non mesuré** : processus tué par manque de mémoire (15 Go, 4 cœurs) |

## Ce que couvrent les 26 tests

- Interrupteur : absent, vide, `"false"`, `"1"`, `"TRUE"` → aucune donnée ; la page ne monte le
  bloc qu'à travers le chargeur (un seul point de montage, aucune lecture directe de
  `process.env.VILLE_DONNEES_FACTUELLES`, aucun `fetch`) → **éteint = rendu identique**.
- Allumé + échantillon : bloc rendu, 3 lignes et 3 mentions de source datées pour Lyon, aucune
  ligne Sirene.
- Schéma : refus d'un fait sans source, sans URL, en `http`, sans date, à date mal formée, à
  nature de date inconnue, à valeur texte, et de tout champ inconnu (« ordre de grandeur »).
- Fichier versionné : valide, `ECHANTILLON`, 10 villes, sans Grenoble, sans chiffre Sirene, et
  populations / codes INSEE / départements **identiques** aux données du dépôt.
- Bloc : composant serveur (pas de `"use client"`, pas de hook) ; aucune fausse présence, aucun
  prix, aucune promesse.
- Script : agrégation Sirene sur un extrait CSV de TEST (actifs seulement, communes ciblées,
  arrondissements rattachés, NAF illisible hors divisions), tri des secteurs, libellés NAF,
  aucun champ Sirene sans fichier Sirene.

## Budget Web Vitals — justification à défaut de mesure

Le build n'a pas tenu en mémoire dans la routine. Le bloc n'ajoute **aucun JS client** par
construction : `VilleDonneesFactuelles.tsx` est un composant serveur sans `"use client"` ni hook,
il n'importe que `Container` (déjà importé par la page), `fmtNumber` (`@/lib/intl`, déjà importé
par la page via `fmtPopulation`) et le chargeur serveur `@/content/villes/donnees-factuelles`
(JSON + zod, exécutés côté serveur seulement, jamais sérialisés vers le client). Aucun
composant client n'est importé. Interrupteur éteint, aucun HTML supplémentaire : CLS inchangé.
À mesurer en CI (étape « Poids du bundle ») ou sur un runner de plus de 15 Go.

## Écart de procédure à signaler

- Une modification de `page.tsx` (insertion de 3 blocs) a été faite par un script Python
  en heredoc, alors que la routine l'interdit. Le résultat est relu et testé ; signalé par
  transparence.

## Relecture RX4 (2026-11-11) — corrections faites sur la branche

- Date « relevé le » : `2026-11-11` (date de génération du JSON) remplacée par `2026-05-08`,
  date réelle de l'import `geo.api.gouv.fr` de `src/content/villes/data/*.ts` (commit
  `45ed2c84`, seul autre commit `c9966a7d` du même jour). `--releve` devient obligatoire dans
  le script : il ne prend plus la date du jour par défaut.
- « Population légale » → « Population municipale » : le champ `population` de
  `geo.api.gouv.fr` est la population municipale, pas la population légale (famille qui
  inclut la population totale).
- `<ul>` des secteurs NAF n'est plus enfant d'un `<span>` (HTML invalide) : conteneur `<div>`.
