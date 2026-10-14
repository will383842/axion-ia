-- Lot G2 — le bilan de fin de formation d'un formateur indépendant (une ligne par
-- formateur et par session) : évaluations finales des acquis et avis saisis depuis
-- son espace, puis « Terminer ». Le paiement par mission l'attend quand l'interrupteur
-- `formateurs.bilan_fin_formation` est allumé ; « payer quand même » est le geste de
-- l'administrateur (auteur, date, motif).
--
-- ADDITIVE seulement : une table neuve, vide. Aucun DROP, aucune ligne touchée.
-- L'avis lui-même reste une ligne de « appreciations » (qualité `formateur`) : la table
-- ne fait que la rattacher à la session, une seule par formateur et par session.

-- CreateTable
CREATE TABLE IF NOT EXISTS "bilans_fin_formation" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "appreciation_id" UUID,
    "termine_at" TIMESTAMP(3),
    "payer_quand_meme_at" TIMESTAMP(3),
    "payer_quand_meme_par_id" UUID,
    "payer_quand_meme_motif" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bilans_fin_formation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "bilans_fin_formation_appreciation_id_key" ON "bilans_fin_formation"("appreciation_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bilans_fin_formation_trainer_id_idx" ON "bilans_fin_formation"("trainer_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "bilans_fin_formation_session_id_trainer_id_key" ON "bilans_fin_formation"("session_id", "trainer_id");

-- AddForeignKey
ALTER TABLE "bilans_fin_formation" ADD CONSTRAINT "bilans_fin_formation_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "training_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bilans_fin_formation" ADD CONSTRAINT "bilans_fin_formation_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bilans_fin_formation" ADD CONSTRAINT "bilans_fin_formation_appreciation_id_fkey" FOREIGN KEY ("appreciation_id") REFERENCES "appreciations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
