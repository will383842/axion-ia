-- Nouveau type de document officiel : inventaire des moyens pédagogiques
-- (off.17/18/19 — doc A14). Migration ADDITIVE.

-- AlterEnum — PG ≥ 12 : ADD VALUE autorisé en transaction (la valeur n'est pas
-- utilisée dans cette même migration).
ALTER TYPE "DocumentType" ADD VALUE 'inventaire_moyens';
