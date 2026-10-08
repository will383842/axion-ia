-- Réseau d'apporteurs : la commission n'est facturée ni versée avant que la prestation soit
-- marquée réalisée (contrat 2.3, art. 4.2). Ajout seul (colonnes facultatives).
ALTER TABLE "commissions_apporteur" ADD COLUMN "prestation_realisee_at" TIMESTAMPTZ(3);
ALTER TABLE "commissions_apporteur" ADD COLUMN "prestation_realisee_par" VARCHAR(40);
