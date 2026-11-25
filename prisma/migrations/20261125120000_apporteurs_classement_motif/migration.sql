-- L2 (plan apporteurs-sept-points-salariat) : motif du classement d'un dossier non signé.
-- Ajout seul, nullable (les lignes anciennes n'ont pas de motif), rejouable. Aucun UPDATE/DELETE/DROP.
ALTER TABLE "apporteur_reseau_retrait" ADD COLUMN IF NOT EXISTS "motif" TEXT;
