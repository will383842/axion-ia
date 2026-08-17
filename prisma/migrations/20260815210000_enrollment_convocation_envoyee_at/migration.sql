-- Convocation reglementaire (ind. 9) : passer d'une FENETRE DE DATE a un ETAT.
--
-- Constat de production du 15/08/2026 : aucune convocation n'etait jamais
-- partie, sur tout l'historique (101 e-mails, zero `qualiopi-convocation`).
-- Le cron tourne pourtant chaque jour a 08:00 UTC. Sa selection etait une
-- fenetre [J-5,5 ; J-4,5] sur `date_debut` -- et aucune session reelle n'a
-- jamais existe cinq jours avant son debut : celle du 31/07 a ete creee le
-- 31/07 a 14h51 pour un debut a 07h00, celle du 16/08 la veille.
--
-- Une session creee A L'INTERIEUR de sa propre fenetre n'y entre jamais, et
-- rien ne la rattrape. L'etat rend le cron rattrapant.
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "convocation_envoyee_at" TIMESTAMP(3);

-- Selection du cron : inscriptions actives non encore convoquees.
CREATE INDEX IF NOT EXISTS "enrollments_convocation_envoyee_at_statut_idx"
  ON "enrollments" ("convocation_envoyee_at", "statut");
