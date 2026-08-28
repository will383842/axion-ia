-- Confirmation de réservation + rappel J-1 (2026-08-28).
--
-- Deux marqueurs d'idempotence DISTINCTS de `rappel_envoye_at` (H-1).
-- Un marqueur unique pour trois moments ferait taire les deux derniers : le
-- premier envoi le poserait, et les suivants ne verraient plus de candidat.
--
-- Nullable sans défaut : les lignes existantes restent à NULL. Conséquence
-- assumée et voulue — les rendez-vous déjà réservés recevront leur
-- confirmation au prochain passage. Le filtre `start_time > now()` du module
-- empêche d'écrire à quelqu'un dont l'appel est passé.
ALTER TABLE "calendly_events"
  ADD COLUMN IF NOT EXISTS "confirmation_envoyee_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rappel_j1_envoye_at" TIMESTAMP(3);

-- Index partiels : chaque passage cherche « pas encore envoyé ET à venir ».
-- Sans eux, la requête balaierait toute la table à chaque tick de 5 minutes.
-- Partiels (WHERE ... IS NULL) parce que la ligne cesse d'être candidate dès
-- que le marqueur est posé — l'index ne garde donc que le reste à faire.
CREATE INDEX IF NOT EXISTS "calendly_events_confirmation_due_idx"
  ON "calendly_events" ("start_time")
  WHERE "confirmation_envoyee_at" IS NULL;

CREATE INDEX IF NOT EXISTS "calendly_events_rappel_j1_due_idx"
  ON "calendly_events" ("start_time")
  WHERE "rappel_j1_envoye_at" IS NULL;
