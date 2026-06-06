-- T10 Qualiopi — Questionnaires (satisfaction chaud/froid + positionnement).
-- Indicateur 31 (collecte/exploitation satisfaction) + off.8. Migration ADDITIVE
-- uniquement : 1 enum + 1 table + index + FK. Indicateurs Qualiopi = calculés
-- (aucune table) + cache Redis. Dérive préexistante du migrate diff IGNORÉE.

-- CreateEnum
CREATE TYPE "QuestionnaireType" AS ENUM ('positionnement', 'satisfaction_chaud', 'satisfaction_froid');

-- CreateTable
CREATE TABLE "questionnaires" (
    "id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "type" "QuestionnaireType" NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "reponses" JSONB NOT NULL DEFAULT '{}',
    "note_globale" INTEGER,
    "envoye_at" TIMESTAMP(3),
    "repondu_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questionnaires_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "questionnaires_token_key" ON "questionnaires"("token");

-- CreateIndex
CREATE INDEX "questionnaires_enrollment_id_idx" ON "questionnaires"("enrollment_id");

-- CreateIndex
CREATE INDEX "questionnaires_type_idx" ON "questionnaires"("type");

-- CreateIndex
CREATE UNIQUE INDEX "questionnaire_unique_per_type" ON "questionnaires"("enrollment_id", "type");

-- AddForeignKey
ALTER TABLE "questionnaires" ADD CONSTRAINT "questionnaires_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
