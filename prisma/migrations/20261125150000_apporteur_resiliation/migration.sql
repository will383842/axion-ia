-- Lot L1b : résiliation en deux temps (notification, puis prise d'effet). Table neuve, additive.
CREATE TABLE IF NOT EXISTS "apporteur_resiliation" (
  "apporteur_id" UUID NOT NULL,
  "initiative" VARCHAR(12) NOT NULL,
  "fondement" VARCHAR(8) NOT NULL,
  "notifiee_le" TIMESTAMPTZ(3) NOT NULL,
  "effet_le" TIMESTAMPTZ(3) NOT NULL,
  "mise_en_demeure_le" TIMESTAMPTZ(3),
  "motif" TEXT,
  "par_id" VARCHAR(64) NOT NULL,
  "cree_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "executee_at" TIMESTAMPTZ(3),
  "email_notif_envoye_at" TIMESTAMPTZ(3),
  "email_effet_envoye_at" TIMESTAMPTZ(3),
  CONSTRAINT "apporteur_resiliation_pkey" PRIMARY KEY ("apporteur_id")
);
CREATE INDEX IF NOT EXISTS "apporteur_resiliation_effet_le_executee_at_idx"
  ON "apporteur_resiliation" ("effet_le", "executee_at");
