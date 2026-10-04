-- Lot OPCO A7b — deux faits qui gouvernent le régime de paiement OPCO, saisis
-- dans le bloc « Branche et OPCO » de la fiche client :
--   • adhésion à l'offre de services d'OPCO Mobilités (subrogation possible) ;
--   • versement volontaire / conventionnel (fait perdre la subrogation) ;
-- et la date de leur dernière saisie.
--
-- AJOUTS SEULS, colonnes NULLABLES sans défaut : `NULL` = « non renseigné »,
-- jamais « non ». Aucune donnée existante n'est lue ni modifiée.
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "opco_adhesion_offre_mobilites" BOOLEAN;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "opco_versement_volontaire" BOOLEAN;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "opco_adhesions_renseignees_le" DATE;
