-- Formateurs indépendants — ÉVALUATION DES COMPÉTENCES PÉDAGOGIQUES (Qualiopi ind. 21,
-- non-conformité majeure de l'audit du 16/10).
-- ADDITIF uniquement : deux énumérations et une table neuves, aucun DROP, aucun RENAME,
-- aucune reprise de données, aucune colonne touchée sur une table existante.
--
-- La table est en AJOUT SEUL : les triggers réutilisent la fonction
-- `formateurs_preuve_ajout_seul` posée par `20261010150000_formateurs_socle`.
-- Objets bruts déclarés dans
-- `src/server/qualiopi/formateurs-independants/evaluation-competences/objets-sql.ts`.
--
-- Aucun lecteur de cette table dans le worker tant que `formateurs.garde_mission_portes`
-- est coupé : la fenêtre app/worker ne dissocie aucun contrat.

-- ═══ 1. PRISMA ═════════════════════════════════════════════════════════════════
-- CreateEnum
CREATE TYPE "nature_evaluation_competence" AS ENUM ('entretien', 'mise_en_situation', 'decision_habilitation', 'formation_methode');

-- CreateEnum
CREATE TYPE "decision_habilitation_formateur" AS ENUM ('habilite', 'avec_reserve', 'non_habilite', 'second_essai');

-- CreateTable
CREATE TABLE "evaluations_competences_formateur" (
    "id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "nature" "nature_evaluation_competence" NOT NULL,
    "formation_id" UUID,
    "notes" JSONB,
    "decision" "decision_habilitation_formateur",
    "motif" TEXT,
    "date_suivie" TIMESTAMP(3),
    "entretien_id" UUID,
    "mise_en_situation_id" UUID,
    "seuils_appliques" JSONB,
    "version" INTEGER NOT NULL,
    "auteur_id" UUID NOT NULL,
    "auteur_role" VARCHAR(40) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluations_competences_formateur_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evaluations_competences_formateur_trainer_id_nature_created_idx" ON "evaluations_competences_formateur"("trainer_id", "nature", "created_at");

-- CreateIndex
CREATE INDEX "evaluations_competences_formateur_formation_id_idx" ON "evaluations_competences_formateur"("formation_id");

-- AddForeignKey
ALTER TABLE "evaluations_competences_formateur" ADD CONSTRAINT "evaluations_competences_formateur_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations_competences_formateur" ADD CONSTRAINT "evaluations_competences_formateur_formation_id_fkey" FOREIGN KEY ("formation_id") REFERENCES "formations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ═══ 2. SQL BRUT — CHECK, TRIGGERS ═════════════════════════════════════════════

ALTER TABLE "evaluations_competences_formateur" ADD CONSTRAINT "evaluations_competences_formateur_coherente" CHECK (
  ("nature" IN ('entretien', 'mise_en_situation')
     AND "notes" IS NOT NULL AND "decision" IS NULL AND "formation_id" IS NULL)
  OR ("nature" = 'decision_habilitation'
     AND "decision" IS NOT NULL AND "formation_id" IS NOT NULL AND "entretien_id" IS NOT NULL
     AND "motif" IS NOT NULL AND length(btrim("motif")) > 0)
  OR ("nature" = 'formation_methode'
     AND "date_suivie" IS NOT NULL AND "decision" IS NULL AND "formation_id" IS NULL)
);

CREATE TRIGGER "evaluations_competences_formateur_ajout_seul"
  BEFORE UPDATE OR DELETE ON "evaluations_competences_formateur"
  FOR EACH ROW EXECUTE FUNCTION "formateurs_preuve_ajout_seul"();

CREATE TRIGGER "evaluations_competences_formateur_pas_de_truncate"
  BEFORE TRUNCATE ON "evaluations_competences_formateur"
  FOR EACH STATEMENT EXECUTE FUNCTION "formateurs_preuve_ajout_seul"();
