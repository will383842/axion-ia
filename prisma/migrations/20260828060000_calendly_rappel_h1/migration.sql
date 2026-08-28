-- Rappel H-1 des rendez-vous d'appel (2026-08-28).
--
-- Une seule colonne, nullable, sans valeur par défaut : elle marque l'envoi du
-- rappel et sert d'idempotence. La passe tourne toutes les 5 minutes sur une
-- fenêtre de 15 — sans ce marqueur, le même rendez-vous recevrait trois rappels.
--
-- Nullable et sans défaut : la migration est instantanée même sur une table
-- pleine (Postgres ne réécrit pas les lignes), et toutes les réservations
-- existantes sont naturellement « pas encore rappelées ».
ALTER TABLE "calendly_events" ADD COLUMN "rappel_envoye_at" TIMESTAMP(3);

-- Index partiel : la passe cherche les rendez-vous PROCHES et NON rappelés.
-- Partiel plutôt que complet — une fois le rappel envoyé, la ligne n'a plus
-- jamais à être trouvée par cette requête, et l'index n'a pas à la porter.
CREATE INDEX "calendly_events_rappel_a_envoyer_idx"
  ON "calendly_events" ("start_time")
  WHERE "rappel_envoye_at" IS NULL;
