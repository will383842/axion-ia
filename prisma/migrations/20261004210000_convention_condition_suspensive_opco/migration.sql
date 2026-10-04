-- INT-T65-A (registre Partners) — convention conclue sous la condition
-- suspensive de l'accord de prise en charge de l'OPCO (C. civ. 1304 s.).
--
-- Porteur : `documents_generes`, la pièce que le client signe (types
-- `convention` et `convention_tripartite`). La clause imprimée et ses
-- paramètres vivent sur la même ligne que le numéro et l'empreinte.
--
-- AJOUTS SEULS, IDEMPOTENTS : aucun DROP, aucun RENAME, aucune recopie.
-- `condition_suspensive_opco` part à `false` et tout le reste à NULL : aucune
-- pièce existante ne change de sens. Aucun flottant : points de base et
-- centimes entiers.
--
-- Fenêtre app/worker (~50 min) : le worker ne lit aucune de ces colonnes, et
-- aucune valeur des deux énumérations n'est employée dans cette migration.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SeuilConditionSuspensiveType" AS ENUM ('pourcentage', 'montant');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "EtatConditionSuspensive" AS ENUM ('en_attente', 'active', 'caduque');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "documents_generes" ADD COLUMN IF NOT EXISTS "condition_suspensive_opco" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "documents_generes" ADD COLUMN IF NOT EXISTS "seuil_type" "SeuilConditionSuspensiveType";
ALTER TABLE "documents_generes" ADD COLUMN IF NOT EXISTS "seuil_bps" INTEGER;
ALTER TABLE "documents_generes" ADD COLUMN IF NOT EXISTS "seuil_cents" INTEGER;
ALTER TABLE "documents_generes" ADD COLUMN IF NOT EXISTS "date_limite" DATE;
ALTER TABLE "documents_generes" ADD COLUMN IF NOT EXISTS "etat_condition_suspensive" "EtatConditionSuspensive";

-- Exactement un seuil, selon `seuil_type`, quand la condition est posée ; aucun
-- seuil quand elle ne l'est pas. Bornes : 1 à 10000 points de base, centimes
-- strictement positifs (un seuil nul ne conditionne rien).
--
-- NOT VALID puis VALIDATE : la table n'est pas vide, mais les colonnes neuves
-- le sont (false / NULL sur toute ligne existante), donc la validation passe
-- sans rien réécrire. Le VALIDATE ne prend qu'un verrou SHARE UPDATE EXCLUSIVE.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'documents_generes_condition_suspensive_seuil_check'
  ) THEN
    ALTER TABLE "documents_generes"
      ADD CONSTRAINT "documents_generes_condition_suspensive_seuil_check" CHECK (
        (
          "condition_suspensive_opco" = false
          AND "seuil_type" IS NULL
          AND "seuil_bps" IS NULL
          AND "seuil_cents" IS NULL
        )
        OR (
          "condition_suspensive_opco" = true
          AND "seuil_type" = 'pourcentage'
          AND "seuil_bps" IS NOT NULL
          AND "seuil_bps" BETWEEN 1 AND 10000
          AND "seuil_cents" IS NULL
        )
        OR (
          "condition_suspensive_opco" = true
          AND "seuil_type" = 'montant'
          AND "seuil_cents" IS NOT NULL
          AND "seuil_cents" > 0
          AND "seuil_bps" IS NULL
        )
      ) NOT VALID;
  END IF;
END $$;

ALTER TABLE "documents_generes" VALIDATE CONSTRAINT "documents_generes_condition_suspensive_seuil_check";
