-- Qualiopi — Contrat de formation professionnelle (particuliers, B2C).
-- Ajoute la valeur `contrat` à l'enum `DocumentType` pour permettre la
-- génération du contrat individuel conforme aux articles L.6353-3 à L.6353-7
-- du Code du travail (rétractation 10 jours, échelonnement du paiement,
-- abandon proratisé). Distinct de `convention` (personnes morales, L.6353-1/2).
--
-- Migration ADDITIVE uniquement (aucun DROP). Idempotent (PostgreSQL 12+).

-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'contrat';
