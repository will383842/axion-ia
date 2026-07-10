-- Commissionnement des formateurs (pilier C) — persistance.
--
-- Le moteur de calcul est pur et déjà testé
-- (`src/server/qualiopi/remuneration/calcul.ts`, 46 tests). Ces tables ne font
-- que persister ce qu'il produit.
--
-- Additif pur : 6 enums + 3 tables + 1 colonne sur `trainers`. Aucune donnée
-- existante touchée, aucun comportement changé.
--
-- Deux invariants portés par le schéma :
--   1. `trainer_compensation_rules` est APPEND-ONLY : on ne mute jamais un taux,
--      on clôt l'ancien (`effective_to`) et on en crée un nouveau. C'est ce qui
--      garantit que changer un taux en septembre ne recalcule jamais juin.
--   2. `trainer_statements` est UNIQUE par (formateur, année, mois) : impossible
--      d'émettre deux relevés pour le même mois, même si le calcul est relancé.

-- CreateEnum
CREATE TYPE "CompensationModel" AS ENUM ('taux_journalier', 'taux_horaire', 'commission_ca_pct', 'forfait_prestation');

-- CreateEnum
CREATE TYPE "PrestationType" AS ENUM ('formation_collective', 'coaching_1to1', 'audit');

-- CreateEnum
CREATE TYPE "FeeLineNature" AS ENUM ('analytique', 'honoraire_du');

-- CreateEnum
CREATE TYPE "FeeLineStatut" AS ENUM ('previsionnel', 'calcule', 'valide', 'annule');

-- CreateEnum
CREATE TYPE "StatementStatut" AS ENUM ('brouillon', 'a_valider', 'valide', 'facture_recue', 'paye', 'annule');

-- CreateEnum
CREATE TYPE "TvaRegimeHonoraires" AS ENUM ('franchise_293b', 'exonere_formation', 'assujetti_20');

-- AlterTable — régime de TVA des honoraires du formateur (renseigné par un humain)
ALTER TABLE "trainers" ADD COLUMN     "regime_tva_honoraires" "TvaRegimeHonoraires";

-- CreateTable
CREATE TABLE "trainer_compensation_rules" (
    "id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "prestation_type" "PrestationType",
    "intervention_slug" VARCHAR(80),
    "model" "CompensationModel" NOT NULL,
    "taux_journee_ht_cents" INTEGER,
    "taux_horaire_ht_cents" INTEGER,
    "commission_pct" DECIMAL(5,2),
    "forfait_ht_cents" INTEGER,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "note" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trainer_compensation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainer_fee_lines" (
    "id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "prestation_type" "PrestationType" NOT NULL,
    "session_id" UUID,
    "coaching_session_id" UUID,
    "booking_id" UUID,
    "rule_id" UUID,
    "model" "CompensationModel" NOT NULL,
    "nature" "FeeLineNature" NOT NULL,
    "taux_snapshot_cents" INTEGER,
    "commission_pct_snapshot" DECIMAL(5,2),
    "heures" DECIMAL(6,2),
    "nb_jours" DECIMAL(6,2),
    "ca_base_cents" INTEGER,
    "montant_ht_cents" INTEGER NOT NULL DEFAULT 0,
    "statut" "FeeLineStatut" NOT NULL DEFAULT 'previsionnel',
    "motif" TEXT,
    "periode_year" INTEGER NOT NULL,
    "periode_month" INTEGER NOT NULL,
    "statement_id" UUID,
    "calculated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trainer_fee_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainer_statements" (
    "id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "periode_year" INTEGER NOT NULL,
    "periode_month" INTEGER NOT NULL,
    "statut" "StatementStatut" NOT NULL DEFAULT 'brouillon',
    "total_ht_cents" INTEGER NOT NULL DEFAULT 0,
    "tva_regime" "TvaRegimeHonoraires" NOT NULL,
    "tva_cents" INTEGER NOT NULL DEFAULT 0,
    "total_ttc_cents" INTEGER NOT NULL DEFAULT 0,
    "numero_facture" VARCHAR(60),
    "date_facture" TIMESTAMP(3),
    "montant_facture_ttc_cents" INTEGER,
    "facture_url" TEXT,
    "echeance_at" TIMESTAMP(3),
    "paye_at" TIMESTAMP(3),
    "moyen_paiement" VARCHAR(30),
    "reference_virement" VARCHAR(80),
    "validated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trainer_statements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trainer_compensation_rules_trainer_id_prestation_type_effect_idx" ON "trainer_compensation_rules"("trainer_id", "prestation_type", "effective_from");

-- CreateIndex
CREATE INDEX "trainer_compensation_rules_trainer_id_intervention_slug_idx" ON "trainer_compensation_rules"("trainer_id", "intervention_slug");

-- CreateIndex
CREATE INDEX "trainer_compensation_rules_effective_to_idx" ON "trainer_compensation_rules"("effective_to");

-- CreateIndex — construction du relevé mensuel
CREATE INDEX "trainer_fee_lines_trainer_id_periode_year_periode_month_idx" ON "trainer_fee_lines"("trainer_id", "periode_year", "periode_month");

-- CreateIndex
CREATE INDEX "trainer_fee_lines_statut_idx" ON "trainer_fee_lines"("statut");

-- CreateIndex
CREATE INDEX "trainer_fee_lines_statement_id_idx" ON "trainer_fee_lines"("statement_id");

-- CreateIndex
CREATE INDEX "trainer_fee_lines_session_id_idx" ON "trainer_fee_lines"("session_id");

-- CreateIndex
CREATE INDEX "trainer_fee_lines_coaching_session_id_idx" ON "trainer_fee_lines"("coaching_session_id");

-- CreateIndex
CREATE INDEX "trainer_fee_lines_booking_id_idx" ON "trainer_fee_lines"("booking_id");

-- CreateIndex — tableau de bord marge / coût par type de prestation
CREATE INDEX "trainer_fee_lines_prestation_type_periode_year_periode_month_idx" ON "trainer_fee_lines"("prestation_type", "periode_year", "periode_month");

-- CreateIndex — un seul relevé par (formateur, mois) : idempotence du run mensuel
CREATE UNIQUE INDEX "statement_unique_trainer_periode" ON "trainer_statements"("trainer_id", "periode_year", "periode_month");

-- CreateIndex
CREATE INDEX "trainer_statements_statut_idx" ON "trainer_statements"("statut");

-- CreateIndex — échéancier des honoraires à payer
CREATE INDEX "trainer_statements_echeance_at_idx" ON "trainer_statements"("echeance_at");

-- AddForeignKey
ALTER TABLE "trainer_compensation_rules" ADD CONSTRAINT "trainer_compensation_rules_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey — Restrict : on ne supprime pas un formateur qui a des lignes de rémunération
ALTER TABLE "trainer_fee_lines" ADD CONSTRAINT "trainer_fee_lines_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_fee_lines" ADD CONSTRAINT "trainer_fee_lines_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "trainer_compensation_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_fee_lines" ADD CONSTRAINT "trainer_fee_lines_statement_id_fkey" FOREIGN KEY ("statement_id") REFERENCES "trainer_statements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_statements" ADD CONSTRAINT "trainer_statements_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Contrainte métier NON représentable en schéma Prisma : une ligne de
-- rémunération se rattache à EXACTEMENT UNE prestation. Sans elle, une ligne
-- orpheline (ou rattachée à deux prestations) passerait silencieusement.
ALTER TABLE "trainer_fee_lines" ADD CONSTRAINT "ck_fee_line_une_seule_prestation"
  CHECK (
    (CASE WHEN "session_id" IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN "coaching_session_id" IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN "booking_id" IS NOT NULL THEN 1 ELSE 0 END)
  = 1
  );

-- Un mois est compris entre 1 et 12 (une erreur de calcul de période serait
-- silencieuse et fausserait tous les relevés).
ALTER TABLE "trainer_fee_lines" ADD CONSTRAINT "ck_fee_line_periode_month"
  CHECK ("periode_month" BETWEEN 1 AND 12);

ALTER TABLE "trainer_statements" ADD CONSTRAINT "ck_statement_periode_month"
  CHECK ("periode_month" BETWEEN 1 AND 12);
