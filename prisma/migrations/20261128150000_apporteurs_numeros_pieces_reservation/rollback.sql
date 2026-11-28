-- Rollback de 20261128150000_apporteurs_numeros_pieces_reservation.
-- Seulement sur décision du fondateur. Sauvegarder d'abord :
--   COPY "apporteur_numeros_reserves" TO '/chemin/sauvegarde-apporteur_numeros_reserves.csv' CSV HEADER;
-- Jamais de DROP : mise de côté par RENAME.

-- Déclencheur d'origine (20261128140000), recopié.
CREATE OR REPLACE FUNCTION "commissions_apporteur_numero_un_apporteur"() RETURNS trigger AS $$
BEGIN
    IF NEW."autofacture_numero" IS NOT NULL AND EXISTS (
        SELECT 1 FROM "commissions_apporteur" c
        WHERE c."apporteur_id" <> NEW."apporteur_id"
          AND (c."autofacture_numero" = NEW."autofacture_numero" OR c."avoir_numero" = NEW."autofacture_numero")
    ) THEN
        RAISE EXCEPTION 'numéro % déjà attribué à un autre apporteur', NEW."autofacture_numero"
            USING ERRCODE = '23505';
    END IF;
    IF NEW."avoir_numero" IS NOT NULL AND EXISTS (
        SELECT 1 FROM "commissions_apporteur" c
        WHERE c."apporteur_id" <> NEW."apporteur_id"
          AND (c."autofacture_numero" = NEW."avoir_numero" OR c."avoir_numero" = NEW."avoir_numero")
    ) THEN
        RAISE EXCEPTION 'numéro % déjà attribué à un autre apporteur', NEW."avoir_numero"
            USING ERRCODE = '23505';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE "apporteur_numeros_reserves" RENAME TO "apporteur_numeros_reserves_retire_20261128";
-- Le marqueur « geste commercial » : mis de côté, pas supprimé (les avoirs marqués redeviendraient normaux).
ALTER TABLE "factures_formation" RENAME COLUMN "geste_commercial" TO "geste_commercial_retire_20261128";
