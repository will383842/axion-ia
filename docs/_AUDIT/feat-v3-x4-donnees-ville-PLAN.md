# feat/v3-x4-donnees-ville — plan court (tâche X-4, vague 3)

> Écrit avant tout code, le 2026-11-11. Référence : `docs/knowledge/DONNEES-PAR-VILLE.md` (#1913).

## Constat de départ

- Aucun accès réseau dans la routine (geo.api.gouv.fr, insee.fr et recherche-entreprises
  refusés par le proxy) : impossible de télécharger le Stock Sirene ici.
- Les seules données publiques déjà présentes dans le dépôt sont celles de
  `src/content/villes/data/*.ts` (population, département, région, code INSEE), importées
  de `geo.api.gouv.fr` par `scripts/import-insee-villes.ts`.

## Ce que livre la branche

1. **Schéma** `src/content/villes/donnees-factuelles/schema.ts` (zod) : chaque fait est
   `{ valeur, source, url, date, natureDate }`. Aucun fait sans source ni date (refusé par le
   schéma). Champs : population, département, région, établissements actifs (Sirene),
   secteurs dominants (divisions NAF, Sirene). Tous optionnels : un champ absent ne s'affiche pas.
2. **Script reproductible** `scripts/villes/donnees-factuelles.ts` :
   - lit les données INSEE déjà versionnées (population, département, région) ;
   - lit, si on lui donne `--sirene <chemin>`, un Stock Sirene établissements **téléchargé à la
     main** (data.gouv.fr), agrège les établissements actifs par commune et par division NAF ;
   - écrit `src/content/villes/donnees-factuelles/donnees.json`, validé par le schéma.
   - Fonctions pures dans `scripts/villes/lib/donnees-factuelles.ts`, testées sur un extrait CSV
     fictif de test (jamais affiché).
3. **Échantillon de 10 villes**, marqué `"statut": "ECHANTILLON"` : uniquement population,
   département, région repris du dépôt. **Aucun chiffre Sirene** (source non téléchargée) :
   ces lignes ne s'affichent donc pas. Grenoble exclue de l'échantillon.
4. **Bloc** `src/components/ville/VilleDonneesFactuelles.tsx` : composant serveur, aucun JS
   client, chaque ligne affiche sa source et sa date. Rien si aucune donnée.
5. **Interrupteur `VILLE_DONNEES_FACTUELLES`** (`true`/`false`, défaut éteint) déclaré dans
   `src/env.ts`, documenté commenté dans `.env.example`. Éteint : la page ne rend pas le bloc
   et n'importe que le JSON (rendu HTML identique).
6. **Tests** (vitest ciblé) : éteint = rien ; allumé + échantillon = bloc ; aucune donnée sans
   source ; schéma du fichier valide ; agrégation Sirene sur l'extrait de test ; aucune fausse
   présence ni prix dans le bloc.

## Hors périmètre

- `src/content/villes/copy/**` (non touché), générateur IA, base de données, rapport d'écarts.
- Aucun appel réseau au build ni à l'exécution.

## Vérifications locales (pas de PR : ordre CI du 11/11)

vitest ciblé, `pnpm exec tsc --noEmit`, eslint + prettier sur les fichiers touchés, mesure
First Load JS si possible. Résultats dans `feat-v3-x4-donnees-ville-VERIFS.md`, description de PR
dans `feat-v3-x4-donnees-ville-PR-BODY.md`.
