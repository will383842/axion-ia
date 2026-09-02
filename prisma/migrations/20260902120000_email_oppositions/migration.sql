-- Opposition à la prospection commerciale (audit e-mails 2026-09-02, lot 1b).
--
-- Une ligne par adresse qui a cliqué « Ne plus recevoir de sollicitations
-- commerciales » depuis un e-mail. Écrite au clic seulement — jamais à l'envoi :
-- le jeton du lien est signé, pas stocké. Relue avant chaque envoi marketing.
CREATE TABLE IF NOT EXISTS "email_oppositions" (
  "id"         UUID NOT NULL,
  "email"      CITEXT NOT NULL,
  "template"   VARCHAR(60),
  "source"     VARCHAR(40) NOT NULL DEFAULT 'lien-email',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "email_oppositions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_oppositions_email_key" ON "email_oppositions"("email");
