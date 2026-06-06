-- T7 Qualiopi — documents légaux générés (React-PDF). Migration ADDITIVE.

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('convention', 'convention_tripartite', 'convocation', 'emargement', 'releve_connexion', 'positionnement', 'grille_evaluation', 'satisfaction', 'attestation', 'attestation_partielle', 'certificat_realisation', 'facture', 'kit_opco', 'kit_cpf', 'kit_france_travail', 'lettre_mission', 'reglement_interieur', 'livret_accueil');

-- CreateTable
CREATE TABLE "documents_generes" (
    "id" UUID NOT NULL,
    "type" "DocumentType" NOT NULL,
    "numero" VARCHAR(40) NOT NULL,
    "formation_id" UUID,
    "session_id" UUID,
    "trainee_id" UUID,
    "client_id" UUID,
    "pdf_url" TEXT,
    "hash_sha256" VARCHAR(64) NOT NULL,
    "size_bytes" INTEGER NOT NULL DEFAULT 0,
    "est_copie" BOOLEAN NOT NULL DEFAULT false,
    "qr_token" VARCHAR(64),
    "qr_token_created_at" TIMESTAMP(3),
    "envoye_at" TIMESTAMP(3),
    "suppression_prevue_at" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_generes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documents_generes_numero_key" ON "documents_generes"("numero");
CREATE UNIQUE INDEX "documents_generes_qr_token_key" ON "documents_generes"("qr_token");
CREATE INDEX "documents_generes_type_session_id_idx" ON "documents_generes"("type", "session_id");
CREATE INDEX "documents_generes_trainee_id_type_idx" ON "documents_generes"("trainee_id", "type");
CREATE INDEX "documents_generes_suppression_prevue_at_idx" ON "documents_generes"("suppression_prevue_at");

-- AddForeignKey
ALTER TABLE "documents_generes" ADD CONSTRAINT "documents_generes_formation_id_fkey" FOREIGN KEY ("formation_id") REFERENCES "formations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "documents_generes" ADD CONSTRAINT "documents_generes_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "training_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "documents_generes" ADD CONSTRAINT "documents_generes_trainee_id_fkey" FOREIGN KEY ("trainee_id") REFERENCES "trainees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "documents_generes" ADD CONSTRAINT "documents_generes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
