-- RETOUR ARRIÈRE de 20261102210000_audit_terrain_tables.
-- ⛔ À N'EXÉCUTER QUE SUR DES TABLES VIDES (avant tout envoi réel). Après le jour J : révoquer
-- le jeton (`jeton_revoque_le`), ne jamais supprimer. Le garde-fou ci-dessous refuse sinon.
-- Ensuite : DELETE FROM "_prisma_migrations" WHERE migration_name = '20261102210000_audit_terrain_tables';
-- (à la main, par un humain, si l'on veut que le dossier de migration puisse être rejoué).
-- Transaction : si le garde-fou refuse, plus rien ne s'exécute (même sans ON_ERROR_STOP).
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "audit_terrain_evenements")
     OR EXISTS (SELECT 1 FROM "audit_terrain_rapports")
     OR EXISTS (SELECT 1 FROM "audit_terrain_sessions") THEN
    RAISE EXCEPTION 'audit_terrain_* contient des données : retour arrière refusé (révoquer le jeton à la place)';
  END IF;
END $$;

DROP TABLE "audit_terrain_rapports";
DROP TABLE "audit_terrain_evenements";
DROP TABLE "audit_terrain_sessions";

COMMIT;
