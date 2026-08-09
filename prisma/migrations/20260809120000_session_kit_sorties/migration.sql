-- Les sorties de démonstration capturées pour une session.
--
-- Le kit imprimé est commun à toutes les sessions d'une formation ; les sorties
-- d'outil, elles, se refont — une interface qui a changé rend la démonstration
-- incompréhensible. D'où le rattachement à la SESSION.
--
-- `valide_le` porte la promesse faite au formateur par les fiches : « les
-- sorties du kit ont été vérifiées ». Une sortie générée que personne n'a lue
-- n'est pas un filet.
CREATE TABLE "session_kit_sorties" (
  "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
  "session_id"    UUID         NOT NULL,
  "sorties"       JSONB        NOT NULL DEFAULT '[]',
  "genere_le"     TIMESTAMP(3),
  "valide_le"     TIMESTAMP(3),
  "valide_par_id" UUID,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "session_kit_sorties_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "session_kit_sorties_session_id_key" ON "session_kit_sorties"("session_id");

ALTER TABLE "session_kit_sorties"
  ADD CONSTRAINT "session_kit_sorties_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
