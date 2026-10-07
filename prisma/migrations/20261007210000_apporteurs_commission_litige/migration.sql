-- Réseau d'apporteurs : commission suspendue pendant une contestation écrite du client
-- (contrat 2.3, art. 4.2 bis). Ajout seul (colonnes facultatives) : vides, rien ne change.
ALTER TABLE "commissions_apporteur" ADD COLUMN "litige_depuis" TIMESTAMPTZ(3);
ALTER TABLE "commissions_apporteur" ADD COLUMN "litige_motif" VARCHAR(300);
