-- Audits IA + acomptes + rattachement rémunération.
--
-- ADDITIF. Aucune colonne supprimée. Trois blocs :
--
-- 1. `audit_missions` : le TROISIÈME type de prestation, à côté des formations
--    collectives et des coachings. Sans cette table, un audit vendu à un client
--    ne pouvait être ni affecté à un formateur ni rémunéré (l'ancien
--    rattachement `Booking` a été retiré). Mêmes champs qu'une session sur les
--    points qui comptent : client, devis, lieu, formateur, montant, OPCO.
--
-- 2. Colonnes ACOMPTE (montant + date + reçu + moyen texte libre) sur
--    `training_sessions` ET `audit_missions`. Suivi MANUEL, sans lien avec
--    Stripe (retiré) : le moyen de paiement est du texte libre.
--
-- 3. `trainer_fee_lines.audit_mission_id` : une ligne de rémunération peut
--    désormais se rattacher à un audit. Le CHECK « exactement une prestation »
--    est ÉTENDU aux 4 références (au lieu de 3) : on le supprime et on le recrée.

-- CreateEnum
CREATE TYPE "AuditMissionStatut" AS ENUM ('planifiee', 'en_cours', 'realisee', 'annulee', 'reportee');

-- AlterTable : acompte sur les formations
ALTER TABLE "training_sessions"
  ADD COLUMN "acompte_montant_cents"  INTEGER,
  ADD COLUMN "acompte_date_versement" DATE,
  ADD COLUMN "acompte_recu"           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "acompte_moyen"          VARCHAR(60);

-- AlterTable : rattachement audit sur les lignes de rémunération
ALTER TABLE "trainer_fee_lines" ADD COLUMN "audit_mission_id" UUID;

-- CreateTable
CREATE TABLE "audit_missions" (
    "id"                            UUID NOT NULL,
    "numero"                        VARCHAR(40) NOT NULL,
    "titre"                         VARCHAR(300) NOT NULL,
    "submission_id"                 UUID,
    "client_id"                     UUID,
    "devis_id"                      UUID,
    "date_debut"                    TIMESTAMP(3) NOT NULL,
    "date_fin"                      TIMESTAMP(3) NOT NULL,
    "duree_heures"                  INTEGER,
    "lieu_type"                     "LieuType",
    "lieu_intitule"                 VARCHAR(200),
    "lieu_adresse"                  TEXT,
    "lieu_code_postal"              VARCHAR(10),
    "lieu_ville"                    VARCHAR(120),
    "lieu_salle"                    VARCHAR(120),
    "lieu_visio_url"                TEXT,
    "formateur_id"                  UUID,
    "montant_ht_cents"              INTEGER NOT NULL,
    "financement_type"             "FinancementType",
    "opco_statut"                  "OpcoStatut" NOT NULL DEFAULT 'non_demande',
    "numero_dossier_opco"           VARCHAR(60),
    "prise_en_charge_montant_cents" INTEGER,
    "acompte_montant_cents"         INTEGER,
    "acompte_date_versement"        DATE,
    "acompte_recu"                  BOOLEAN NOT NULL DEFAULT false,
    "acompte_moyen"                 VARCHAR(60),
    "statut"                       "AuditMissionStatut" NOT NULL DEFAULT 'planifiee',
    "created_at"                    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"                    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_missions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "audit_missions_numero_key" ON "audit_missions"("numero");
CREATE INDEX "audit_missions_client_id_idx" ON "audit_missions"("client_id");
CREATE INDEX "audit_missions_devis_id_idx" ON "audit_missions"("devis_id");
CREATE INDEX "audit_missions_formateur_id_idx" ON "audit_missions"("formateur_id");
CREATE INDEX "audit_missions_statut_idx" ON "audit_missions"("statut");
CREATE INDEX "audit_missions_date_debut_idx" ON "audit_missions"("date_debut");
CREATE INDEX "audit_missions_date_debut_date_fin_idx" ON "audit_missions"("date_debut", "date_fin");
CREATE INDEX "trainer_fee_lines_audit_mission_id_idx" ON "trainer_fee_lines"("audit_mission_id");

-- AddForeignKey
ALTER TABLE "audit_missions" ADD CONSTRAINT "audit_missions_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_missions" ADD CONSTRAINT "audit_missions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_missions" ADD CONSTRAINT "audit_missions_devis_id_fkey" FOREIGN KEY ("devis_id") REFERENCES "devis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_missions" ADD CONSTRAINT "audit_missions_formateur_id_fkey" FOREIGN KEY ("formateur_id") REFERENCES "trainers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "trainer_fee_lines" ADD CONSTRAINT "trainer_fee_lines_audit_mission_id_fkey" FOREIGN KEY ("audit_mission_id") REFERENCES "audit_missions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Le CHECK « exactement une prestation » passe de 3 à 4 références.
ALTER TABLE "trainer_fee_lines" DROP CONSTRAINT "ck_fee_line_une_seule_prestation";
ALTER TABLE "trainer_fee_lines" ADD CONSTRAINT "ck_fee_line_une_seule_prestation"
  CHECK (
    (CASE WHEN "session_id" IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN "coaching_session_id" IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN "booking_id" IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN "audit_mission_id" IS NOT NULL THEN 1 ELSE 0 END)
  = 1
  );
