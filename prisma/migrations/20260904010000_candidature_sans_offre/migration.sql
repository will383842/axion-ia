-- Lot 6 — L'OFFRE PEUT DISPARAITRE, LE DOSSIER NON.
--
-- 🔴 `ON DELETE CASCADE` detruisait des dossiers que Will a demande de garder.
--
-- La purge automatique epargne les candidatures `hired` (decision D4, PR #952)
-- et une garde dediee l'y verrouille. Mais la suppression d'une OFFRE cascadait
-- sur ses candidatures — CV compris — sans rien connaitre de cette protection.
-- Supprimer une offre effacait la trace des personnes recrutees par elle.
--
-- `SET NULL` rend la suppression d'une offre non destructrice : la candidature
-- survit, et `offer_title_snap` (fige a la soumission, NOT NULL) continue de
-- dire pour quel poste elle a ete deposee.
--
-- ⚠️ AUCUNE LIGNE N'EST MODIFIEE ICI. On elargit une colonne (NOT NULL ->
-- NULL) et on change une regle de suppression : les 60 candidatures du stock
-- gardent leur `offer_id`. Rien n'est invente, rien n'est efface.

ALTER TABLE "job_applications"
  ALTER COLUMN "offer_id" DROP NOT NULL;

ALTER TABLE "job_applications"
  DROP CONSTRAINT IF EXISTS "job_applications_offer_id_fkey";

ALTER TABLE "job_applications"
  ADD CONSTRAINT "job_applications_offer_id_fkey"
  FOREIGN KEY ("offer_id") REFERENCES "job_offers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
