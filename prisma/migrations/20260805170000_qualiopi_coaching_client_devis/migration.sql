-- Qualiopi — Parcours vente 1-to-1 : rattachement CRM des séances de coaching.
--
-- Avant : le bénéficiaire d'un parcours 1-to-1 n'existait qu'en texte libre
-- (beneficiaire_nom/email/entreprise) — impossible de relier un parcours à un
-- Client ou à un Devis depuis la console. Additif : parcours legacy intacts.
ALTER TABLE "coaching_sessions" ADD COLUMN IF NOT EXISTS "client_id" UUID;
ALTER TABLE "coaching_sessions" ADD COLUMN IF NOT EXISTS "devis_id" UUID;

CREATE INDEX IF NOT EXISTS "coaching_sessions_client_id_idx"
    ON "coaching_sessions"("client_id");
CREATE INDEX IF NOT EXISTS "coaching_sessions_devis_id_idx"
    ON "coaching_sessions"("devis_id");

ALTER TABLE "coaching_sessions"
    ADD CONSTRAINT "coaching_sessions_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "coaching_sessions"
    ADD CONSTRAINT "coaching_sessions_devis_id_fkey"
    FOREIGN KEY ("devis_id") REFERENCES "devis"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
