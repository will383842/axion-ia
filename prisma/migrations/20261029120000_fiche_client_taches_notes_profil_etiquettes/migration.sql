-- Fiche client (2026-10-29, décision de Will) : tâches, notes chiffrées, profil, étiquettes,
-- + probabilité et clôture prévue sur projet_suivis.
-- ADDITIVE, AUTONOME : CREATE TABLE / ADD COLUMN NULL / CREATE INDEX seulement. Aucun DROP, aucune
-- énumération touchée, aucune colonne sur `clients` (ADR 0053). RÉ-EXÉCUTABLE (IF NOT EXISTS,
-- contraintes dans un bloc DO). Migration livrée SEULE : aucun code ne lit ni n'écrit ces tables
-- (le worker peut tourner l'ancien ou le nouveau code ~50 min avant l'app).
-- `contenu_chiffre` : chiffré comme les paroles du dossier ; jamais de clair.
-- Retour arrière (JAMAIS exécuté par défaut) :
--   DROP TABLE "client_etiquettes"; DROP TABLE "client_profils"; DROP TABLE "client_notes";
--   DROP TABLE "client_taches";
--   ALTER TABLE "projet_suivis" DROP CONSTRAINT "projet_suivis_probabilite_pct_check";
--   ALTER TABLE "projet_suivis" DROP COLUMN "probabilite_pct", DROP COLUMN "cloture_prevue_le";

CREATE TABLE IF NOT EXISTS "client_taches" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "projet_id" UUID,
    "contact_id" UUID,
    "intitule" VARCHAR(300) NOT NULL,
    "echeance_le" DATE NOT NULL,
    "responsable_label" VARCHAR(80) NOT NULL,
    "faite_le" TIMESTAMP(3),
    "origine" VARCHAR(20) NOT NULL DEFAULT 'manuelle',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_taches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "client_notes" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "projet_id" UUID,
    "contenu_chiffre" TEXT NOT NULL,
    "auteur_label" VARCHAR(80) NOT NULL,
    "epinglee" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "client_profils" (
    "client_id" UUID NOT NULL,
    "responsable_label" VARCHAR(80),
    "archive_le" TIMESTAMP(3),
    "archive_motif" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_profils_pkey" PRIMARY KEY ("client_id")
);

CREATE TABLE IF NOT EXISTS "client_etiquettes" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "libelle" VARCHAR(60) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_etiquettes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "projet_suivis" ADD COLUMN IF NOT EXISTS "probabilite_pct" SMALLINT;
ALTER TABLE "projet_suivis" ADD COLUMN IF NOT EXISTS "cloture_prevue_le" DATE;

CREATE INDEX IF NOT EXISTS "client_taches_client_id_echeance_le_idx" ON "client_taches"("client_id", "echeance_le");
CREATE INDEX IF NOT EXISTS "client_taches_projet_id_idx" ON "client_taches"("projet_id");
CREATE INDEX IF NOT EXISTS "client_notes_client_id_created_at_idx" ON "client_notes"("client_id", "created_at");
CREATE INDEX IF NOT EXISTS "client_notes_projet_id_idx" ON "client_notes"("projet_id");
CREATE UNIQUE INDEX IF NOT EXISTS "client_etiquettes_client_id_libelle_key" ON "client_etiquettes"("client_id", "libelle");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_taches_client_id_fkey') THEN
    ALTER TABLE "client_taches" ADD CONSTRAINT "client_taches_client_id_fkey"
      FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_taches_projet_id_fkey') THEN
    ALTER TABLE "client_taches" ADD CONSTRAINT "client_taches_projet_id_fkey"
      FOREIGN KEY ("projet_id") REFERENCES "projets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_taches_origine_check') THEN
    ALTER TABLE "client_taches" ADD CONSTRAINT "client_taches_origine_check"
      CHECK ("origine" IN ('manuelle', 'rencontre', 'relance', 'questionnaire'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_notes_client_id_fkey') THEN
    ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_client_id_fkey"
      FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_notes_projet_id_fkey') THEN
    ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_projet_id_fkey"
      FOREIGN KEY ("projet_id") REFERENCES "projets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_profils_client_id_fkey') THEN
    ALTER TABLE "client_profils" ADD CONSTRAINT "client_profils_client_id_fkey"
      FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_etiquettes_client_id_fkey') THEN
    ALTER TABLE "client_etiquettes" ADD CONSTRAINT "client_etiquettes_client_id_fkey"
      FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  -- Même client tenu par la base (ADR 0053 §5) : clés composées, SET NULL sur la seule colonne facultative.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_taches_contact_id_fkey') THEN
    ALTER TABLE "client_taches" ADD CONSTRAINT "client_taches_contact_id_fkey"
      FOREIGN KEY ("contact_id") REFERENCES "client_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_taches_projet_meme_client') THEN
    ALTER TABLE "client_taches" ADD CONSTRAINT "client_taches_projet_meme_client"
      FOREIGN KEY ("projet_id", "client_id") REFERENCES "projets"("id", "client_id") ON DELETE SET NULL ("projet_id") ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_taches_contact_meme_client') THEN
    ALTER TABLE "client_taches" ADD CONSTRAINT "client_taches_contact_meme_client"
      FOREIGN KEY ("contact_id", "client_id") REFERENCES "client_contacts"("id", "client_id") ON DELETE SET NULL ("contact_id") ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_notes_projet_meme_client') THEN
    ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_projet_meme_client"
      FOREIGN KEY ("projet_id", "client_id") REFERENCES "projets"("id", "client_id") ON DELETE SET NULL ("projet_id") ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projet_suivis_probabilite_pct_check') THEN
    ALTER TABLE "projet_suivis" ADD CONSTRAINT "projet_suivis_probabilite_pct_check"
      CHECK ("probabilite_pct" IS NULL OR ("probabilite_pct" BETWEEN 0 AND 100));
  END IF;
END $$;
