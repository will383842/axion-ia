-- But : colonnes FACULTATIVES d'identité du contact (civilité, prénom, nom de famille) sur
-- client_contacts (la personne, source) et sur clients (copie du contact de facturation),
-- et colonne FACULTATIVE « conditions particulières » sur devis.
-- Migration ADDITIVE : uniquement des ADD COLUMN nullables et un CHECK acceptant NULL (sur clients).
-- Aucun DEFAULT, aucun NOT NULL, aucun index, aucun UPDATE : aucune reprise de données.
-- ORDRE DE LIVRAISON : M1 seule, vérifiée en production, puis B4.
-- Aucun code n'écrit ces colonnes avant B4. Le client Prisma régénéré les lit dans toute requête
-- sans select : la migration doit être appliquée en production avant que ce code serve
-- (vérifier la présence des colonnes après la mise en ligne).
-- La civilité de client_contacts est validée par le code applicatif (zod, à l'écriture, fiche B4)
-- et non par une contrainte, parce que cette table est sous garde de dérive du SQL brut.
ALTER TABLE "client_contacts" ADD COLUMN "civilite" VARCHAR(10);
ALTER TABLE "client_contacts" ADD COLUMN "prenom" VARCHAR(80);
ALTER TABLE "client_contacts" ADD COLUMN "nom_famille" VARCHAR(80);
ALTER TABLE "clients" ADD COLUMN "contact_civilite" VARCHAR(10);
ALTER TABLE "clients" ADD COLUMN "contact_prenom" VARCHAR(80);
ALTER TABLE "clients" ADD COLUMN "contact_nom_famille" VARCHAR(80);
ALTER TABLE "clients" ADD CONSTRAINT "clients_contact_civilite_check" CHECK ("contact_civilite" IS NULL OR "contact_civilite" IN ('madame', 'monsieur'));
ALTER TABLE "devis" ADD COLUMN "conditions_particulieres" TEXT;
