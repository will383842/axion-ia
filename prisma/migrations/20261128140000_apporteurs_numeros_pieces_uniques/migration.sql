-- Réseau d'apporteurs : un numéro d'autofacture ou d'avoir ne sert qu'à UN apporteur (critique #2464, point 13).
--
-- Pourquoi pas un simple CREATE UNIQUE INDEX sur "autofacture_numero" : une autofacture couvre
-- PLUSIEURS lignes de commission, qui portent donc LÉGITIMEMENT le même numéro. Un index unique
-- sur ces colonnes refuserait toute autofacture de plus d'une ligne (et échouerait ici sur les
-- données existantes). L'invariant à garder est : un numéro appartient à un seul apporteur, dans
-- la série commune « autofacture + avoir ». C'est ce que pose le déclencheur ci-dessous ; les
-- index partiels (WHERE ... IS NOT NULL) servent sa recherche.
--
-- Données existantes : AUCUN doublon possible. Les numéros sont attribués sous verrou consultatif
-- (série unique), et la migration 20261126140000 a figé une pièce par numéro dans
-- "pieces_autofacture_apporteur" (clé primaire "numero"). Le déclencheur ne contrôle que les
-- ÉCRITURES à venir : il ne relit ni ne modifie aucune ligne existante, donc ne peut pas échouer
-- au déploiement. Contrôle de lecture seule, à lancer avant/après si on veut s'en assurer :
--   SELECT n, count(DISTINCT apporteur_id) FROM (
--     SELECT autofacture_numero AS n, apporteur_id FROM commissions_apporteur WHERE autofacture_numero IS NOT NULL
--     UNION ALL
--     SELECT avoir_numero, apporteur_id FROM commissions_apporteur WHERE avoir_numero IS NOT NULL) t
--   GROUP BY n HAVING count(DISTINCT apporteur_id) > 1;   -- attendu : 0 ligne
--
-- Ajout seul, rejouable. Aucun UPDATE, DELETE ni DROP sur des données.
--
-- Retour arrière (à lancer à la main) :
--   -- DROP TRIGGER IF EXISTS "commissions_apporteur_numero_un_apporteur" ON "commissions_apporteur";
--   -- DROP FUNCTION IF EXISTS "commissions_apporteur_numero_un_apporteur"();
--   -- DROP INDEX IF EXISTS "commissions_apporteur_autofacture_numero_partiel_idx";
--   -- DROP INDEX IF EXISTS "commissions_apporteur_avoir_numero_partiel_idx";

CREATE INDEX IF NOT EXISTS "commissions_apporteur_autofacture_numero_partiel_idx"
    ON "commissions_apporteur" ("autofacture_numero") WHERE "autofacture_numero" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "commissions_apporteur_avoir_numero_partiel_idx"
    ON "commissions_apporteur" ("avoir_numero") WHERE "avoir_numero" IS NOT NULL;

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

DROP TRIGGER IF EXISTS "commissions_apporteur_numero_un_apporteur" ON "commissions_apporteur";
CREATE TRIGGER "commissions_apporteur_numero_un_apporteur"
    BEFORE INSERT OR UPDATE OF "autofacture_numero", "avoir_numero", "apporteur_id" ON "commissions_apporteur"
    FOR EACH ROW EXECUTE FUNCTION "commissions_apporteur_numero_un_apporteur"();
