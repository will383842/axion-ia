-- Rollback de 20261128120000_apporteurs_purge_rgpd.
-- Seulement sur décision du fondateur. Sauvegarder d'abord :
--   COPY "apporteur_purges_rgpd" TO '/chemin/sauvegarde-apporteur_purges_rgpd.csv' CSV HEADER;
-- ⚠️ Une fois une ligne purgée (iban = 'purge'), l'ancien CHECK ne passe plus : il est donc reposé NOT VALID
-- (il contrôle les lignes nouvelles, pas les lignes déjà purgées). Ne rien supprimer sans sauvegarde.

ALTER TABLE "apporteur_iban_historique" DROP CONSTRAINT "apporteur_iban_historique_iban_chiffre";
ALTER TABLE "apporteur_iban_historique" ADD CONSTRAINT "apporteur_iban_historique_iban_chiffre" CHECK (
  "iban" ~ '^enc:v2:[0-9a-f]{24}:[0-9a-f]+:[0-9a-f]{32}$'
) NOT VALID;
ALTER TABLE "apporteur_changements_iban" DROP CONSTRAINT "apporteur_changements_iban_iban_chiffre";
ALTER TABLE "apporteur_changements_iban" ADD CONSTRAINT "apporteur_changements_iban_iban_chiffre" CHECK (
  "iban" ~ '^enc:v2:[0-9a-f]{24}:[0-9a-f]+:[0-9a-f]{32}$'
) NOT VALID;

-- Déclencheurs d'origine (20261126150000), recopiés.
CREATE OR REPLACE FUNCTION "apporteur_changements_iban_garde_update"() RETURNS trigger AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."apporteur_id" IS DISTINCT FROM OLD."apporteur_id"
     OR NEW."iban" IS DISTINCT FROM OLD."iban"
     OR NEW."iban_empreinte" IS DISTINCT FROM OLD."iban_empreinte"
     OR NEW."iban_fin4" IS DISTINCT FROM OLD."iban_fin4"
     OR NEW."ancien_iban_empreinte" IS DISTINCT FROM OLD."ancien_iban_empreinte"
     OR NEW."ancien_iban_fin4" IS DISTINCT FROM OLD."ancien_iban_fin4"
     OR NEW."origine" IS DISTINCT FROM OLD."origine"
     OR NEW."demandee_at" IS DISTINCT FROM OLD."demandee_at"
     OR NEW."demande_ip_hash" IS DISTINCT FROM OLD."demande_ip_hash"
     OR NEW."demande_navigateur" IS DISTINCT FROM OLD."demande_navigateur" THEN
    RAISE EXCEPTION 'apporteur_changements_iban : le coeur d''une demande ne change pas';
  END IF;
  IF OLD."statut" IN ('validee', 'refusee', 'opposee', 'annulee', 'expiree')
     AND (NEW."statut" IS DISTINCT FROM OLD."statut"
          OR NEW."confirmee_at" IS DISTINCT FROM OLD."confirmee_at"
          OR NEW."traitee_at" IS DISTINCT FROM OLD."traitee_at"
          OR NEW."traitee_par" IS DISTINCT FROM OLD."traitee_par"
          OR NEW."motif_refus" IS DISTINCT FROM OLD."motif_refus"
          OR NEW."opposee_at" IS DISTINCT FROM OLD."opposee_at"
          OR NEW."annulee_at" IS DISTINCT FROM OLD."annulee_at"
          OR NEW."expiree_at" IS DISTINCT FROM OLD."expiree_at"
          OR NEW."controles" IS DISTINCT FROM OLD."controles"
          OR NEW."avis_envoye_at" IS DISTINCT FROM OLD."avis_envoye_at"
          OR NEW."confirmation_ip_hash" IS DISTINCT FROM OLD."confirmation_ip_hash"
          OR NEW."confirmation_navigateur" IS DISTINCT FROM OLD."confirmation_navigateur") THEN
    RAISE EXCEPTION 'apporteur_changements_iban : une demande décidée est figée';
  END IF;
  -- La preuve de la confirmation ne se réécrit pas une fois posée (le délai de 72 h repose sur `confirmee_at`).
  IF (OLD."confirmee_at" IS NOT NULL AND NEW."confirmee_at" IS DISTINCT FROM OLD."confirmee_at")
     OR (OLD."confirmation_ip_hash" IS NOT NULL AND NEW."confirmation_ip_hash" IS DISTINCT FROM OLD."confirmation_ip_hash")
     OR (OLD."confirmation_navigateur" IS NOT NULL AND NEW."confirmation_navigateur" IS DISTINCT FROM OLD."confirmation_navigateur") THEN
    RAISE EXCEPTION 'apporteur_changements_iban : la preuve de la confirmation ne change plus';
  END IF;
  -- Chaque champ de suivi ne s'écrit qu'avec la transition qui le porte (jamais seul, jamais sur une autre).
  IF ((NEW."confirmee_at" IS DISTINCT FROM OLD."confirmee_at"
       OR NEW."confirmation_ip_hash" IS DISTINCT FROM OLD."confirmation_ip_hash"
       OR NEW."confirmation_navigateur" IS DISTINCT FROM OLD."confirmation_navigateur")
      AND NOT (OLD."statut" = 'a_confirmer' AND NEW."statut" = 'confirmee'))
     OR (NEW."opposee_at" IS DISTINCT FROM OLD."opposee_at" AND NEW."statut" <> 'opposee')
     OR (NEW."annulee_at" IS DISTINCT FROM OLD."annulee_at" AND NEW."statut" <> 'annulee')
     OR (NEW."expiree_at" IS DISTINCT FROM OLD."expiree_at" AND NEW."statut" <> 'expiree')
     OR ((NEW."traitee_at" IS DISTINCT FROM OLD."traitee_at" OR NEW."traitee_par" IS DISTINCT FROM OLD."traitee_par"
          OR NEW."motif_refus" IS DISTINCT FROM OLD."motif_refus") AND NEW."statut" NOT IN ('validee', 'refusee'))
     OR (OLD."avis_envoye_at" IS NOT NULL AND NEW."avis_envoye_at" IS DISTINCT FROM OLD."avis_envoye_at") THEN
    RAISE EXCEPTION 'apporteur_changements_iban : un champ de suivi ne s''écrit qu''avec sa transition';
  END IF;
  -- Une demande confirmée ne revient pas en arrière ; on ne saute pas à « validée » sans être passé par « confirmée ».
  IF NEW."statut" IS DISTINCT FROM OLD."statut" THEN
    IF NOT (
      (OLD."statut" = 'a_confirmer' AND NEW."statut" IN ('confirmee', 'opposee', 'annulee', 'expiree'))
      OR (OLD."statut" = 'confirmee' AND NEW."statut" IN ('validee', 'refusee', 'opposee', 'annulee'))
    ) THEN
      RAISE EXCEPTION 'apporteur_changements_iban : transition % -> % interdite', OLD."statut", NEW."statut";
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "apporteur_iban_historique_garde_update"() RETURNS trigger AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."apporteur_id" IS DISTINCT FROM OLD."apporteur_id"
     OR NEW."iban" IS DISTINCT FROM OLD."iban"
     OR NEW."iban_empreinte" IS DISTINCT FROM OLD."iban_empreinte"
     OR NEW."iban_fin4" IS DISTINCT FROM OLD."iban_fin4"
     OR NEW."en_vigueur_de" IS DISTINCT FROM OLD."en_vigueur_de"
     OR NEW."origine" IS DISTINCT FROM OLD."origine"
     OR NEW."demande_id" IS DISTINCT FROM OLD."demande_id"
     OR NEW."piece_rib_id" IS DISTINCT FROM OLD."piece_rib_id"
     OR NEW."cree_at" IS DISTINCT FROM OLD."cree_at" THEN
    RAISE EXCEPTION 'apporteur_iban_historique : ajout seul, seule la fin de validité peut être posée';
  END IF;
  IF OLD."en_vigueur_jusqua" IS NOT NULL
     AND NEW."en_vigueur_jusqua" IS DISTINCT FROM OLD."en_vigueur_jusqua" THEN
    RAISE EXCEPTION 'apporteur_iban_historique : la fin de validité posée ne change plus';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Mise de côté du journal et des colonnes, jamais de DROP.
ALTER TABLE "apporteur_purges_rgpd" RENAME TO "apporteur_purges_rgpd_retire_20261128";
ALTER TABLE "apporteur_iban_historique" RENAME COLUMN "iban_purge_at" TO "iban_purge_at_retire_20261128";
ALTER TABLE "apporteur_changements_iban" RENAME COLUMN "iban_purge_at" TO "iban_purge_at_retire_20261128";
