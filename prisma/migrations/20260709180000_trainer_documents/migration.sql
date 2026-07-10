-- Pièces justificatives des formateurs (pilier « gestion des formateurs »).
--
-- Additif pur : nouvelle table + 2 enums. Aucune donnée existante touchée,
-- aucun comportement changé (les contrôles de conformité qui s'appuient dessus
-- fonctionnent en mode ALERTE, jamais en blocage, tant que le seuil URSSAF n'a
-- pas été tranché par un juriste).
--
-- Contexte légal : art. L.8222-1 du Code du travail — dès 5 000 € HT de contrat
-- avec un prestataire indépendant, l'OF doit collecter son attestation de
-- vigilance URSSAF (< 6 mois) puis la renouveler tous les 6 mois. À défaut, il
-- est SOLIDAIREMENT responsable des cotisations impayées du prestataire.

-- CreateEnum
CREATE TYPE "TrainerDocumentType" AS ENUM ('contrat_travail', 'dpae', 'attestation_vigilance_urssaf', 'kbis_avis_sirene', 'nda_sous_traitant', 'attestation_qualiopi', 'assurance_rc_pro', 'contrat_sous_traitance', 'cv', 'diplome', 'certification', 'autre');

-- CreateEnum
CREATE TYPE "DocumentValidationStatut" AS ENUM ('en_attente', 'valide', 'rejete');

-- CreateTable
CREATE TABLE "trainer_documents" (
    "id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "type" "TrainerDocumentType" NOT NULL,
    "numero_piece" VARCHAR(60),
    "fichier_url" TEXT,
    "hash_sha256" VARCHAR(64),
    "date_emission" TIMESTAMP(3),
    "date_expiration" TIMESTAMP(3),
    "statut_validation" "DocumentValidationStatut" NOT NULL DEFAULT 'en_attente',
    "valide_par_user_id" UUID,
    "valide_at" TIMESTAMP(3),
    "rejet_motif" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trainer_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trainer_documents_trainer_id_idx" ON "trainer_documents"("trainer_id");

-- CreateIndex
CREATE INDEX "trainer_documents_type_idx" ON "trainer_documents"("type");

-- CreateIndex
CREATE INDEX "trainer_documents_statut_validation_idx" ON "trainer_documents"("statut_validation");

-- CreateIndex — pilote les alertes d'expiration (RC pro, vigilance, NDA)
CREATE INDEX "trainer_documents_date_expiration_idx" ON "trainer_documents"("date_expiration");

-- AddForeignKey
ALTER TABLE "trainer_documents" ADD CONSTRAINT "trainer_documents_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
