-- Retour arrière de la PR Q1 (porte qualité) — à lancer à la main, jamais par le déploiement.
-- S'arrête si une table contient des lignes (verdicts et cohortes à conserver : à archiver d'abord).
-- Retire aussi la ligne de réglages `porte_qualite`, seulement si elle porte encore la signature de la migration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "content_quality_verdicts") OR EXISTS (SELECT 1 FROM "porte_cohortes") THEN
    RAISE EXCEPTION 'porte qualité : tables non vides, archiver avant de supprimer';
  END IF;
END $$;

DROP TABLE "content_quality_verdicts";
DROP TABLE "porte_cohortes";
DELETE FROM "content_gen_config" WHERE "key" = 'porte_qualite' AND "updatedBy" = 'migration:porte_qualite_q1';
