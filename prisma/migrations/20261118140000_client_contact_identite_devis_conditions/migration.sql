-- But : colonnes FACULTATIVES d'identité du contact (civilité, prénom, nom de famille) sur
-- client_contacts (la personne, source) et sur clients (copie du contact de facturation),
-- et colonne FACULTATIVE « conditions particulières » sur devis.
-- Migration ADDITIVE : uniquement des ADD COLUMN nullables et deux CHECK acceptant NULL.
-- Aucun DEFAULT, aucun NOT NULL, aucun index, aucun UPDATE : aucune reprise de données.
-- ORDRE DE LIVRAISON : M1 seule, vérifiée en production, puis B4.
-- Aucun code ne lit ni n'écrit ces colonnes avant B4.
ALTER TABLE "client_contacts" ADD COLUMN "civilite" VARCHAR(10);
ALTER TABLE "client_contacts" ADD COLUMN "prenom" VARCHAR(80);
ALTER TABLE "client_contacts" ADD COLUMN "nom_famille" VARCHAR(80);
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_civilite_check" CHECK ("civilite" IS NULL OR "civilite" IN ('madame', 'monsieur'));
ALTER TABLE "clients" ADD COLUMN "contact_civilite" VARCHAR(10);
ALTER TABLE "clients" ADD COLUMN "contact_prenom" VARCHAR(80);
ALTER TABLE "clients" ADD COLUMN "contact_nom_famille" VARCHAR(80);
ALTER TABLE "clients" ADD CONSTRAINT "clients_contact_civilite_check" CHECK ("contact_civilite" IS NULL OR "contact_civilite" IN ('madame', 'monsieur'));
ALTER TABLE "devis" ADD COLUMN "conditions_particulieres" TEXT;
