-- Décommissionnement du système « Testimonial » (remplacé par customer_reviews).
-- La table est vide (6 faux seedés supprimés). Ordre : découpler la FK CaseStudy,
-- puis DROP TABLE, puis DROP TYPE de l'enum dédié.

-- 1. Découpler CaseStudy (retire la colonne + sa contrainte FK dépendante)
ALTER TABLE "case_studies" DROP COLUMN IF EXISTS "testimonial_id";

-- 2. Supprimer la table des témoignages
DROP TABLE IF EXISTS "testimonials";

-- 3. Supprimer l'enum dédié (uniquement utilisé par testimonials.status)
DROP TYPE IF EXISTS "TestimonialStatus";
