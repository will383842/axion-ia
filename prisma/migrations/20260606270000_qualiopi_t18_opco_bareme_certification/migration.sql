-- T18 Qualiopi — Certification RS/RNCP + prise en charge OPCO PAR DOSSIER.
-- Les barèmes OPCO varient par branche (IDCC) × taille × dispositif → pas de
-- référentiel générique fiable. Le barème est saisi PAR DOSSIER (sur la session),
-- relevé sur le portail OPCO de la branche du client (source + date = traçabilité).
-- Migration ADDITIVE : 1 enum + colonnes nullables sur formations/training_sessions/clients.

-- CreateEnum
CREATE TYPE "PriseEnChargeUnite" AS ENUM ('euro_heure', 'euro_jour', 'euro_formation', 'euro_an_salarie');

-- AlterTable formations (certification France Compétences RS/RNCP)
ALTER TABLE "formations" ADD COLUMN     "blocs_competences" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "certificateur_nom" VARCHAR(250),
ADD COLUMN     "code_rncp" VARCHAR(20),
ADD COLUMN     "code_rs" VARCHAR(20),
ADD COLUMN     "cpf_eligible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "date_echeance_certif" TIMESTAMP(3),
ADD COLUMN     "date_enregistrement_certif" TIMESTAMP(3),
ADD COLUMN     "est_certificateur" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "numero_enregistrement_fc" VARCHAR(40),
ADD COLUMN     "numero_habilitation" VARCHAR(60);

-- AlterTable training_sessions (prise en charge OPCO par dossier)
ALTER TABLE "training_sessions" ADD COLUMN     "prise_en_charge_montant_cents" INTEGER,
ADD COLUMN     "prise_en_charge_unite" "PriseEnChargeUnite",
ADD COLUMN     "prise_en_charge_plafond_formation_cents" INTEGER,
ADD COLUMN     "prise_en_charge_plafond_annuel_cents" INTEGER,
ADD COLUMN     "prise_en_charge_source_url" TEXT,
ADD COLUMN     "prise_en_charge_releve_le" TIMESTAMP(3);

-- AlterTable clients (IDCC branche)
ALTER TABLE "clients" ADD COLUMN     "idcc" VARCHAR(10);
