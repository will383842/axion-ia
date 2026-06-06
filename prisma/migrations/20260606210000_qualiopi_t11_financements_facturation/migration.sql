-- T11 Qualiopi — Financements (OPCO/CPF/France Travail) + facturation duale.
-- off.17/19/21/22. Migration ADDITIVE uniquement : 3 enums + colonnes nullables
-- sur training_sessions/formations/trainers + 1 table factures_formation + FK.
-- Dérive préexistante du migrate diff IGNORÉE (hors périmètre T11).

-- CreateEnum
CREATE TYPE "FranceTravailDispositif" AS ENUM ('aif', 'poei', 'csp');

-- CreateEnum
CREATE TYPE "FactureFormationDestinataire" AS ENUM ('entreprise', 'opco', 'stagiaire', 'france_travail');

-- CreateEnum
CREATE TYPE "FactureFormationStatut" AS ENUM ('brouillon', 'emise', 'payee', 'annulee');

-- AlterTable training_sessions (additif)
ALTER TABLE "training_sessions" ADD COLUMN     "ft_dispositif" "FranceTravailDispositif",
ADD COLUMN     "numero_dossier_opco" VARCHAR(60),
ADD COLUMN     "cpf_payeur_reste_charge" VARCHAR(40);

-- AlterTable formations (additif)
ALTER TABLE "formations" ADD COLUMN     "moyens_techniques" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "ressources_pedagogiques" JSONB NOT NULL DEFAULT '[]';

-- AlterTable trainers (additif)
ALTER TABLE "trainers" ADD COLUMN     "sous_traitant_nda" VARCHAR(20),
ADD COLUMN     "sous_traitant_verifie_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "factures_formation" (
    "id" UUID NOT NULL,
    "numero" VARCHAR(40) NOT NULL,
    "session_id" UUID NOT NULL,
    "destinataire" "FactureFormationDestinataire" NOT NULL,
    "destinataire_nom" VARCHAR(250) NOT NULL,
    "destinataire_siret" VARCHAR(20),
    "destinataire_adresse" TEXT,
    "montant_ht_cents" INTEGER NOT NULL,
    "tva_exoneree" BOOLEAN NOT NULL DEFAULT true,
    "lignes" JSONB NOT NULL DEFAULT '[]',
    "subrogation" BOOLEAN NOT NULL DEFAULT false,
    "numero_dossier_opco" VARCHAR(60),
    "statut" "FactureFormationStatut" NOT NULL DEFAULT 'brouillon',
    "document_id" UUID,
    "emise_at" TIMESTAMP(3),
    "echeance_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "factures_formation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "factures_formation_numero_key" ON "factures_formation"("numero");

-- CreateIndex
CREATE INDEX "factures_formation_session_id_idx" ON "factures_formation"("session_id");

-- CreateIndex
CREATE INDEX "factures_formation_statut_idx" ON "factures_formation"("statut");

-- AddForeignKey
ALTER TABLE "factures_formation" ADD CONSTRAINT "factures_formation_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "training_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
