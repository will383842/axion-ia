-- Contrat 2.8, art. 3.5 et 3.3 bis c : la file d'attente des déclarations conservées (2 au plus par entreprise).
-- ADDITIF SEUL, compatible avec les DEUX conteneurs (app et worker) : une table neuve, aucune clé étrangère,
-- aucune colonne ajoutée à une table existante, aucune énumération Postgres, aucun DROP.
-- Tout lecteur tolère la table absente (P2021).

CREATE TABLE "declarations_en_attente" (
  "id" UUID NOT NULL,
  "presentation_id" UUID NOT NULL,
  "apporteur_id" UUID NOT NULL,
  "siren" CHAR(9) NOT NULL,
  "siret" CHAR(14),
  "cle_file" VARCHAR(14) NOT NULL,
  "recue_at" TIMESTAMPTZ(3) NOT NULL,
  "statut" VARCHAR(16) NOT NULL DEFAULT 'en_attente',
  "informee_at" TIMESTAMPTZ(3),
  "fenetre_fin_at" TIMESTAMPTZ(3),
  "fenetre_suspendue_jours" INTEGER,
  "email_job_id" VARCHAR(120),
  "redeclaree_presentation_id" UUID,
  "cloturee_at" TIMESTAMPTZ(3),
  "cree_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "declarations_en_attente_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "declarations_en_attente_presentation_id_key"
  ON "declarations_en_attente" ("presentation_id");
CREATE INDEX "declarations_en_attente_cle_file_statut_recue_at_idx"
  ON "declarations_en_attente" ("cle_file", "statut", "recue_at");
CREATE INDEX "declarations_en_attente_statut_fenetre_fin_at_idx"
  ON "declarations_en_attente" ("statut", "fenetre_fin_at");

-- Un seul premier rang informé à la fois, par clé de file.
CREATE UNIQUE INDEX "declarations_en_attente_un_seul_informe"
  ON "declarations_en_attente" ("cle_file") WHERE "statut" = 'informee';

ALTER TABLE "declarations_en_attente" ADD CONSTRAINT "declarations_en_attente_statut" CHECK (
  "statut" IN ('en_attente', 'informee', 'redeclaree', 'effacee', 'eteinte')
);
ALTER TABLE "declarations_en_attente" ADD CONSTRAINT "declarations_en_attente_informee_dates" CHECK (
  "statut" <> 'informee' OR ("informee_at" IS NOT NULL AND "fenetre_fin_at" IS NOT NULL)
);
ALTER TABLE "declarations_en_attente" ADD CONSTRAINT "declarations_en_attente_cloturee_date" CHECK (
  "statut" NOT IN ('redeclaree', 'effacee', 'eteinte') OR "cloturee_at" IS NOT NULL
);

-- Transitions permises : en_attente -> informee | eteinte ; informee -> redeclaree | effacee | eteinte.
-- Les colonnes d'identité et de rang sont figées. Aucune suppression.
CREATE OR REPLACE FUNCTION "declarations_en_attente_transitions"() RETURNS trigger AS $$
BEGIN
  IF NEW."statut" IS DISTINCT FROM OLD."statut" AND NOT (
       (OLD."statut" = 'en_attente' AND NEW."statut" IN ('informee', 'eteinte'))
    OR (OLD."statut" = 'informee' AND NEW."statut" IN ('redeclaree', 'effacee', 'eteinte'))
  ) THEN
    RAISE EXCEPTION 'declarations_en_attente : transition % -> % interdite', OLD."statut", NEW."statut"
      USING ERRCODE = '23514';
  END IF;
  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."presentation_id" IS DISTINCT FROM OLD."presentation_id"
    OR NEW."apporteur_id" IS DISTINCT FROM OLD."apporteur_id"
    OR NEW."siren" IS DISTINCT FROM OLD."siren"
    OR NEW."siret" IS DISTINCT FROM OLD."siret"
    OR NEW."cle_file" IS DISTINCT FROM OLD."cle_file"
    OR NEW."recue_at" IS DISTINCT FROM OLD."recue_at"
    OR NEW."cree_at" IS DISTINCT FROM OLD."cree_at"
  THEN
    RAISE EXCEPTION 'declarations_en_attente : identité et rang figés'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "declarations_en_attente_transitions"
  BEFORE UPDATE ON "declarations_en_attente"
  FOR EACH ROW EXECUTE FUNCTION "declarations_en_attente_transitions"();

CREATE OR REPLACE FUNCTION "declarations_en_attente_pas_de_suppression"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'declarations_en_attente : aucune suppression' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "declarations_en_attente_pas_de_suppression"
  BEFORE DELETE ON "declarations_en_attente"
  FOR EACH ROW EXECUTE FUNCTION "declarations_en_attente_pas_de_suppression"();
