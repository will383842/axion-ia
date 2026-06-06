-- T2 Qualiopi — CRM clients + devis (stade prospect).
-- Migration ADDITIVE uniquement (CREATE TYPE / CREATE TABLE / INDEX / FK).

-- CreateEnum
CREATE TYPE "ClientStatut" AS ENUM ('prospect', 'devis_envoye', 'client_actif', 'client_inactif', 'perdu');

-- CreateEnum
CREATE TYPE "DevisStatut" AS ENUM ('brouillon', 'envoye', 'accepte', 'refuse', 'expire', 'transforme_convention');

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "numero" VARCHAR(40) NOT NULL,
    "raison_sociale" VARCHAR(250) NOT NULL,
    "siret" VARCHAR(14),
    "naf_code" VARCHAR(6),
    "convention_collective" VARCHAR(200),
    "secteur" VARCHAR(200),
    "taille" "CompanySize",
    "adresse" TEXT,
    "contact_nom" VARCHAR(200),
    "contact_email" CITEXT,
    "contact_telephone" VARCHAR(40),
    "contact_fonction" VARCHAR(150),
    "opco_identifie" VARCHAR(60),
    "opco_numero_adherent" VARCHAR(80),
    "opco_enveloppe_annuelle_cents" INTEGER,
    "statut" "ClientStatut" NOT NULL DEFAULT 'prospect',
    "source" VARCHAR(120),
    "contexte_ia" TEXT,
    "besoins_identifies" JSONB,
    "notes" TEXT,
    "nb_sessions" INTEGER NOT NULL DEFAULT 0,
    "nb_stagiaires" INTEGER NOT NULL DEFAULT 0,
    "ca_cents" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devis" (
    "id" UUID NOT NULL,
    "numero" VARCHAR(40) NOT NULL,
    "client_id" UUID NOT NULL,
    "lignes" JSONB NOT NULL,
    "montant_total_ht_cents" INTEGER NOT NULL,
    "mention_tva" TEXT NOT NULL,
    "financement_suggere" VARCHAR(40),
    "montant_opco_estime_cents" INTEGER,
    "reste_a_charge_cents" INTEGER,
    "statut" "DevisStatut" NOT NULL DEFAULT 'brouillon',
    "date_validite" TIMESTAMP(3) NOT NULL,
    "fichier_pdf_url" TEXT,
    "sent_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_numero_key" ON "clients"("numero");

-- CreateIndex
CREATE INDEX "clients_statut_idx" ON "clients"("statut");

-- CreateIndex
CREATE INDEX "clients_naf_code_idx" ON "clients"("naf_code");

-- CreateIndex
CREATE INDEX "clients_opco_identifie_idx" ON "clients"("opco_identifie");

-- CreateIndex
CREATE UNIQUE INDEX "devis_numero_key" ON "devis"("numero");

-- CreateIndex
CREATE INDEX "devis_client_id_idx" ON "devis"("client_id");

-- CreateIndex
CREATE INDEX "devis_statut_idx" ON "devis"("statut");

-- AddForeignKey
ALTER TABLE "devis" ADD CONSTRAINT "devis_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
