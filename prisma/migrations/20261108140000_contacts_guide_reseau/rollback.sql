-- RETOUR ARRIÈRE de 20261108140000_contacts_guide_reseau.
-- Applicable seulement avant l'allumage de PAGE_GUIDE_RESEAU_ENABLED.
-- ⛔ À N'EXÉCUTER QUE SUR UNE TABLE VIDE (avant tout code S2 en service). Le garde-fou refuse sinon.
-- Ensuite : DELETE FROM "_prisma_migrations" WHERE migration_name = '20261108140000_contacts_guide_reseau';
-- (à la main, par un humain, si l'on veut que le dossier de migration puisse être rejoué).
BEGIN;

LOCK TABLE "contacts_guide_reseau" IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "contacts_guide_reseau") THEN
    RAISE EXCEPTION 'contacts_guide_reseau contient des données : retour arrière refusé';
  END IF;
END $$;

DROP TABLE "contacts_guide_reseau";

COMMIT;
