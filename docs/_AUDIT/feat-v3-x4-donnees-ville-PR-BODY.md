# feat(villes) : repères publics sourcés sur les pages ville, derrière un interrupteur éteint (X-4)

> Description prête à coller. **Aucune PR n'a été ouverte** (ordre de Williams du 11/11, 18 h 45 :
> la CI GitHub est saturée). Vérifications locales : `docs/_AUDIT/feat-v3-x4-donnees-ville-VERIFS.md`.

## Pourquoi

Le plan `docs/knowledge/DONNEES-PAR-VILLE.md` (#1913) constate que les faits locaux des pages
ville viennent de la mémoire du modèle, sans vérification. Cette PR pose la première brique de
remplacement : des faits **lus dans des sources publiques**, chacun avec **sa source et sa
date**, affichés dans un bloc qui **ne s'affiche pas** quand la donnée manque.

## Ce que fait la PR

- **Schéma** `src/content/villes/donnees-factuelles/schema.ts` (zod, strict) : chaque fait est
  `{ valeur, source, url (https), date (AAAA-MM ou AAAA-MM-JJ), natureDate }`. Un fait sans
  source, URL ou date, un champ inconnu (« ordre de grandeur ») ou une valeur en texte libre
  font rejeter le fichier entier.
- **Script reproductible** `pnpm villes:donnees-factuelles` (`scripts/villes/donnees-factuelles.ts`) :
  hors ligne, il lit les données INSEE déjà versionnées (population, département, région) et,
  si on lui passe `--sirene <fichier> --millesime AAAA-MM`, le **Stock Sirene des établissements
  téléchargé à la main** sur data.gouv.fr, lu en flux, pour compter les établissements actifs et
  les 5 divisions NAF dominantes par commune (arrondissements de Paris, Lyon, Marseille
  rattachés). Libellés NAF optionnels (`--naf-libelles`), sinon « Division NAF 62 ».
- **Échantillon de 10 villes**, marqué `"statut": "ECHANTILLON"` (Paris, Lyon, Marseille,
  Toulouse, Nantes, Bordeaux, Lille, Rennes, Strasbourg, Montpellier) : population, département
  et région **repris à l'identique** des données du dépôt (test d'égalité). **Aucun chiffre
  Sirene** : le fichier n'a pas pu être téléchargé dans la routine (pas de réseau), donc ces
  lignes ne s'affichent pas.
- **Bloc** `VilleDonneesFactuelles` : composant serveur, aucun JS client, chaque ligne porte
  « Source : …, relevé le … » ou « données de octobre 2026 » pour un millésime.
- **Interrupteur `VILLE_DONNEES_FACTUELLES`** (déclaré dans `src/env.ts`, commenté dans
  `.env.example`) : actif seulement si `"true"`. Éteint, le chargeur rend `null` et la page ne
  monte pas le bloc : **rendu identique à aujourd'hui**.

## Ce que la PR ne fait pas

- Ne touche pas `src/content/villes/copy/**`, ni le générateur IA, ni la base.
- Aucun appel réseau, ni au build ni au rendu. Le script ne s'exécute jamais pendant `next build`
  (contrat `stub.invalid`, ADR 0026).
- Aucune mention de présence locale, aucun prix (testé).

## Avant d'allumer (décision de Williams)

1. Télécharger le Stock Sirene établissements et lancer le script avec `--sirene` et
   `--millesime`, relire le JSON produit en PR.
2. La date « relevé le » de la population (municipale) est celle de l'import
   `geo.api.gouv.fr` des données du dépôt (2026-05-08, commit `45ed2c84`), passée
   obligatoirement par `--releve`. L'API ne publie pas le millésime INSEE : à remplacer par
   ce millésime si l'on branche le fichier des populations légales.
3. Puis `VILLE_DONNEES_FACTUELLES=true` sur l'application (Coolify), sans rebuild pour les
   pages ISR (lecture de `process.env` au rendu ; les ~40 pages pré-rendues au build prennent
   la valeur à la régénération suivante).

## Vérifications

Voir `docs/_AUDIT/feat-v3-x4-donnees-ville-VERIFS.md` : vitest ciblé (26 tests + 15 fichiers
liés), `tsc --noEmit` complet, eslint et prettier sur les fichiers touchés, mesure First Load JS.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01Qdj3f7cjzcox7gzaXiA6W2
