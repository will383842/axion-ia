-- Lot 5 — D'OÙ VIENT UNE CANDIDATURE.
--
-- 🔴 Sans ces colonnes, on paie une annonce à l'aveugle : une candidature
-- arrive sans qu'on sache quel canal l'a produite, et trois semaines plus tard
-- on a trente dossiers sans aucun moyen de décider où remettre de l'argent.
--
-- Elles portent ce que le LIEN PROUVE (cookie posé par le proxy au premier
-- clic), pas ce que le candidat déclare. Les deux divergent souvent, et c'est
-- précisément l'écart qu'on veut pouvoir lire.
--
-- ⚠️ TOUTES NULLABLES, et aucune reprise du stock. Les candidatures antérieures
-- n'ont PAS de provenance connue — leur en inventer une (« direct », « site »)
-- fabriquerait un chiffre faux qu'on lirait ensuite comme un fait. `NULL` dit
-- « on ne sait pas », et l'écran l'affiche comme tel.

ALTER TABLE "job_applications"
  ADD COLUMN IF NOT EXISTS "utm_source"   VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "utm_medium"   VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "utm_campaign" VARCHAR(160),
  ADD COLUMN IF NOT EXISTS "landing_path" VARCHAR(255);

-- L'écran groupe par canal sur une fenêtre de dates. Sans cet index il balaie
-- la table entière à chaque rendu — supportable à 60 lignes, plus du tout au
-- volume que le plan de recrutement annonce (30 à 60 candidatures par semaine).
CREATE INDEX IF NOT EXISTS "job_applications_utm_source_submitted_at_idx"
  ON "job_applications"("utm_source", "submitted_at");
