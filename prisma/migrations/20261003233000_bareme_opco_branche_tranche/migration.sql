-- Lot A4 (chantier OPCO) — barèmes OPCO par BRANCHE (IDCC) et par TAILLE d'entreprise.
--
-- UNIQUEMENT des ajouts : un enum, deux colonnes nullables / à défaut, un index,
-- une contrainte en NOT VALID (table existante), et la traçabilité de l'origine
-- de l'estimation sur le devis. Les barèmes existants restent `idcc` NULL /
-- `tranche_effectif` 'tous' : leur résolution est inchangée.
--
-- Aucun barème de départ n'est inséré ici : les pages sources n'ont pas pu être
-- relues au moment du lot. Une insertion future arrive par SA migration,
-- idempotente (INSERT … WHERE NOT EXISTS).

CREATE TYPE "TrancheEffectifOpco" AS ENUM ('moins_11', 'de_11_a_49', 'tous');

ALTER TABLE "baremes_opco" ADD COLUMN "idcc" CHAR(4);
ALTER TABLE "baremes_opco" ADD COLUMN "tranche_effectif" "TrancheEffectifOpco" NOT NULL DEFAULT 'tous';

ALTER TABLE "baremes_opco"
  ADD CONSTRAINT "baremes_opco_idcc_format_check" CHECK ("idcc" ~ '^[0-9]{4}$') NOT VALID;

CREATE INDEX "baremes_opco_opco_idcc_tranche_effectif_date_effet_idx"
  ON "baremes_opco"("opco", "idcc", "tranche_effectif", "date_effet");

CREATE TYPE "OrigineEstimationOpco" AS ENUM ('bareme', 'reglage_par_defaut', 'hors_fonds_legaux');

ALTER TABLE "devis" ADD COLUMN "opco_estimation_origine" "OrigineEstimationOpco";
ALTER TABLE "devis" ADD COLUMN "opco_estimation_avertissement" TEXT;
