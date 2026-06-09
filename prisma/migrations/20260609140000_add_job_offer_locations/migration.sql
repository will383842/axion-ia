-- Zone d'emploi multi-villes pour les offres itinérantes/territoriales.
-- Tableau JSON [{ "city": "...", "region": "..." }] → JobPosting multi-location.
ALTER TABLE "job_offers" ADD COLUMN "job_locations" JSONB;
