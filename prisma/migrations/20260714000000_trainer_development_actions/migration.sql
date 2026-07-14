-- Actions de développement des compétences des formateurs (indicateur RNQ 22).
-- Trace datée d'un entretien professionnel / formation suivie / veille — preuve
-- distincte du CV (ind. 21). Alimente la couverture off.22.
-- Migration ADDITIVE : aucun DROP, aucune colonne NOT NULL sans default.

-- CreateEnum
CREATE TYPE "TrainerDevelopmentActionType" AS ENUM ('entretien_professionnel', 'formation_suivie', 'veille', 'autre');

-- CreateTable
CREATE TABLE "trainer_development_actions" (
    "id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "type" "TrainerDevelopmentActionType" NOT NULL,
    "date_action" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trainer_development_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trainer_development_actions_trainer_id_idx" ON "trainer_development_actions"("trainer_id");

-- CreateIndex
CREATE INDEX "trainer_development_actions_date_action_idx" ON "trainer_development_actions"("date_action");

-- AddForeignKey
ALTER TABLE "trainer_development_actions" ADD CONSTRAINT "trainer_development_actions_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
