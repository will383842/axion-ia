-- Qualiopi ind. 21 (NC majeure) — le suivi de la qualité pédagogique des intervenants
-- externes dans la durée : observation de la 1re mission, grille après chaque mission,
-- réévaluation annuelle, et décisions motivées (entretien, reprise après suspension).
--
-- ADDITIVE seulement : deux énumérations et deux tables neuves, vides. Aucun DROP, aucune
-- ligne existante touchée. Interrupteur `formateurs.suivi_qualite` livré éteint.
--
-- AJOUT SEUL : une grille ou une décision ne se modifie ni ne se supprime (trigger
-- `formateurs_preuve_ajout_seul`, posé par le schéma n° 1 des formateurs). Une correction
-- est une nouvelle ligne ; la plus récente fait foi.

-- CreateEnum
CREATE TYPE "TypeGrilleSuiviFormateur" AS ENUM ('observation', 'evaluation_mission', 'reevaluation');

-- CreateEnum
CREATE TYPE "TypeDecisionSuiviFormateur" AS ENUM ('entretien', 'levee_suspension');

-- CreateTable
CREATE TABLE "grilles_suivi_formateur" (
    "id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "session_id" UUID,
    "type" "TypeGrilleSuiviFormateur" NOT NULL,
    "numero" INTEGER NOT NULL,
    "version_grille" INTEGER NOT NULL,
    "criteres" JSONB NOT NULL,
    "moyenne_centiemes" INTEGER NOT NULL,
    "favorable" BOOLEAN NOT NULL,
    "conclusion" TEXT NOT NULL,
    "observateur" VARCHAR(200),
    "date_evaluation" TIMESTAMP(3) NOT NULL,
    "satisfaction_saisie" INTEGER,
    "auteur_id" UUID NOT NULL,
    "auteur_nom" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grilles_suivi_formateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decisions_suivi_formateur" (
    "id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "session_id" UUID,
    "type" "TypeDecisionSuiviFormateur" NOT NULL,
    "motif" TEXT NOT NULL,
    "auteur_id" UUID NOT NULL,
    "auteur_nom" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decisions_suivi_formateur_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "grilles_suivi_formateur_trainer_id_type_idx" ON "grilles_suivi_formateur"("trainer_id", "type");

-- CreateIndex
CREATE INDEX "grilles_suivi_formateur_session_id_idx" ON "grilles_suivi_formateur"("session_id");

-- CreateIndex
CREATE INDEX "decisions_suivi_formateur_trainer_id_idx" ON "decisions_suivi_formateur"("trainer_id");

-- CreateIndex
CREATE INDEX "decisions_suivi_formateur_session_id_idx" ON "decisions_suivi_formateur"("session_id");

-- AddForeignKey
ALTER TABLE "grilles_suivi_formateur" ADD CONSTRAINT "grilles_suivi_formateur_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grilles_suivi_formateur" ADD CONSTRAINT "grilles_suivi_formateur_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "training_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions_suivi_formateur" ADD CONSTRAINT "decisions_suivi_formateur_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions_suivi_formateur" ADD CONSTRAINT "decisions_suivi_formateur_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "training_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ── Ce qu'une grille doit porter (SQL brut, invisible à `migrate diff`) ──────────────
ALTER TABLE "grilles_suivi_formateur" ADD CONSTRAINT "grilles_suivi_formateur_valeurs" CHECK (
  "numero" >= 1
  AND "version_grille" >= 1
  AND "moyenne_centiemes" BETWEEN 100 AND 500
  AND ("satisfaction_saisie" IS NULL OR "satisfaction_saisie" BETWEEN 1 AND 5)
  AND jsonb_typeof("criteres") = 'array'
  AND jsonb_array_length("criteres") > 0
  AND length(btrim("conclusion")) > 0
  AND length(btrim("auteur_nom")) > 0
);

-- Une observation ou une grille après mission est rattachée à sa session ; l'observation
-- nomme son observateur. La réévaluation annuelle porte sur le formateur.
ALTER TABLE "grilles_suivi_formateur" ADD CONSTRAINT "grilles_suivi_formateur_rattachement" CHECK (
  ("type" = 'reevaluation' OR "session_id" IS NOT NULL)
  AND ("type" <> 'observation' OR length(btrim(coalesce("observateur", ''))) > 0)
);

ALTER TABLE "decisions_suivi_formateur" ADD CONSTRAINT "decisions_suivi_formateur_motif" CHECK (
  length(btrim("motif")) > 0 AND length(btrim("auteur_nom")) > 0
);

-- ── Ajout seul ──────────────────────────────────────────────────────────────────────
CREATE TRIGGER "grilles_suivi_formateur_ajout_seul"
  BEFORE UPDATE OR DELETE ON "grilles_suivi_formateur"
  FOR EACH ROW EXECUTE FUNCTION "formateurs_preuve_ajout_seul"();

CREATE TRIGGER "grilles_suivi_formateur_pas_de_truncate"
  BEFORE TRUNCATE ON "grilles_suivi_formateur"
  FOR EACH STATEMENT EXECUTE FUNCTION "formateurs_preuve_ajout_seul"();

CREATE TRIGGER "decisions_suivi_formateur_ajout_seul"
  BEFORE UPDATE OR DELETE ON "decisions_suivi_formateur"
  FOR EACH ROW EXECUTE FUNCTION "formateurs_preuve_ajout_seul"();

CREATE TRIGGER "decisions_suivi_formateur_pas_de_truncate"
  BEFORE TRUNCATE ON "decisions_suivi_formateur"
  FOR EACH STATEMENT EXECUTE FUNCTION "formateurs_preuve_ajout_seul"();
