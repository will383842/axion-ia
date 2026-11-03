-- CGV avant signature du devis (2026-11-03) : version des CGV acceptees, scellee dans l empreinte (hash_version 2).
-- STRICTEMENT ADDITIF : une colonne nullable, sans defaut, sans rattrapage, sans CHECK, sans enumeration.
-- Compatible avec l ANCIEN code (qui ne la connait pas) : migration AVANT le code, worker comme app.
-- Retour arriere (JAMAIS execute par defaut) : ALTER TABLE "document_signatures" DROP COLUMN "cgv_version";

-- AlterTable
ALTER TABLE "document_signatures" ADD COLUMN "cgv_version" VARCHAR(40);
