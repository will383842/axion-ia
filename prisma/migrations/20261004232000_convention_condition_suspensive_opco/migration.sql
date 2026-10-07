-- INT-T65-A (registre Partners) — convention conclue sous la condition
-- suspensive de l'accord de prise en charge de l'OPCO (C. civ. 1304 s.).
--
-- FORME D'A02, TELLE QUELLE (rattrapage 105) : sur la convention,
--   condition_suspensive_opco BOOLEAN NOT NULL DEFAULT false,
--   seuil_condition_bps       INTEGER     (points de base, 1 à 10 000),
--   seuil_condition_cents     INTEGER     (centimes, >= 1),
--   date_limite_condition     TIMESTAMPTZ(3),
-- avec trois CHECK nommés. S'y ajoute l'état fermé exigé par l'acceptance (2)
-- {en_attente, active, caduque}, et son CHECK de cohérence avec la case.
--
-- Porteur : `documents_generes`, la pièce que le client signe (types
-- `convention` et `convention_tripartite`).
--
-- Remplace la migration de préparation 20261004210000 (jamais appliquée en
-- production), qui portait une autre forme (`seuil_type`, `seuil_bps`,
-- `seuil_cents`, `date_limite DATE`).
--
-- AJOUTS SEULS, IDEMPOTENTS : aucune suppression, aucun renommage, aucune
-- recopie. Colonnes nullables, case à `false` : les conventions existantes
-- restent sans condition. AUCUN DEFAULT de seuil : le défaut de 50 % vit dans la
-- SSOT applicative (`SEUIL_CONDITION_SUSPENSIVE_OPCO_BPS`) et se pose à l'écran
-- au moment de cocher ; une convention ancienne ne reçoit aucun seuil qu'on ne
-- lui a pas donné. Aucun flottant : points de base et centimes entiers.
--
-- Fenêtre app/worker (~50 min) : l'ANCIENNE app n'écrit aucune de ces colonnes
-- et crée ses conventions avec la case à `false` (DEFAULT) et le reste à NULL,
-- ce que les CHECK acceptent ; le worker ne les lit pas.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "EtatConditionSuspensive" AS ENUM ('en_attente', 'active', 'caduque');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "documents_generes" ADD COLUMN IF NOT EXISTS "condition_suspensive_opco" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "documents_generes" ADD COLUMN IF NOT EXISTS "seuil_condition_bps" INTEGER;
ALTER TABLE "documents_generes" ADD COLUMN IF NOT EXISTS "seuil_condition_cents" INTEGER;
ALTER TABLE "documents_generes" ADD COLUMN IF NOT EXISTS "date_limite_condition" TIMESTAMPTZ(3);
ALTER TABLE "documents_generes" ADD COLUMN IF NOT EXISTS "etat_condition_suspensive" "EtatConditionSuspensive";

-- CHECK en SQL brut. NOT VALID puis VALIDATE : la table n'est pas vide, mais
-- les colonnes neuves le sont (false / NULL sur toute ligne existante), donc la
-- validation passe sans rien réécrire, sous un verrou SHARE UPDATE EXCLUSIVE.
DO $$ BEGIN
  -- Case non cochée → les trois NULL. Cochée → EXACTEMENT UN seuil et la date
  -- limite NON NULL.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'convention_condition_coherente') THEN
    ALTER TABLE "documents_generes" ADD CONSTRAINT "convention_condition_coherente" CHECK (
      (
        "condition_suspensive_opco" = false
        AND "seuil_condition_bps" IS NULL
        AND "seuil_condition_cents" IS NULL
        AND "date_limite_condition" IS NULL
      )
      OR (
        "condition_suspensive_opco" = true
        AND num_nonnulls("seuil_condition_bps", "seuil_condition_cents") = 1
        AND "date_limite_condition" IS NOT NULL
      )
    ) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'convention_seuil_bps_borne') THEN
    ALTER TABLE "documents_generes" ADD CONSTRAINT "convention_seuil_bps_borne"
      CHECK ("seuil_condition_bps" BETWEEN 1 AND 10000) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'convention_seuil_cents_positif') THEN
    ALTER TABLE "documents_generes" ADD CONSTRAINT "convention_seuil_cents_positif"
      CHECK ("seuil_condition_cents" >= 1) NOT VALID;
  END IF;

  -- État fermé : présent si et seulement si la case est cochée.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'convention_condition_etat_coherent') THEN
    ALTER TABLE "documents_generes" ADD CONSTRAINT "convention_condition_etat_coherent" CHECK (
      ("condition_suspensive_opco" = false AND "etat_condition_suspensive" IS NULL)
      OR ("condition_suspensive_opco" = true AND "etat_condition_suspensive" IS NOT NULL)
    ) NOT VALID;
  END IF;
END $$;

ALTER TABLE "documents_generes" VALIDATE CONSTRAINT "convention_condition_coherente";
ALTER TABLE "documents_generes" VALIDATE CONSTRAINT "convention_seuil_bps_borne";
ALTER TABLE "documents_generes" VALIDATE CONSTRAINT "convention_seuil_cents_positif";
ALTER TABLE "documents_generes" VALIDATE CONSTRAINT "convention_condition_etat_coherent";
