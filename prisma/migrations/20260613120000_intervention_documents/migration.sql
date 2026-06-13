-- Documents d'intervention — Bibliothèque admin (chantier "Documents
-- interventions"). Migration ADDITIVE : 6 enums + 3 tables + index + FK.
-- Centralise les documents pédagogiques par prestation (formation/1-to-1/audit).
-- Versions IMMUABLES (source éditable .docx/.pptx + PDF figé R2) + pointeur
-- courant + note « Quoi de neuf ». Slots déjà produits par le Formation Engine
-- AGRÉGÉS en lecture (jamais dupliqués). Notifications e-mail (document_recipients),
-- aucun compte requis. Aucune donnée existante modifiée.

-- CreateEnum
CREATE TYPE "InterventionFamille" AS ENUM ('formation', 'un_a_un', 'audit');

-- CreateEnum
CREATE TYPE "InterventionDocCategorie" AS ENUM ('stagiaires', 'formateur', 'cadre', 'evaluation');

-- CreateEnum
CREATE TYPE "InterventionDocVisibilite" AS ENUM ('stagiaire', 'formateur', 'commercial', 'interne');

-- CreateEnum
CREATE TYPE "InterventionDocStatut" AS ENUM ('brouillon', 'publie', 'archive');

-- CreateEnum
CREATE TYPE "InterventionDocSource" AS ENUM ('upload', 'qualiopi_genere');

-- CreateEnum
CREATE TYPE "DocumentRecipientRole" AS ENUM ('formateur', 'commercial');

-- CreateTable
CREATE TABLE "intervention_documents" (
    "id" UUID NOT NULL,
    "intervention_slug" VARCHAR(80) NOT NULL,
    "famille" "InterventionFamille" NOT NULL,
    "categorie" "InterventionDocCategorie" NOT NULL,
    "slot" VARCHAR(80) NOT NULL,
    "titre" VARCHAR(300) NOT NULL,
    "visibilite" "InterventionDocVisibilite" NOT NULL DEFAULT 'stagiaire',
    "source" "InterventionDocSource" NOT NULL DEFAULT 'upload',
    "current_version_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intervention_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intervention_document_versions" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "source_key" TEXT,
    "source_format" VARCHAR(10),
    "source_size_bytes" INTEGER NOT NULL DEFAULT 0,
    "pdf_key" TEXT,
    "pdf_size_bytes" INTEGER NOT NULL DEFAULT 0,
    "hash_sha256" VARCHAR(64),
    "change_note" TEXT,
    "statut" "InterventionDocStatut" NOT NULL DEFAULT 'brouillon',
    "published_at" TIMESTAMP(3),
    "published_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intervention_document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_recipients" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "nom" VARCHAR(200),
    "role" "DocumentRecipientRole" NOT NULL,
    "famille" "InterventionFamille",
    "intervention_slug" VARCHAR(80),
    "trainer_id" UUID,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "intervention_documents_current_version_id_key" ON "intervention_documents"("current_version_id");

-- CreateIndex
CREATE INDEX "intervention_documents_famille_categorie_idx" ON "intervention_documents"("famille", "categorie");

-- CreateIndex
CREATE INDEX "intervention_documents_intervention_slug_idx" ON "intervention_documents"("intervention_slug");

-- CreateIndex
CREATE UNIQUE INDEX "intervention_documents_intervention_slug_slot_key" ON "intervention_documents"("intervention_slug", "slot");

-- CreateIndex
CREATE INDEX "intervention_document_versions_document_id_idx" ON "intervention_document_versions"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "intervention_document_versions_document_id_version_key" ON "intervention_document_versions"("document_id", "version");

-- CreateIndex
CREATE INDEX "document_recipients_role_idx" ON "document_recipients"("role");

-- CreateIndex
CREATE INDEX "document_recipients_famille_idx" ON "document_recipients"("famille");

-- AddForeignKey
ALTER TABLE "intervention_documents" ADD CONSTRAINT "intervention_documents_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "intervention_document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intervention_document_versions" ADD CONSTRAINT "intervention_document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "intervention_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
