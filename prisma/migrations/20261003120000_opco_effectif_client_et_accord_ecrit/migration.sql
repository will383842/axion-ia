-- Lot OPCO A1 (réforme TVA des OPCO au 1/10/2026) — AJOUTS SEULS.
-- Aucun DROP, aucun RENAME, aucune recopie : `clients.opco_identifie` (texte
-- libre) est conservé tel quel ; `clients.opco` (typé) part vide.

-- CreateEnum
CREATE TYPE "EffectifSource" AS ENUM ('saisie', 'insee');

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "effectif" INTEGER,
ADD COLUMN     "effectif_releve_le" DATE,
ADD COLUMN     "effectif_source" "EffectifSource",
ADD COLUMN     "opco" "Opco";

-- Un effectif négatif n'a pas de sens. NOT VALID : la table existe déjà, la
-- contrainte vaut pour toute écriture nouvelle sans balayer l'historique
-- (la colonne vient de naître, il est de toute façon vide).
ALTER TABLE "clients" ADD CONSTRAINT "clients_effectif_positif_check"
  CHECK ("effectif" >= 0) NOT VALID;

-- AlterTable
ALTER TABLE "dossiers_financement" ADD COLUMN     "accord_ecrit_le" DATE,
ADD COLUMN     "depot_fait_le" DATE,
ADD COLUMN     "subrogation_confirmee_par_accord" BOOLEAN;
