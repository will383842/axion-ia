-- Pièces jointes du formulaire de contact (décision de Will, 2026-10-15). AJOUT SEUL :
-- une nouvelle table `submission_attachments`, rattachée à `submissions`. Aucune
-- colonne ajoutée à une table existante, aucune ligne réécrite.
--
-- Fenêtre app/worker : seul l'APP lit et écrit cette table (formulaire et console) ; le
-- worker ne la connaît pas. Si la migration n'était pas passée, l'action garde la demande
-- et signale les pièces non enregistrées : aucun message n'est perdu.
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
    "sha256" VARCHAR(64) NOT NULL,
    "antivirus" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "submission_attachments_cle_stockage_key" ON "submission_attachments"("cle_stockage");

-- CreateIndex
CREATE INDEX "submission_attachments_submission_id_idx" ON "submission_attachments"("submission_id");

-- AddForeignKey
ALTER TABLE "submission_attachments" ADD CONSTRAINT "submission_attachments_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
