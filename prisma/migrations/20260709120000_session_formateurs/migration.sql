-- CreateEnum
CREATE TYPE "SessionFormateurRole" AS ENUM ('principal', 'co_formateur', 'assistant', 'tuteur_afest');

-- CreateTable
CREATE TABLE "session_formateurs" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "role" "SessionFormateurRole" NOT NULL DEFAULT 'co_formateur',
    "heures_animees" DECIMAL(6,2),
    "tarif_ht_cents" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_formateurs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "session_formateur_unique" ON "session_formateurs"("session_id", "trainer_id");

-- CreateIndex
CREATE INDEX "session_formateurs_trainer_id_session_id_idx" ON "session_formateurs"("trainer_id", "session_id");

-- AddForeignKey
ALTER TABLE "session_formateurs" ADD CONSTRAINT "session_formateurs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_formateurs" ADD CONSTRAINT "session_formateurs_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Contrainte métier NON représentable en schéma Prisma (index partiel) : un seul
-- formateur `principal` par session. Appliquée en SQL brut ; inoffensive pour
-- `prisma migrate deploy` (prod). Caveat connu : un futur `prisma migrate dev`
-- pourrait vouloir la recréer/drop — la conserver telle quelle (cf. migrations_fts).
CREATE UNIQUE INDEX "session_formateur_un_principal" ON "session_formateurs"("session_id") WHERE "role" = 'principal';
