-- Pays d'où l'on accepte les candidatures pour une offre (ISO 3166-1 alpha-2).
-- Alimente `JobPosting.applicantLocationRequirements` : Google for Jobs filtre
-- les offres TELECOMMUTE sur le pays du chercheur, donc une mission 100 % à
-- distance ouverte à la francophonie restait invisible hors de France tant que
-- la seule valeur émise était « France » en dur.
--
-- Tableau vide par défaut = comportement historique inchangé (France seule) pour
-- les 54 offres existantes : aucune n'est ouverte à l'étranger sans décision
-- explicite en console.
ALTER TABLE "job_offers"
  ADD COLUMN "applicant_countries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
