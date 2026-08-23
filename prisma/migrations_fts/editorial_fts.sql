-- Axion-IA · Console éditoriale — recherche plein texte (§2 bis B, critère 6)
--
-- À appliquer manuellement APRÈS les migrations Prisma :
--   psql $DATABASE_URL -f prisma/migrations_fts/editorial_fts.sql
--
-- Pattern strictement aligné sur `0002_fts_setup.sql` et `kb_fts_setup.sql` :
-- colonnes `GENERATED ALWAYS ... STORED`, config `fr_unaccent`, index GIN.
-- Le plan le demandait explicitement : « index Postgres tsvector en français,
-- ajouté par migration SQL brute — c'est déjà la convention du dépôt ».
--
-- Pourquoi hors de `schema.prisma` : Prisma 5.22 ne sait pas générer une
-- colonne tsvector calculée. La doctrine FTS vit donc hors `prisma migrate`,
-- mais elle est tracée ici pour être reproductible.
--
-- ⚠️ CE FICHIER EST FACULTATIF POUR QUE LA CONSOLE FONCTIONNE.
--
-- La recherche détecte l'absence de ces colonnes et retombe sur un `contains`
-- insensible à la casse. C'est plus lent et moins pertinent — pas de
-- pondération, pas d'insensibilité aux accents — mais ça marche. Une
-- fonctionnalité qui exige un geste manuel pour ne pas tomber en panne est
-- une fonctionnalité qui tombera en panne.
--
-- La configuration `fr_unaccent` est créée par `docker/postgres/init.sql` à
-- l'initialisation du conteneur.

-- ============================================================
-- PUBLICATIONS (ed_publications.search_vector)
-- ============================================================
--
-- Pondération, du plus au moins déterminant :
--   A  titre interne      — ce qu'on tape quand on cherche « la publication X »
--   B  accroche           — la première ligne, celle dont on se souvient
--   C  corps              — le texte, volumineux, donc dilué
--   D  premier commentaire — utile mais rarement ce qu'on cherche

ALTER TABLE ed_publications
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('fr_unaccent', coalesce(titre_interne, '')),       'A') ||
    setweight(to_tsvector('fr_unaccent', coalesce(accroche, '')),            'B') ||
    setweight(to_tsvector('fr_unaccent', coalesce(corps, '')),               'C') ||
    setweight(to_tsvector('fr_unaccent', coalesce(premier_commentaire, '')), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS ed_publications_search_idx
  ON ed_publications USING GIN (search_vector);

-- ============================================================
-- ASSETS (ed_assets.search_vector)
-- ============================================================
--
-- La transcription est le gros du gisement : le §7 du lot 1 exige qu'on
-- retrouve « un asset par un mot de sa TRANSCRIPTION ». Sans elle, la
-- médiathèque n'est cherchable que par son libellé, c'est-à-dire par ce
-- qu'on a bien voulu taper à la main.

ALTER TABLE ed_assets
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('fr_unaccent', coalesce(libelle, '')),       'A') ||
    setweight(to_tsvector('fr_unaccent', coalesce(transcription, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS ed_assets_search_idx
  ON ed_assets USING GIN (search_vector);

-- ============================================================
-- IDÉES (ed_idees.search_vector)
-- ============================================================

ALTER TABLE ed_idees
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('fr_unaccent', coalesce(titre, '')),  'A') ||
    setweight(to_tsvector('fr_unaccent', coalesce(detail, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS ed_idees_search_idx
  ON ed_idees USING GIN (search_vector);

-- ============================================================
-- INVITÉS (ed_invites.search_vector)
-- ============================================================
--
-- Le §2 bis B veut que la recherche traverse aussi les invités : « qui était
-- cette dirigeante rencontrée en octobre » est une question qu'on se pose.

ALTER TABLE ed_invites
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('fr_unaccent', coalesce(nom, '')),        'A') ||
    setweight(to_tsvector('fr_unaccent', coalesce(entreprise, '')), 'B') ||
    setweight(to_tsvector('fr_unaccent', coalesce(note, '')),      'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS ed_invites_search_idx
  ON ed_invites USING GIN (search_vector);

-- ============================================================
-- Trigram sur les titres — pour la frappe approximative
-- ============================================================
--
-- Le tsvector ne rattrape pas une faute de frappe : « procesus » ne trouve
-- pas « processus ». Le trigram, si. Même parade que la base de
-- connaissances (`knowledge_translations_title_trgm_idx`).

CREATE INDEX IF NOT EXISTS ed_publications_titre_trgm_idx
  ON ed_publications USING GIN (titre_interne gin_trgm_ops);

CREATE INDEX IF NOT EXISTS ed_idees_titre_trgm_idx
  ON ed_idees USING GIN (titre gin_trgm_ops);
