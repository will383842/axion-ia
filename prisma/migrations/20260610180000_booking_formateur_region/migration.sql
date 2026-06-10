-- Phase 2 calendrier interventions (Will 2026-06-10) — brancher les formateurs.
--
-- 1. Ajoute `region` au formateur (Trainer) : slug parmi les 13 régions FR
--    métropole + 5 DROM (cf. src/content/regions.ts). Sert au filtrage/affectation
--    géographique des interventions.
-- 2. Ajoute `formateur_id` à Booking (FK nullable → trainers) : permet d'affecter
--    un formateur à une réservation/intervention du calendrier. SET NULL si le
--    formateur est supprimé (l'intervention n'est jamais perdue).
--
-- Migration ADDITIVE uniquement (aucun DROP). Idempotent (PostgreSQL 12+).

-- AlterTable: Trainer.region
ALTER TABLE "trainers" ADD COLUMN IF NOT EXISTS "region" VARCHAR(60);

-- CreateIndex: trainers.region
CREATE INDEX IF NOT EXISTS "trainers_region_idx" ON "trainers"("region");

-- AlterTable: Booking.formateur_id
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "formateur_id" UUID;

-- CreateIndex: bookings.formateur_id
CREATE INDEX IF NOT EXISTS "bookings_formateur_id_idx" ON "bookings"("formateur_id");

-- AddForeignKey: bookings.formateur_id -> trainers.id (SET NULL on delete)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_formateur_id_fkey'
  ) THEN
    ALTER TABLE "bookings"
      ADD CONSTRAINT "bookings_formateur_id_fkey"
      FOREIGN KEY ("formateur_id") REFERENCES "trainers"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
