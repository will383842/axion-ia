-- Qualiopi — Cycle de vie du formateur sur une session (2026-09-03).
--
-- 1. Le formateur ACCEPTE ou REFUSE une mission proposée : journal des
--    sollicitations `missions_formateur`, distinct de l'affectation courante
--    `session_formateurs` (un refus retire l'affectation mais reste lisible
--    pour le pilotage — refus et absences par formateur).
-- 2. Convocation pratique J-7 et rappel J-1 au formateur : deux traces d'état
--    sur l'affectation, même patron que `training_sessions.rappel_j7_envoye_at`.
-- 3. Informations d'accès sur la session : contact sur place et consignes.

CREATE TYPE "MissionFormateurStatut" AS ENUM ('en_attente', 'acceptee', 'refusee', 'retiree', 'expiree');

ALTER TABLE "session_formateurs"
    ADD COLUMN "convocation_j7_envoyee_at" TIMESTAMP(3),
    ADD COLUMN "rappel_j1_envoye_at" TIMESTAMP(3);

CREATE INDEX "session_formateurs_convocation_j7_envoyee_at_idx" ON "session_formateurs"("convocation_j7_envoyee_at");
CREATE INDEX "session_formateurs_rappel_j1_envoye_at_idx" ON "session_formateurs"("rappel_j1_envoye_at");

ALTER TABLE "training_sessions"
    ADD COLUMN "contact_sur_place_nom" VARCHAR(160),
    ADD COLUMN "contact_sur_place_telephone" VARCHAR(40),
    ADD COLUMN "consignes_acces" TEXT;

CREATE TABLE "missions_formateur" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "role" "SessionFormateurRole" NOT NULL DEFAULT 'principal',
    "statut" "MissionFormateurStatut" NOT NULL DEFAULT 'en_attente',
    "sollicite_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email_envoye_at" TIMESTAMP(3),
    "relance_at" TIMESTAMP(3),
    "repondu_at" TIMESTAMP(3),
    "motif_refus" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "missions_formateur_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "missions_formateur_session_id_trainer_id_statut_idx" ON "missions_formateur"("session_id", "trainer_id", "statut");
CREATE INDEX "missions_formateur_trainer_id_statut_idx" ON "missions_formateur"("trainer_id", "statut");
CREATE INDEX "missions_formateur_statut_sollicite_at_idx" ON "missions_formateur"("statut", "sollicite_at");

ALTER TABLE "missions_formateur" ADD CONSTRAINT "missions_formateur_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "missions_formateur" ADD CONSTRAINT "missions_formateur_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
