-- RETOUR ARRIÈRE de 20261108150000_contacts_guide_reseau_origine_optionnelle.
-- Applicable seulement avant l'allumage de PAGE_GUIDE_RESEAU_ENABLED.
-- Remet NOT NULL sur les quatre colonnes. ⛔ Refusé s'il existe une ligne sans origine : aucune
-- valeur n'est inventée, aucune ligne n'est modifiée ni supprimée.
-- Ensuite : DELETE FROM "_prisma_migrations" WHERE migration_name = '20261108150000_contacts_guide_reseau_origine_optionnelle';
-- (à la main, par un humain, si l'on veut que le dossier de migration puisse être rejoué).
BEGIN;

LOCK TABLE "contacts_guide_reseau" IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "contacts_guide_reseau"
    WHERE "mot" IS NULL OR "reseau" IS NULL OR "compte_ref" IS NULL OR "version_m1" IS NULL
  ) THEN
    RAISE EXCEPTION 'contacts_guide_reseau contient des lignes sans origine : retour arrière refusé';
  END IF;
END $$;

ALTER TABLE "contacts_guide_reseau" ALTER COLUMN "mot" SET NOT NULL;
ALTER TABLE "contacts_guide_reseau" ALTER COLUMN "reseau" SET NOT NULL;
ALTER TABLE "contacts_guide_reseau" ALTER COLUMN "compte_ref" SET NOT NULL;
ALTER TABLE "contacts_guide_reseau" ALTER COLUMN "version_m1" SET NOT NULL;

COMMIT;
