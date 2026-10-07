-- Réseau d'apporteurs : date d'émission de l'autofacture et numéro d'avoir d'une reprise.
-- Ajout seul (colonnes facultatives), aucune lecture n'en dépend tant qu'elles sont vides.
ALTER TABLE "commissions_apporteur" ADD COLUMN "autofacture_emise_at" TIMESTAMPTZ(3);
ALTER TABLE "commissions_apporteur" ADD COLUMN "avoir_numero" VARCHAR(40);
