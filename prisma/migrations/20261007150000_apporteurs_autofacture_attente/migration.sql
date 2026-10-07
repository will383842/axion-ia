-- Réseau d'apporteurs : autofacture en attente d'une donnée de l'apporteur (TVA, SIREN, adresse).
-- Ajout seul (colonnes facultatives) : vides, rien ne change ; la console affiche ce qui manque.
ALTER TABLE "commissions_apporteur" ADD COLUMN "autofacture_attente_motif" VARCHAR(200);
ALTER TABLE "commissions_apporteur" ADD COLUMN "autofacture_attente_depuis" TIMESTAMPTZ(3);
