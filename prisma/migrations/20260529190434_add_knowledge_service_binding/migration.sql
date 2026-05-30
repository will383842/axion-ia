-- KB V4.1 Service Binding — migration STRICTEMENT ADDITIVE (Sprint 2026-05-29).
--
-- Écrite à la main (PAS `prisma migrate diff`) pour n'inclure QUE le nouvel
-- enum + la nouvelle table. La base locale/prod porte un drift Prisma connu
-- (cf. AGENTS.md / migrations isolées) : un diff auto embarquerait des
-- DROP INDEX / DROP COLUMN destructeurs hors-périmètre. Ici : zéro ALTER/DROP
-- sur l'existant → backward-compatible, `prisma migrate deploy` au boot prod
-- ne peut pas casser l'existant.

-- CreateEnum
CREATE TYPE "kb_audience_target" AS ENUM ('dirigeant', 'equipe', 'technique', 'generale');

-- CreateTable
CREATE TABLE "knowledge_service_bindings" (
    "id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "service_kind" VARCHAR(60) NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "audience_target" "kb_audience_target",
    "source" VARCHAR(20) NOT NULL DEFAULT 'seed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_service_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_service_bindings_entry_id_service_kind_key" ON "knowledge_service_bindings"("entry_id", "service_kind");

-- CreateIndex
CREATE INDEX "knowledge_service_bindings_service_kind_is_primary_idx" ON "knowledge_service_bindings"("service_kind", "is_primary");

-- AddForeignKey
ALTER TABLE "knowledge_service_bindings" ADD CONSTRAINT "knowledge_service_bindings_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "knowledge_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
