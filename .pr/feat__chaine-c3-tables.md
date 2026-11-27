Chaîne éditoriale IA (C3) : tables de base, migration additive, rien de branché

## Ce que fait cette PR

- Ajoute six tables vides : besoins, briefs, faits (dossier de preuves), refus, résultats et propositions de l'analyste.
- Ajoute la colonne facultative `role` à `cost_ledger` (pour mesurer le coût par rôle plus tard).
- Étend `equipe/brief.ts` au lieu de créer un second schéma de brief : plan de titres H1/H2/H3, fourchette de longueur (tous facultatifs, un ancien brief reste valide). L'intention de recherche reste le champ `intention` existant, sans doublon.
- Statuts et intentions sont du texte en base : aucune énumération Postgres, donc rien à faire tolérer par un worker plus ancien.

## Sans risque pour les deux conteneurs (app et worker)

- La migration ne fait qu'ajouter : six tables neuves et une colonne facultative. Aucun DROP, UPDATE, INSERT, aucune énumération.
- Aucun code de production ne lit ni n'écrit ces tables.
- Les deux seules écritures sur `cost_ledger` qui relisaient toutes les colonnes (`cost-tracker.ts`, `blog-claude-ledger.ts`) portent maintenant un `select`. Sinon un worker neuf, arrivé avant la migration, aurait demandé la colonne `role` absente et échoué (P2022). Un test le garde.
- Horodatage `20261128000000`, postérieur à la dernière migration de main (`20261127230000`, pilotage SEO).

## Vérifié

- `prisma validate` et `generate`, `pnpm typecheck`, tests ciblés (equipe, nouveau test de migration additive), eslint et prettier.
- Le SQL de la migration est identique à celui que génère `prisma migrate diff`.
- Quatre tests de `kb-ingest/url-extractor` échouent dans cet environnement, sans lien avec cette PR (fichiers non touchés).
- Relecture par un sous-agent opus : trois tours (le 1er et le 2e ont trouvé le risque P2022 et des colonnes manquantes, corrigés). Le dernier tour porte sur le code final.
- Reste facultatif, non fait : un commentaire Prisma mal placé dans `ContenuFait`, le nom d'un champ de relation, le titre d'un test.

VERDICT OPUS : BON
