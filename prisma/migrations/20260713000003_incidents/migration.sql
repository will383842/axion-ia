-- Registre des incidents (LOT 4 - pilotage reel). Alimente M7 (incidents) et
-- M9 (actions correctives) du pilotage Qualiopi.
-- Migration ADDITIVE : aucun DROP, aucune colonne NOT NULL sans default.

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('pedagogique', 'administratif', 'technique', 'autre');

-- CreateEnum
CREATE TYPE "IncidentGravite" AS ENUM ('mineur', 'majeur', 'critique');

-- CreateEnum
CREATE TYPE "IncidentStatut" AS ENUM ('ouvert', 'en_cours', 'resolu');

-- CreateTable
CREATE TABLE "incidents" (
    "id" UUID NOT NULL,
    "type" "IncidentType" NOT NULL,
    "gravite" "IncidentGravite" NOT NULL,
    "titre" VARCHAR(300) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "session_id" UUID,
    "date_incident" TIMESTAMP(3) NOT NULL,
    "action_corrective" TEXT NOT NULL DEFAULT '',
    "statut" "IncidentStatut" NOT NULL DEFAULT 'ouvert',
    "resolu_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "incidents_statut_idx" ON "incidents"("statut");

-- CreateIndex
CREATE INDEX "incidents_type_idx" ON "incidents"("type");

-- CreateIndex
CREATE INDEX "incidents_date_incident_idx" ON "incidents"("date_incident");

-- CreateIndex
CREATE INDEX "incidents_session_id_idx" ON "incidents"("session_id");

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "training_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
