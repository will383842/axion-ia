-- Pièces jointes du formulaire de contact (décision de Will, 2026-10-15). AJOUT SEUL :
-- une nouvelle table `submission_attachments`, rattachée à `submissions`. Aucune
-- colonne ajoutée à une table existante, aucune ligne réécrite.
--
-- Fenêtre app/worker : l'APP écrit et lit cette table (formulaire et console) ; le WORKER
-- la lit aussi, une fois par heure, pour nettoyer les envois abandonnés
-- (`retention-purge`, tâche `pieces-jointes-contact`). Le worker atterrit avant l'app :
-- tant que la migration n'est pas passée, sa passe échoue, est journalisée et reprend à
-- l'heure suivante. Si la migration n'était pas passée côté app, l'action garde la
-- demande et ne délivre aucune URL d'envoi : aucun message n'est perdu.
--
-- Réversible :
--   DROP TABLE "submission_attachments";

-- CreateTable
CREATE TABLE "submission_attachments" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "nom_fichier" VARCHAR(160) NOT NULL,
    "format" VARCHAR(10) NOT NULL,
    "taille_octets" INTEGER NOT NULL,
    "cle_stockage" VARCHAR(300) NOT NULL,
    "statut" VARCHAR(20) NOT NULL DEFAULT 'attendue',
    "jeton_hash" VARCHAR(64),
    "motif_refus" VARCHAR(20),
    "sha256" VARCHAR(64),
    "antivirus" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "submission_attachments_cle_stockage_key" ON "submission_attachments"("cle_stockage");

-- CreateIndex
CREATE INDEX "submission_attachments_submission_id_idx" ON "submission_attachments"("submission_id");

-- CreateIndex
CREATE INDEX "submission_attachments_statut_created_at_idx" ON "submission_attachments"("statut", "created_at");

-- AddForeignKey
ALTER TABLE "submission_attachments" ADD CONSTRAINT "submission_attachments_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
