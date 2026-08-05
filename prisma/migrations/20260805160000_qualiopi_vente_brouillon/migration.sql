-- Qualiopi — Parcours « Nouvelle vente » : table des brouillons du wizard.
--
-- Une TrainingSession ne peut pas être brouillon (colonnes NOT NULL, numéro
-- consommé à la création) : cette table porte l'état du wizard entre deux
-- visites. Payload minimisé (les PII n'y vivent que tant que le Client n'est
-- pas créé) ; purge RGPD par `retention_until` via le cron retention-purge.
CREATE TABLE IF NOT EXISTS "vente_brouillons" (
    "id" UUID NOT NULL,
    "etape" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "client_id" UUID,
    "devis_id" UUID,
    "session_id" UUID,
    "created_by_admin_id" UUID,
    "retention_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vente_brouillons_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "vente_brouillons_retention_until_idx"
    ON "vente_brouillons"("retention_until");
CREATE INDEX IF NOT EXISTS "vente_brouillons_created_by_admin_id_updated_at_idx"
    ON "vente_brouillons"("created_by_admin_id", "updated_at");

-- Contraintes gardées contre le rejeu (duplicate_object) : les IF NOT EXISTS
-- ci-dessus rendent la migration rejouable — des ADD CONSTRAINT nus casseraient
-- cette rejouabilité sur une base où l'objet existe déjà (reprise après échec
-- partiel, db push de dev).
DO $$ BEGIN
    ALTER TABLE "vente_brouillons"
        ADD CONSTRAINT "vente_brouillons_client_id_fkey"
        FOREIGN KEY ("client_id") REFERENCES "clients"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "vente_brouillons"
        ADD CONSTRAINT "vente_brouillons_devis_id_fkey"
        FOREIGN KEY ("devis_id") REFERENCES "devis"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "vente_brouillons"
        ADD CONSTRAINT "vente_brouillons_session_id_fkey"
        FOREIGN KEY ("session_id") REFERENCES "training_sessions"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
