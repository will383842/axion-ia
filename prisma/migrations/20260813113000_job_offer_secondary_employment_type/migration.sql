-- Double type de contrat (2026-08-13) — JobPosting.employmentType accepte un
-- TABLEAU schema.org : une offre ouverte « en CDI ou en freelance » doit
-- déclarer les deux types à Google for Jobs, sinon elle est invisible pour la
-- moitié des profils qu'elle accepte (le filtre type de contrat est exclusif).
-- Colonne nullable : NULL = un seul type (comportement historique inchangé).
ALTER TABLE "job_offers" ADD COLUMN "secondary_employment_type" VARCHAR(20);
