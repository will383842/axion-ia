-- Réseau d'apporteurs : réservation de la contresignature (double clic), avec expiration.
-- Ajout seul (colonne facultative). `signe_par_societe_at` n'est plus posé qu'à la fin.
ALTER TABLE "apporteurs_reseau" ADD COLUMN "contresignature_reservee_jusqua" TIMESTAMPTZ(3);
