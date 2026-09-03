-- Lot 3 — LA DÉCISION : motif, date, auteur, et le pont vers la personne recrutée
--
-- Migration SÉPARÉE de `20260903160000_recrutement_statuts_enum` parce que
-- Postgres refuse d'UTILISER une valeur d'enum dans la transaction qui l'ajoute.
-- Ici on s'appuie sur 'withdrawn' (dans la contrainte), donc l'ajout devait
-- avoir été validé par une transaction antérieure.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. LE VOCABULAIRE DES MOTIFS
--
-- Un TYPE, pas une colonne de texte : une chaîne libre laisse écrire
-- « pas le niveau », « niveau insuffisant » et « trop junior » pour un même
-- fait, et aucune lecture n'est alors possible. Leçon déjà payée sur ce dépôt.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_rejection_reason') THEN
    CREATE TYPE "job_rejection_reason" AS ENUM (
      'competences_insuffisantes',
      'pretentions_hors_budget',
      'hors_zone',
      'profil_hors_cible',
      'sans_reponse_candidat',
      'absent_entretien',
      'candidat_a_decline',
      'poste_pourvu',
      'doublon',
      'hors_sujet',
      'non_renseigne'
    );
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. LES COLONNES
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "job_applications"
  ADD COLUMN IF NOT EXISTS "rejection_reason"   "job_rejection_reason",
  ADD COLUMN IF NOT EXISTS "decided_at"         TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "decided_by_id"      UUID,
  ADD COLUMN IF NOT EXISTS "hired_at"           TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "start_date"         DATE,
  ADD COLUMN IF NOT EXISTS "trainer_id"         UUID,
  ADD COLUMN IF NOT EXISTS "assigned_to_id"     UUID,
  ADD COLUMN IF NOT EXISTS "last_activity_at"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "first_response_at"  TIMESTAMP(3);

-- `ON DELETE SET NULL` partout : la suppression d'un compte admin ou d'une fiche
-- formateur ne doit JAMAIS emporter le dossier de candidature. C'est la règle
-- déjà tranchée par Will (« on ne le supprime jamais tout seul »), appliquée ici
-- au niveau où elle ne peut pas être contournée.
ALTER TABLE "job_applications"
  DROP CONSTRAINT IF EXISTS "job_applications_decided_by_id_fkey";
ALTER TABLE "job_applications"
  ADD CONSTRAINT "job_applications_decided_by_id_fkey"
  FOREIGN KEY ("decided_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "job_applications"
  DROP CONSTRAINT IF EXISTS "job_applications_assigned_to_id_fkey";
ALTER TABLE "job_applications"
  ADD CONSTRAINT "job_applications_assigned_to_id_fkey"
  FOREIGN KEY ("assigned_to_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "job_applications"
  DROP CONSTRAINT IF EXISTS "job_applications_trainer_id_fkey";
ALTER TABLE "job_applications"
  ADD CONSTRAINT "job_applications_trainer_id_fkey"
  FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. LA REPRISE DU STOCK — AVANT la contrainte, sinon elle refuse l'existant
--
-- Toute candidature déjà `rejected` porte un refus dont personne n'a écrit le
-- motif. `non_renseigne` DIT cela ; inventer un motif plausible serait pire que
-- l'absence, puisqu'on lirait ensuite ces valeurs comme des faits.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE "job_applications"
   SET "rejection_reason" = 'non_renseigne'
 WHERE "status" = 'rejected'
   AND "rejection_reason" IS NULL;

-- `decided_at` reprend `updated_at` pour le stock : c'est la meilleure borne
-- SUPÉRIEURE dont on dispose, et elle est honnête tant qu'on sait d'où elle
-- vient. On ne la pose que là où une décision a effectivement eu lieu.
UPDATE "job_applications"
   SET "decided_at" = "updated_at"
 WHERE "status" IN ('rejected', 'hired')
   AND "decided_at" IS NULL;

UPDATE "job_applications"
   SET "hired_at" = "updated_at"
 WHERE "status" = 'hired'
   AND "hired_at" IS NULL;

-- `last_activity_at` part de la date de dépôt : un dossier sans aucun fait
-- consigné a bien eu UNE activité, sa réception. Le laisser NULL ferait
-- apparaître tout le stock comme « jamais touché » dans l'écran des oubliés.
UPDATE "job_applications"
   SET "last_activity_at" = COALESCE("updated_at", "submitted_at")
 WHERE "last_activity_at" IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. LA CONTRAINTE — DANS LES DEUX SENS
--
-- Sens 1 : écarté ou retiré ⇒ un motif est OBLIGATOIRE. C'est la raison d'être
--          du lot : un refus sans motif ne s'apprend pas.
-- Sens 2 : en cours (nouveau → offre) ⇒ un motif est INTERDIT. Sans ce sens, un
--          motif posé puis un retour en arrière laisserait un dossier « en
--          entretien » portant « poste pourvu » : l'écran afficherait deux
--          vérités contradictoires et on croirait l'écran.
--
-- `archived` et `hired` sont volontairement HORS des deux sens : on archive un
-- dossier déjà refusé (le motif doit survivre), et rien n'interdit d'embaucher
-- quelqu'un dont une candidature antérieure portait un motif.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "job_applications"
  DROP CONSTRAINT IF EXISTS "job_applications_motif_coherent_check";
ALTER TABLE "job_applications"
  ADD CONSTRAINT "job_applications_motif_coherent_check"
  CHECK (
       ("status" IN ('rejected', 'withdrawn') AND "rejection_reason" IS NOT NULL)
    OR ("status" IN ('new', 'reviewing', 'shortlisted', 'interview', 'offer') AND "rejection_reason" IS NULL)
    OR ("status" IN ('hired', 'archived'))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. LES INDEX DES DEUX ÉCRANS DU LOT 4
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "job_applications_assigned_to_id_status_idx"
  ON "job_applications"("assigned_to_id", "status");
CREATE INDEX IF NOT EXISTS "job_applications_status_last_activity_at_idx"
  ON "job_applications"("status", "last_activity_at");
