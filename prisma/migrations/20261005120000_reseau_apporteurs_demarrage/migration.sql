-- CreateEnum
CREATE TYPE "apporteur_reseau_statut" AS ENUM ('dossier_en_cours', 'a_verifier', 'a_completer', 'signe', 'refuse', 'resilie');

-- CreateEnum
CREATE TYPE "regime_tva_apporteur" AS ENUM ('franchise_293b', 'assujetti');

-- CreateEnum
CREATE TYPE "type_piece_apporteur" AS ENUM ('identite', 'rib', 'rc_pro', 'vigilance', 'immatriculation');

-- CreateEnum
CREATE TYPE "statut_piece_apporteur" AS ENUM ('deposee', 'conforme', 'a_retransmettre');

-- CreateEnum
CREATE TYPE "statut_presentation" AS ENUM ('reservee', 'confirmee', 'deja_connue', 'hors_champ', 'dementie', 'terminee');

-- CreateEnum
CREATE TYPE "statut_commission_apporteur" AS ENUM ('a_qualifier', 'due', 'en_attente_vigilance', 'versee', 'reprise');

-- CreateTable
CREATE TABLE "apporteurs_reseau" (
    "id" UUID NOT NULL,
    "statut" "apporteur_reseau_statut" NOT NULL DEFAULT 'dossier_en_cours',
    "submission_id" UUID,
    "prenom" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_hash" VARCHAR(64) NOT NULL,
    "telephone" TEXT,
    "siren" CHAR(9),
    "denomination" VARCHAR(250),
    "adresse" TEXT,
    "code_naf" VARCHAR(8),
    "statut_juridique" VARCHAR(40),
    "regime_tva" "regime_tva_apporteur",
    "numero_tva" VARCHAR(20),
    "iban" TEXT,
    "declarations" JSONB,
    "parrain_id" UUID,
    "version_lien" INTEGER NOT NULL DEFAULT 1,
    "contrat_cle" VARCHAR(300),
    "contrat_sha256" CHAR(64),
    "signature_apporteur" JSONB,
    "signe_par_apporteur_at" TIMESTAMPTZ(3),
    "contrat_signe_cle" VARCHAR(300),
    "contrat_signe_sha256" CHAR(64),
    "signe_par_societe_at" TIMESTAMPTZ(3),
    "dernier_message" TEXT,
    "refuse_at" TIMESTAMPTZ(3),
    "resilie_at" TIMESTAMPTZ(3),
    "note_interne" TEXT,
    "cree_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maj_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "apporteurs_reseau_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pieces_apporteur" (
    "id" UUID NOT NULL,
    "apporteur_id" UUID NOT NULL,
    "type" "type_piece_apporteur" NOT NULL,
    "statut" "statut_piece_apporteur" NOT NULL DEFAULT 'deposee',
    "motif" VARCHAR(40),
    "nom_fichier" VARCHAR(200) NOT NULL,
    "type_mime" VARCHAR(80) NOT NULL,
    "taille" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "expire_at" TIMESTAMPTZ(3),
    "deposee_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiee_at" TIMESTAMPTZ(3),
    "purgee_at" TIMESTAMPTZ(3),
    "remplacee_at" TIMESTAMPTZ(3),

    CONSTRAINT "pieces_apporteur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pieces_apporteur_contenus" (
    "piece_id" UUID NOT NULL,
    "octets" BYTEA NOT NULL,

    CONSTRAINT "pieces_apporteur_contenus_pkey" PRIMARY KEY ("piece_id")
);

-- CreateTable
CREATE TABLE "presentations_entreprise" (
    "id" UUID NOT NULL,
    "apporteur_id" UUID NOT NULL,
    "siren" CHAR(9) NOT NULL,
    "denomination" VARCHAR(250) NOT NULL,
    "personne_nom" TEXT NOT NULL,
    "personne_fonction" VARCHAR(150),
    "personne_email" TEXT NOT NULL,
    "personne_telephone" TEXT,
    "besoin" TEXT,
    "date_echange" DATE,
    "recue_at" TIMESTAMPTZ(3) NOT NULL,
    "statut" "statut_presentation" NOT NULL DEFAULT 'reservee',
    "contact_envoye_at" TIMESTAMPTZ(3),
    "confirmee_at" TIMESTAMPTZ(3),
    "confirmation_tacite" BOOLEAN NOT NULL DEFAULT false,
    "protegee_jusqu_at" TIMESTAMPTZ(3),
    "prolongee_at" TIMESTAMPTZ(3),
    "motif_prolongation" VARCHAR(40),
    "note" TEXT,
    "cree_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maj_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "presentations_entreprise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commissions_apporteur" (
    "id" UUID NOT NULL,
    "apporteur_id" UUID NOT NULL,
    "presentation_id" UUID,
    "facture_id" UUID NOT NULL,
    "parrainage" BOOLEAN NOT NULL DEFAULT false,
    "activite" VARCHAR(20) NOT NULL,
    "palier" VARCHAR(60),
    "prix_public_ht_cents" INTEGER,
    "facture_ht_cents" INTEGER NOT NULL,
    "montant_cents" INTEGER,
    "statut" "statut_commission_apporteur" NOT NULL DEFAULT 'a_qualifier',
    "releve_mois" CHAR(7),
    "autofacture_numero" VARCHAR(40),
    "versee_at" TIMESTAMPTZ(3),
    "cree_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maj_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "commissions_apporteur_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "apporteurs_reseau_submission_id_key" ON "apporteurs_reseau"("submission_id");

-- CreateIndex
CREATE UNIQUE INDEX "apporteurs_reseau_email_hash_key" ON "apporteurs_reseau"("email_hash");

-- CreateIndex
CREATE INDEX "apporteurs_reseau_statut_idx" ON "apporteurs_reseau"("statut");

-- CreateIndex
CREATE INDEX "apporteurs_reseau_parrain_id_idx" ON "apporteurs_reseau"("parrain_id");

-- CreateIndex
CREATE INDEX "pieces_apporteur_apporteur_id_type_idx" ON "pieces_apporteur"("apporteur_id", "type");

-- CreateIndex
CREATE INDEX "presentations_entreprise_siren_idx" ON "presentations_entreprise"("siren");

-- CreateIndex
CREATE INDEX "presentations_entreprise_apporteur_id_idx" ON "presentations_entreprise"("apporteur_id");

-- CreateIndex
CREATE INDEX "presentations_entreprise_statut_idx" ON "presentations_entreprise"("statut");

-- CreateIndex
CREATE INDEX "commissions_apporteur_apporteur_id_statut_idx" ON "commissions_apporteur"("apporteur_id", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "commissions_apporteur_facture_id_apporteur_id_parrainage_key" ON "commissions_apporteur"("facture_id", "apporteur_id", "parrainage");

-- AddForeignKey
ALTER TABLE "apporteurs_reseau" ADD CONSTRAINT "apporteurs_reseau_parrain_id_fkey" FOREIGN KEY ("parrain_id") REFERENCES "apporteurs_reseau"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pieces_apporteur" ADD CONSTRAINT "pieces_apporteur_apporteur_id_fkey" FOREIGN KEY ("apporteur_id") REFERENCES "apporteurs_reseau"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pieces_apporteur_contenus" ADD CONSTRAINT "pieces_apporteur_contenus_piece_id_fkey" FOREIGN KEY ("piece_id") REFERENCES "pieces_apporteur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presentations_entreprise" ADD CONSTRAINT "presentations_entreprise_apporteur_id_fkey" FOREIGN KEY ("apporteur_id") REFERENCES "apporteurs_reseau"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions_apporteur" ADD CONSTRAINT "commissions_apporteur_apporteur_id_fkey" FOREIGN KEY ("apporteur_id") REFERENCES "apporteurs_reseau"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions_apporteur" ADD CONSTRAINT "commissions_apporteur_presentation_id_fkey" FOREIGN KEY ("presentation_id") REFERENCES "presentations_entreprise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

