-- Contrat 2.8, art. 3.2 : un rendez-vous annulé ou non honoré est QUALIFIÉ par un administrateur (Axion IA ou l'entreprise).
-- ADDITIF SEUL, compatible avec les DEUX conteneurs (app et worker) : une table neuve, aucune clé étrangère,
-- aucune colonne ajoutée à une table existante, aucune énumération Postgres, aucun DROP.
-- Tout lecteur tolère la table absente (P2021).

CREATE TABLE "annulations_rendez_vous_presentation" (
  "id" UUID NOT NULL,
  "presentation_id" UUID NOT NULL,
  "rendez_vous_cle" VARCHAR(80) NOT NULL,
  "pris_at" TIMESTAMPTZ(3) NOT NULL,
  "prevu_at" TIMESTAMPTZ(3),
  "constatee_at" TIMESTAMPTZ(3) NOT NULL,
  "etat_source" VARCHAR(20) NOT NULL,
  "auteur" VARCHAR(12),
  "qualifiee_at" TIMESTAMPTZ(3),
  "qualifiee_par" VARCHAR(64),
  "motif" TEXT,
  "report_cle" VARCHAR(80),
  "report_lie_at" TIMESTAMPTZ(3),
  "validation_faite_at" TIMESTAMPTZ(3),
  "cree_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "annulations_rendez_vous_presentation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "annulations_rdv_presentation_cle_key"
  ON "annulations_rendez_vous_presentation" ("presentation_id", "rendez_vous_cle");
CREATE INDEX "annulations_rdv_auteur_constatee_idx"
  ON "annulations_rendez_vous_presentation" ("auteur", "constatee_at");

ALTER TABLE "annulations_rendez_vous_presentation" ADD CONSTRAINT "annulations_rdv_etat_source" CHECK (
  "etat_source" IN ('canceled', 'no_show', 'annule', 'absent', 'reporte')
);
ALTER TABLE "annulations_rendez_vous_presentation" ADD CONSTRAINT "annulations_rdv_auteur" CHECK (
  "auteur" IS NULL OR "auteur" IN ('axion', 'entreprise')
);
ALTER TABLE "annulations_rendez_vous_presentation" ADD CONSTRAINT "annulations_rdv_auteur_et_date" CHECK (
  ("auteur" IS NULL) = ("qualifiee_at" IS NULL)
);
ALTER TABLE "annulations_rendez_vous_presentation" ADD CONSTRAINT "annulations_rdv_motif_entreprise" CHECK (
  "auteur" IS DISTINCT FROM 'entreprise' OR "motif" IS NOT NULL
);

-- La qualification se pose UNE SEULE FOIS (de NULL à une valeur) et ne change plus : une erreur se corrige par une
-- ligne de journal d'audit et un geste super_admin documenté, jamais par un écrasement silencieux.
CREATE OR REPLACE FUNCTION "annulations_rdv_qualification_unique"() RETURNS trigger AS $$
BEGIN
  IF OLD."auteur" IS NOT NULL AND (
       NEW."auteur" IS DISTINCT FROM OLD."auteur"
    OR NEW."qualifiee_at" IS DISTINCT FROM OLD."qualifiee_at"
    OR NEW."qualifiee_par" IS DISTINCT FROM OLD."qualifiee_par"
  ) THEN
    RAISE EXCEPTION 'annulations_rendez_vous_presentation : la qualification est posée une seule fois'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "annulations_rdv_qualification_unique"
  BEFORE UPDATE ON "annulations_rendez_vous_presentation"
  FOR EACH ROW EXECUTE FUNCTION "annulations_rdv_qualification_unique"();
