-- D5-3-02 (2026-08-20) — un rebond dur était indiscernable d'une remise réussie.
--
-- Le relais acceptait le message (statut `sent`), le serveur destinataire le
-- refusait ensuite, et rien ne revenait dans le système. Une convocation
-- « envoyée » pouvait n'être jamais arrivée, et la console offrait un filtre
-- « Rejeté » qu'aucun code n'écrivait.
--
-- Ajout de l'état `bounced` et des trois colonnes que le webhook ZeptoMail
-- renseigne. Additif : aucune ligne existante n'est touchée.

ALTER TYPE "email_log_status" ADD VALUE IF NOT EXISTS 'bounced';

ALTER TABLE "email_logs"
  ADD COLUMN IF NOT EXISTS "bounce_type"   VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "bounce_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "bounced_at"    TIMESTAMP(3);

-- Les rebonds se lisent par destinataire et par date : l'écran « E-mails
-- envoyés » filtre déjà sur `status`, qui est indexé. Un index dédié sur
-- `bounced_at` sert la purge de rétention et le comptage par période.
CREATE INDEX IF NOT EXISTS "email_logs_bounced_at_idx" ON "email_logs" ("bounced_at");
