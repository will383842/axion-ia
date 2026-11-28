-- Réseau d'apporteurs (#2464 points 13 et 18, suite de 20261128090000_apporteurs_numeros_pieces_uniques).
-- Additif : une table de RÉSERVATION des numéros, une colonne booléenne à défaut false, un déclencheur réécrit.
--
-- 1. Point 13 — la garantie tient en CONCURRENCE. Le déclencheur d'avant contrôlait par un EXISTS : en
--    READ COMMITTED, deux transactions qui écrivent le même numéro pour deux apporteurs différents passent
--    toutes deux le contrôle. Désormais le déclencheur INSCRIT le numéro dans une table dont la clé primaire
--    est le numéro (INSERT ... ON CONFLICT DO NOTHING), puis lit l'apporteur inscrit : la seconde transaction
--    attend la première (verrou sur la clé), puis voit l'apporteur de la première et est refusée (23505).
--    Si la première est annulée, sa réservation l'est aussi (même transaction) : le numéro reste libre.
--    Sans clé étrangère (fenêtre app/worker). Les numéros déjà présents sont inscrits (le premier apporteur
--    rencontré l'emporte) ; un doublon HISTORIQUE éventuel n'empêche rien et est signalé par un WARNING
--    (nombre seulement, aucune donnée personnelle).
-- 2. Point 18 — marqueur « geste commercial » sur la pièce d'avoir (bon d'achat offert, hors délai) : la
--    commission de l'apporteur est gardée. Colonne booléenne, défaut false : toute pièce existante reste un avoir normal.

CREATE TABLE IF NOT EXISTS "apporteur_numeros_reserves" (
    "numero" VARCHAR(40) NOT NULL,
    "apporteur_id" UUID NOT NULL,
    "reserve_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
    CONSTRAINT "apporteur_numeros_reserves_pkey" PRIMARY KEY ("numero")
);
CREATE INDEX IF NOT EXISTS "apporteur_numeros_reserves_apporteur_idx" ON "apporteur_numeros_reserves" ("apporteur_id");

-- Les numéros déjà émis : le premier apporteur rencontré l'emporte, aucun doublon ne bloque.
INSERT INTO "apporteur_numeros_reserves" ("numero", "apporteur_id")
SELECT DISTINCT ON (n) n, apporteur_id FROM (
    SELECT "autofacture_numero" AS n, "apporteur_id", "cree_at" FROM "commissions_apporteur" WHERE "autofacture_numero" IS NOT NULL
    UNION ALL
    SELECT "avoir_numero", "apporteur_id", "cree_at" FROM "commissions_apporteur" WHERE "avoir_numero" IS NOT NULL
) t
ORDER BY n, "cree_at"
ON CONFLICT ("numero") DO NOTHING;

-- Doublons historiques (un numéro sous plusieurs apporteurs) : signalés, jamais corrigés ici.
DO $$
DECLARE
    nb integer;
BEGIN
    SELECT count(*) INTO nb FROM (
        SELECT n FROM (
            SELECT "autofacture_numero" AS n, "apporteur_id" FROM "commissions_apporteur" WHERE "autofacture_numero" IS NOT NULL
            UNION ALL
            SELECT "avoir_numero", "apporteur_id" FROM "commissions_apporteur" WHERE "avoir_numero" IS NOT NULL
        ) t GROUP BY n HAVING count(DISTINCT apporteur_id) > 1
    ) d;
    IF nb > 0 THEN
        RAISE WARNING 'apporteurs : % numéro(s) d''autofacture ou d''avoir déjà partagé(s) entre plusieurs apporteurs (doublons historiques, non corrigés)', nb;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION "commissions_apporteur_numero_un_apporteur"() RETURNS trigger AS $$
DECLARE
    n text;
    reserve uuid;
BEGIN
    -- Contrôle d'avant (numéros déjà portés par les lignes d'un autre apporteur).
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
    -- Réservation : tient en concurrence (clé primaire sur le numéro).
    FOREACH n IN ARRAY ARRAY[NEW."autofacture_numero", NEW."avoir_numero"] LOOP
        IF n IS NULL THEN CONTINUE; END IF;
        INSERT INTO "apporteur_numeros_reserves" ("numero", "apporteur_id")
        VALUES (n, NEW."apporteur_id") ON CONFLICT ("numero") DO NOTHING;
        SELECT r."apporteur_id" INTO reserve FROM "apporteur_numeros_reserves" r WHERE r."numero" = n;
        IF reserve IS DISTINCT FROM NEW."apporteur_id" THEN
            RAISE EXCEPTION 'numéro % déjà attribué à un autre apporteur', n USING ERRCODE = '23505';
        END IF;
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE "factures_formation" ADD COLUMN IF NOT EXISTS "geste_commercial" BOOLEAN NOT NULL DEFAULT false;
