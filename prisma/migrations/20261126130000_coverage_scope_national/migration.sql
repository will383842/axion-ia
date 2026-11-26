-- Périmètre « France entière » des campagnes de couverture.
-- ADDITIF uniquement : aucune ligne n'utilise la valeur dans cette migration
-- (ALTER TYPE ... ADD VALUE ne peut pas être suivi d'un usage dans la même transaction).
ALTER TYPE "CoverageScope" ADD VALUE IF NOT EXISTS 'national';
