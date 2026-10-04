-- Lot OPCO A8 — envoi du dossier prêt à déposer à l'entreprise, relances
-- « dépôt fait ? » / « réponse de l'OPCO ? », réponses en un clic par jeton.
-- AJOUTS SEULS : deux tables neuves, aucune colonne touchée ailleurs.

CREATE TABLE "opco_suivi_entreprise" (
    "id" UUID NOT NULL,
    "dossier_id" UUID NOT NULL,
    "envoye_le" TIMESTAMPTZ(6) NOT NULL,
    "envoi_automatique" BOOLEAN NOT NULL,
    "zip_key" VARCHAR(300),
    "zip_nom" VARCHAR(200),
    "relances_arretees_le" TIMESTAMPTZ(6),
    "refus_declare_le" TIMESTAMPTZ(6),
    "accord_fichier_key" VARCHAR(300),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "opco_suivi_entreprise_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "opco_suivi_messages" (
    "id" UUID NOT NULL,
    "suivi_id" UUID NOT NULL,
    "etape" VARCHAR(20) NOT NULL,
    "rang" INTEGER NOT NULL,
    "question" VARCHAR(10) NOT NULL,
    "envoye_le" TIMESTAMPTZ(6) NOT NULL,
    "jour_paris" VARCHAR(10) NOT NULL,
    "jeton_hash" VARCHAR(64) NOT NULL,
    "jeton_expire_le" TIMESTAMPTZ(6) NOT NULL,
    "reponse" VARCHAR(12),
    "repondu_le" TIMESTAMPTZ(6),

    CONSTRAINT "opco_suivi_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "opco_suivi_entreprise_dossier_id_key" ON "opco_suivi_entreprise"("dossier_id");
CREATE UNIQUE INDEX "opco_suivi_messages_jeton_hash_key" ON "opco_suivi_messages"("jeton_hash");
CREATE UNIQUE INDEX "opco_suivi_messages_suivi_id_etape_rang_key" ON "opco_suivi_messages"("suivi_id", "etape", "rang");
CREATE INDEX "opco_suivi_messages_suivi_id_idx" ON "opco_suivi_messages"("suivi_id");

ALTER TABLE "opco_suivi_entreprise" ADD CONSTRAINT "opco_suivi_entreprise_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers_financement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "opco_suivi_messages" ADD CONSTRAINT "opco_suivi_messages_suivi_id_fkey" FOREIGN KEY ("suivi_id") REFERENCES "opco_suivi_entreprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Valeurs fermées, vérifiées en base (tables neuves : NOT VALID par prudence, aucune ligne à relire).
ALTER TABLE "opco_suivi_messages" ADD CONSTRAINT "opco_suivi_messages_etape_check"
  CHECK ("etape" IN ('envoi', 'relance_depot', 'relance_reponse')) NOT VALID;
ALTER TABLE "opco_suivi_messages" ADD CONSTRAINT "opco_suivi_messages_question_check"
  CHECK ("question" IN ('depot', 'reponse')) NOT VALID;
ALTER TABLE "opco_suivi_messages" ADD CONSTRAINT "opco_suivi_messages_reponse_check"
  CHECK ("reponse" IS NULL OR "reponse" IN ('oui', 'pas_encore', 'accord', 'refus')) NOT VALID;
ALTER TABLE "opco_suivi_messages" ADD CONSTRAINT "opco_suivi_messages_rang_check"
  CHECK ("rang" >= 0 AND "rang" <= 10) NOT VALID;
