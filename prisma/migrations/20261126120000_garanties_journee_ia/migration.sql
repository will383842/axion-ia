-- Garantie Journée IA, suivi des remboursements (PR 2/3, 2026-11-25).
-- STRICTEMENT ADDITIF : une table neuve, ses index et ses clés étrangères (ALTER sur la table neuve seulement).
-- Aucun ALTER d'une table existante, aucun DROP, aucune énumération Postgres, aucun INSERT/UPDATE.
-- Aucun code worker ne lit cette table (cron en PR 3, après preuve en production : prisma migrate status).
-- Retour arrière (JAMAIS exécuté par défaut, la table reste en place) : DROP TABLE "garanties_journee_ia";

-- CreateTable
CREATE TABLE "garanties_journee_ia" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "devis_id" UUID,
    "audit_mission_id" UUID,
    "facture_id" UUID,
    "avoir_id" UUID,
    "siren_snapshot" VARCHAR(14),
    "prix_ht_cents" INTEGER NOT NULL,
    "seuil_ht_cents" INTEGER NOT NULL,
    "total_gains_cents" INTEGER,
    "montant_rembourse_cents" INTEGER,
    "montant_avoir_ht_cents" INTEGER,
    "date_journee" DATE NOT NULL,
    "rapport_remis_le" DATE,
    "demande_recue_le" DATE,
    "decision_le" DATE,
    "avoir_emis_le" DATE,
    "virement_le" DATE,
    "decision" VARCHAR(20), -- remboursement | refus | avoir (texte contrôlé côté code)
    "motif_decision" TEXT,
    "notes" TEXT,
    "archive_le" TIMESTAMPTZ(3),
    "cree_par" VARCHAR(80),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "garanties_journee_ia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "garanties_journee_ia_audit_mission_id_key" ON "garanties_journee_ia"("audit_mission_id");

-- CreateIndex
CREATE INDEX "garanties_journee_ia_archive_le_date_journee_idx" ON "garanties_journee_ia"("archive_le", "date_journee");

-- CreateIndex
CREATE INDEX "garanties_journee_ia_client_id_idx" ON "garanties_journee_ia"("client_id");

-- CreateIndex
CREATE INDEX "garanties_journee_ia_siren_snapshot_idx" ON "garanties_journee_ia"("siren_snapshot");

-- AddForeignKey
ALTER TABLE "garanties_journee_ia" ADD CONSTRAINT "garanties_journee_ia_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garanties_journee_ia" ADD CONSTRAINT "garanties_journee_ia_devis_id_fkey" FOREIGN KEY ("devis_id") REFERENCES "devis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garanties_journee_ia" ADD CONSTRAINT "garanties_journee_ia_audit_mission_id_fkey" FOREIGN KEY ("audit_mission_id") REFERENCES "audit_missions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garanties_journee_ia" ADD CONSTRAINT "garanties_journee_ia_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "factures_formation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garanties_journee_ia" ADD CONSTRAINT "garanties_journee_ia_avoir_id_fkey" FOREIGN KEY ("avoir_id") REFERENCES "factures_formation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

