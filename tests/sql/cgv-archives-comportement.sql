-- COMPORTEMENT de l archive immuable `cgv_archives` (migration 20261104160000_cgv_archives).
-- Lance par ci.yml : psql -v ON_ERROR_STOP=1 -f tests/sql/cgv-archives-comportement.sql
-- Chaque cas vit dans SA transaction ANNULEE. Une attente decue remonte (AXT99), psql s arrete, Gate D rougit.
\set QUIET on

BEGIN;
-- 1. UPDATE, DELETE, TRUNCATE refuses ; INSERT accepte ; doublon de version refuse.
DO $$
DECLARE
  h text := repeat('a', 64);
BEGIN
  INSERT INTO cgv_archives (version, libelle, texte_canonique, texte_sha256, pdf_r2_key, pdf_sha256, pdf_taille)
  VALUES ('2026-01-01', 'test', '{}', h, 'legal/cgv/2026-01-01/' || h || '.pdf', h, 10);

  BEGIN
    UPDATE cgv_archives SET libelle = 'x' WHERE version = '2026-01-01';
    RAISE EXCEPTION 'AXT99 UPDATE accepte';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
  END;

  BEGIN
    DELETE FROM cgv_archives WHERE version = '2026-01-01';
    RAISE EXCEPTION 'AXT99 DELETE accepte';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
  END;

  BEGIN
    TRUNCATE cgv_archives;
    RAISE EXCEPTION 'AXT99 TRUNCATE accepte';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
  END;

  BEGIN
    INSERT INTO cgv_archives (version, libelle, texte_canonique, texte_sha256, pdf_r2_key, pdf_sha256, pdf_taille)
    VALUES ('2026-01-01', 'bis', '{}', h, 'legal/cgv/2026-01-01/' || h || '.pdf', h, 10);
    RAISE EXCEPTION 'AXT99 doublon accepte';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- INSERT ... ON CONFLICT DO NOTHING (idempotence du service) ne declenche aucun refus.
  INSERT INTO cgv_archives (version, libelle, texte_canonique, texte_sha256, pdf_r2_key, pdf_sha256, pdf_taille)
  VALUES ('2026-01-01', 'bis', '{}', h, 'legal/cgv/2026-01-01/' || h || '.pdf', h, 10) ON CONFLICT (version) DO NOTHING;
END $$;
ROLLBACK;

BEGIN;
-- 2. Les CHECK refusent une empreinte mal formee et une taille nulle.
DO $$
BEGIN
  BEGIN
    INSERT INTO cgv_archives (version, libelle, texte_canonique, texte_sha256, pdf_r2_key, pdf_sha256, pdf_taille)
    VALUES ('2026-01-02', 't', '{}', 'ABC', 'legal/cgv/2026-01-02/' || repeat('a', 64) || '.pdf', repeat('a', 64), 10);
    RAISE EXCEPTION 'AXT99 empreinte invalide acceptee';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO cgv_archives (version, libelle, texte_canonique, texte_sha256, pdf_r2_key, pdf_sha256, pdf_taille)
    VALUES ('2026-01-03', 't', '{}', repeat('a', 64), 'legal/cgv/2026-01-03/' || repeat('a', 64) || '.pdf', repeat('a', 64), 0);
    RAISE EXCEPTION 'AXT99 taille nulle acceptee';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO cgv_archives (version, libelle, texte_canonique, texte_sha256, pdf_r2_key, pdf_sha256, pdf_taille)
    VALUES ('v-mal-formee', 't', '{}', repeat('a', 64), 'legal/cgv/v-mal-formee/' || repeat('a', 64) || '.pdf', repeat('a', 64), 10);
    RAISE EXCEPTION 'AXT99 version mal formee acceptee';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO cgv_archives (version, libelle, texte_canonique, texte_sha256, pdf_r2_key, pdf_sha256, pdf_taille)
    VALUES ('2026-01-04', 't', '{}', repeat('a', 64), 'k', repeat('a', 64), 10);
    RAISE EXCEPTION 'AXT99 cle R2 hors forme acceptee';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO cgv_archives (version, libelle, texte_canonique, texte_sha256, pdf_r2_key, pdf_sha256, pdf_taille)
    VALUES ('2026-01-05', '   ', '{}', repeat('a', 64), 'legal/cgv/2026-01-05/' || repeat('a', 64) || '.pdf', repeat('a', 64), 10);
    RAISE EXCEPTION 'AXT99 libelle vide accepte';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;
ROLLBACK;
