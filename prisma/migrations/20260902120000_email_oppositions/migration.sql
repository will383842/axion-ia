-- Opposition à la prospection commerciale (audit e-mails 2026-09-02, lot 1b).
--
-- Une ligne par personne qui a cliqué « Ne plus recevoir de sollicitations
-- commerciales » depuis un e-mail. Écrite au clic seulement — jamais à l'envoi :
-- le jeton du lien est signé, pas stocké. Relue avant chaque envoi marketing.
--
-- 🔴 AUCUNE ADRESSE EN CLAIR : seulement l'empreinte de recherche
-- (`hashEmailForLookup`, la même que `submissions.contact_email_hash`). Une
-- liste d'opposition doit survivre à l'effacement — l'effacer ferait
-- recommencer les envois — donc elle ne contient rien de lisible.
CREATE TABLE IF NOT EXISTS "email_oppositions" (
  "id"         UUID NOT NULL,
  "email_hash" VARCHAR(64) NOT NULL,
  "template"   VARCHAR(60),
  "source"     VARCHAR(40) NOT NULL DEFAULT 'lien-email',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "email_oppositions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_oppositions_email_hash_key" ON "email_oppositions"("email_hash");
