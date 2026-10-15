-- Vérification 1, lot 2 — changement d'adresse, liens et codes. AJOUT SEUL :
-- deux colonnes nullables sur `trainers`, un type et une colonne nullable sur
-- `document_signatures`. Aucune ligne existante n'est réécrite : les preuves de
-- signature déjà posées gardent `facteur_verification` à NULL et leur empreinte
-- de version 1, qui ne lit pas cette colonne.

-- V1-C-6, V1-D-1 — l'adresse remplacée par le dernier changement fait en console.
ALTER TABLE "trainers" ADD COLUMN "email_remplace" CITEXT;
ALTER TABLE "trainers" ADD COLUMN "email_remplace_at" TIMESTAMP(3);

-- V1-A-7 — le facteur qui a prouvé l'adresse du signataire (version 2 du tuple haché).
CREATE TYPE "FacteurVerificationSignature" AS ENUM ('code_email');
ALTER TABLE "document_signatures" ADD COLUMN "facteur_verification" "FacteurVerificationSignature";
