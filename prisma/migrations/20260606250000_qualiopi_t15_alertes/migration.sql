-- T15 Qualiopi — Alertes système (catalogue §6.5) + emails auto + SSE.
-- Migration ADDITIVE : 1 enum + 1 table + index. Dérive préexistante IGNORÉE.

-- CreateEnum
CREATE TYPE "AlerteNiveau" AS ENUM ('info', 'important', 'critique');

-- CreateTable
CREATE TABLE "alertes_systeme" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "niveau" "AlerteNiveau" NOT NULL,
    "titre" VARCHAR(300) NOT NULL,
    "message" TEXT NOT NULL,
    "cible_type" VARCHAR(80),
    "cible_id" UUID,
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "resolue" BOOLEAN NOT NULL DEFAULT false,
    "resolue_at" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alertes_systeme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alertes_systeme_code_idx" ON "alertes_systeme"("code");

-- CreateIndex
CREATE INDEX "alertes_systeme_resolue_idx" ON "alertes_systeme"("resolue");

-- CreateIndex
CREATE INDEX "alertes_systeme_niveau_idx" ON "alertes_systeme"("niveau");

-- CreateIndex
CREATE INDEX "alertes_systeme_cible_type_cible_id_idx" ON "alertes_systeme"("cible_type", "cible_id");
