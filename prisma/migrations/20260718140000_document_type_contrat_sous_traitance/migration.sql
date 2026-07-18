-- Nouveau type de document officiel : contrat de sous-traitance écrit
-- (indicateur 27 — missions confiées + clause de vérification conformité RNQ).
-- Migration ADDITIVE.

-- AlterEnum — PG ≥ 12 : ADD VALUE autorisé en transaction (la valeur n'est pas
-- utilisée dans cette même migration).
ALTER TYPE "DocumentType" ADD VALUE 'contrat_sous_traitance';
