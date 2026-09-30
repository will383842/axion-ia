-- Rendez-vous au salon (GOFAB, 13/10/2026) : rappel J-2 (2026-09-29).
--
-- ADDITIF UNIQUEMENT : une colonne nullable sans défaut et un index partiel.
-- Aucune donnée reprise, aucune colonne modifiée.
--
-- Marqueur DISTINCT de `rappel_j1_envoye_at` et de `rappel_envoye_at` : un
-- marqueur partagé entre deux moments ferait taire le second.
--
-- Fenêtre app/worker : le code qui lit cette colonne n'existe que dans cette PR.
-- La migration peut donc passer avant ou après le redémarrage du worker.
ALTER TABLE "calendly_events"
  ADD COLUMN IF NOT EXISTS "rappel_j2_envoye_at" TIMESTAMP(3);

-- Index partiel : même motif que les marqueurs de confirmation et de J-1.
CREATE INDEX IF NOT EXISTS "calendly_events_rappel_j2_due_idx"
  ON "calendly_events" ("start_time")
  WHERE "rappel_j2_envoye_at" IS NULL;
