-- Cycle de vie du formateur — le silence a désormais une échéance, et un nom.
--
-- Deux ajouts, tous deux additifs : aucune ligne existante ne change de sens.
--
--   1. `sans_reponse` dans l'énumération. Il manquait, et son absence forçait
--      un choix faux : soit `refusee` (un refus que personne n'a formulé, avec
--      un motif inventé puisque le motif est obligatoire — et les refus
--      nourrissent le pilotage qui sert à motiver une non-reconduction), soit
--      `expiree`, qui ne tombe qu'AU DÉMARRAGE, quand il est trop tard pour
--      trouver quelqu'un d'autre.
--
--   2. `echeance_reponse_at`. Nullable : les propositions déjà en base n'en ont
--      pas, et leur silence continue de ne valoir que `expiree`, comme avant.
--      Aucun backfill — poser une échéance rétroactive ferait basculer d'un
--      coup des propositions vivantes en `sans_reponse`.

ALTER TYPE "MissionFormateurStatut" ADD VALUE IF NOT EXISTS 'sans_reponse';

ALTER TABLE "missions_formateur"
  ADD COLUMN IF NOT EXISTS "echeance_reponse_at" TIMESTAMP(3);
