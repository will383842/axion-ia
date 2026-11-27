# Pilotage SEO et GEO, P2 : migration « mesure »

## Ce que fait cette PR

Elle ajoute les **sept tables** qui recevront, plus tard, les mesures de la Search Console. Rien ne les remplit ni ne les lit pour l'instant : c'est le socle de la PR P4 (worker et ingestion).

Tables : `gsc_import_runs`, `gsc_page_jours`, `gsc_requetes`, `gsc_page_requete_jours`, `gsc_page_requete_semaines`, `gsc_inspections`, `seo_opportunites`.

## La migration est additive

- Sept `CREATE TABLE IF NOT EXISTS` et des index, **rien d'autre** : aucun `DROP`, `DELETE`, `UPDATE` ni `ALTER`.
- **Aucune table existante n'est touchée**, aucune colonne retirée ni renommée.
- Aucune clé étrangère, aucune énumération Postgres. `siteRouteId` est une colonne nullable sans clé étrangère. L'état d'une opportunité est une chaîne (`ouverte`, `ecartee`, `traitee`).
- Le SQL est identique à ce que Prisma génère pour le schéma (vérifié avec `prisma migrate diff`).
- Nom : `20261127170000_pilotage_seo_mesure`. Les modèles sont dans un bloc distinct et commenté, en fin de `schema.prisma`, pour ne pas se heurter à l'autre chantier (`team_members`). Fusion de `origin/main` faite sans conflit.

## Le worker n'est pas concerné

Aucun code ne lit ni n'écrit ces tables dans cette PR : ni l'application, ni le worker. Aucune file, aucune tâche, aucun contrat app/worker n'est modifié. La fenêtre de ~50 minutes entre les deux conteneurs ne pose donc aucun risque, dans un sens comme dans l'autre.

## Après la mise en ligne

L'entrypoint migre en « au mieux » : un déploiement vert ne prouve pas que le schéma a bougé. Vérifier avec `prisma migrate status` en production (voir `AGENTS.md`).

## Données personnelles et durées de conservation

- Chaque modèle porte l'annotation `rgpd: technique — <motif>`. Le motif de `gsc_requetes` dit honnêtement qu'un nom inconnu de la base peut subsister dans le texte d'une requête.
- `SeoOpportunite.details` ne doit contenir que des mesures et des `requeteId`, jamais le texte d'une requête.
- **La purge n'existe pas dans cette PR** : elle viendra en P4, et aucune donnée n'est écrite avant. Durées visées : 90 jours pour le détail journalier page × requête, 25 mois pour le détail hebdomadaire. La règle de purge du texte des requêtes rares (moins de 3 impressions sur 90 jours) devra être arrêtée en P4 en cohérence avec les 25 mois : à trancher avant d'écrire la purge.
- La durée de `GscPageJour` est à fixer après la mesure de la première semaine.
- Index : quatre index redondants (préfixes des clés uniques) ont été retirés pour alléger les écritures.

## Points à garder en tête pour P4

- `texte` est limité à 512 caractères, `chemin` et `cible` à 1000 : l'ingestion devra tronquer ou écarter, et le compter, sinon un lot entier échoue.
- Le Proxy du stub Prisma (build GitHub Actions) répond à vide pour `groupBy` et `aggregate`, mais `aggregate` ne rend que `{ _count: { _all: 0 } }` : une page rendue au build qui lirait `_sum` planterait.

## Tests et vérifications

- Nouveau test `tests/unit/ci/pilotage-seo-mesure-migration-additive.spec.ts` (17 tests) : migration sans instruction destructrice (avec contre-témoins), sept tables exactement, présence des `@@unique` et des index, annotations `rgpd`, absence de clé étrangère, Proxy du stub.
- `prisma validate`, `prisma generate`, lint, prettier : verts. Gardes RGPD existantes : vertes.
- Relecture par deux agents Opus (exactitude, puis audit données), deux tours. Défauts mineurs corrigés : contre-témoins plus probants, commentaires de rétention, index redondants.

Ouvrir en **brouillon** (règle CI-LOT1).

VERDICT OPUS : BON
