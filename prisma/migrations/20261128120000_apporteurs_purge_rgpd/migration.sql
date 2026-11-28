-- PR N (#2464, point 6) — purge RGPD des données d'apporteur.
-- Additif : deux colonnes nullables, une table de journal neuve (sans clé étrangère), deux CHECK élargis, deux
-- déclencheurs réécrits (corps de 20261126150000 recopiés, avec UNE sortie en plus : la purge, et la rotation de
-- la PR P). Rien n'est effacé par cette migration.
-- Fenêtre app/worker : colonnes nullables, aucune énumération touchée ; un ancien code ne lit jamais 'purge'.

ALTER TABLE "apporteur_iban_historique" ADD COLUMN "iban_purge_at" TIMESTAMPTZ(3);
ALTER TABLE "apporteur_changements_iban" ADD COLUMN "iban_purge_at" TIMESTAMPTZ(3);

ALTER TABLE "apporteur_iban_historique" DROP CONSTRAINT "apporteur_iban_historique_iban_chiffre";
ALTER TABLE "apporteur_iban_historique" ADD CONSTRAINT "apporteur_iban_historique_iban_chiffre" CHECK (
  ("iban" ~ '^enc:v2:[0-9a-f]{24}:[0-9a-f]+:[0-9a-f]{32}$')
  OR ("iban" = 'purge' AND "iban_purge_at" IS NOT NULL)
);
ALTER TABLE "apporteur_changements_iban" DROP CONSTRAINT "apporteur_changements_iban_iban_chiffre";
ALTER TABLE "apporteur_changements_iban" ADD CONSTRAINT "apporteur_changements_iban_iban_chiffre" CHECK (
  ("iban" ~ '^enc:v2:[0-9a-f]{24}:[0-9a-f]+:[0-9a-f]{32}$')
  OR ("iban" = 'purge' AND "iban_purge_at" IS NOT NULL)
);

CREATE OR REPLACE FUNCTION "apporteur_changements_iban_garde_update"() RETURNS trigger AS $$
BEGIN
  -- PR N (#2464 pt 6) : SEULE sortie de la purge RGPD. Il faut `SET LOCAL axion.reecriture_pii = 'purge'` dans la
  -- transaction (le réglage local ne survit pas à elle), l'IBAN chiffré devient 'purge' (jamais l'inverse), la date de
  -- purge se pose, et toute autre colonne reste identique (empreinte et quatre derniers caractères gardés).
  IF current_setting('axion.reecriture_pii', true) = 'purge'
     AND OLD."iban" <> 'purge' AND NEW."iban" = 'purge'
     AND OLD."iban_purge_at" IS NULL AND NEW."iban_purge_at" IS NOT NULL
     AND (to_jsonb(NEW) - 'iban' - 'iban_purge_at') = (to_jsonb(OLD) - 'iban' - 'iban_purge_at') THEN
    RETURN NEW;
  END IF;
  -- PR P (rotation de la clé) : réécriture d'un IBAN chiffré par un autre IBAN chiffré, rien d'autre ne change.
  IF current_setting('axion.reecriture_pii', true) = 'rotation'
     AND OLD."iban" ~ '^enc:v2:' AND NEW."iban" ~ '^enc:v2:'
     AND (to_jsonb(NEW) - 'iban') = (to_jsonb(OLD) - 'iban') THEN
    RETURN NEW;
  END IF;
  IF NEW."iban_purge_at" IS DISTINCT FROM OLD."iban_purge_at"
     OR NEW."id" IS DISTINCT FROM OLD."id"
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
  -- PR N (#2464 pt 6) : SEULE sortie de la purge RGPD. Il faut `SET LOCAL axion.reecriture_pii = 'purge'` dans la
  -- transaction (le réglage local ne survit pas à elle), l'IBAN chiffré devient 'purge' (jamais l'inverse), la date de
  -- purge se pose, et toute autre colonne reste identique (empreinte et quatre derniers caractères gardés).
  IF current_setting('axion.reecriture_pii', true) = 'purge'
     AND OLD."iban" <> 'purge' AND NEW."iban" = 'purge'
     AND OLD."iban_purge_at" IS NULL AND NEW."iban_purge_at" IS NOT NULL
     AND (to_jsonb(NEW) - 'iban' - 'iban_purge_at') = (to_jsonb(OLD) - 'iban' - 'iban_purge_at') THEN
    RETURN NEW;
  END IF;
  -- PR P (rotation de la clé) : réécriture d'un IBAN chiffré par un autre IBAN chiffré, rien d'autre ne change.
  IF current_setting('axion.reecriture_pii', true) = 'rotation'
     AND OLD."iban" ~ '^enc:v2:' AND NEW."iban" ~ '^enc:v2:'
     AND (to_jsonb(NEW) - 'iban') = (to_jsonb(OLD) - 'iban') THEN
    RETURN NEW;
  END IF;
  IF NEW."iban_purge_at" IS DISTINCT FROM OLD."iban_purge_at"
     OR NEW."id" IS DISTINCT FROM OLD."id"
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

-- Ce que la purge a effacé, quand et selon quelle règle. Ajout seul ; sans clé étrangère ; aucune donnée personnelle.
CREATE TABLE "apporteur_purges_rgpd" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "apporteur_id" UUID NOT NULL,
  "regle" VARCHAR(40) NOT NULL,
  "elements" TEXT[] NOT NULL,
  "echeance_at" TIMESTAMPTZ(3) NOT NULL,
  "purgee_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CONSTRAINT "apporteur_purges_rgpd_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "apporteur_purges_rgpd_apporteur_id_idx" ON "apporteur_purges_rgpd"("apporteur_id");
ALTER TABLE "apporteur_purges_rgpd" ADD CONSTRAINT "apporteur_purges_rgpd_regle" CHECK (
  "regle" IN ('contrat_termine_5ans', 'refuse_6mois', 'inactif_24mois', 'piece_6mois')
);
ALTER TABLE "apporteur_purges_rgpd" ADD CONSTRAINT "apporteur_purges_rgpd_elements" CHECK (
  "elements" <@ ARRAY['pieces_identite', 'rib', 'iban_fiche', 'iban_historique', 'iban_demandes', 'rib_demandes']::TEXT[]
);
CREATE FUNCTION "apporteur_purges_rgpd_ajout_seul"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'apporteur_purges_rgpd : ajout seul (ni modification ni suppression)';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "apporteur_purges_rgpd_no_update_delete"
  BEFORE UPDATE OR DELETE ON "apporteur_purges_rgpd"
  FOR EACH ROW EXECUTE FUNCTION "apporteur_purges_rgpd_ajout_seul"();
CREATE TRIGGER "apporteur_purges_rgpd_no_truncate"
  BEFORE TRUNCATE ON "apporteur_purges_rgpd"
  FOR EACH STATEMENT EXECUTE FUNCTION "apporteur_purges_rgpd_ajout_seul"();
