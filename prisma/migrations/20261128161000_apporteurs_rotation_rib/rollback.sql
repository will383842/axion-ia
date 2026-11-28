-- ROLLBACK de 20261128161000_apporteurs_rotation_rib — seulement sur décision du fondateur.
-- Aucune donnée à sauvegarder : la migration ne touche qu'une fonction. On restaure le corps de 20261126150000.
CREATE OR REPLACE FUNCTION "apporteur_changements_iban_rib_garde_update"() RETURNS trigger AS $$
BEGIN
  IF NEW."demande_id" IS DISTINCT FROM OLD."demande_id"
     OR NEW."sha256" IS DISTINCT FROM OLD."sha256"
     OR NEW."type_mime" IS DISTINCT FROM OLD."type_mime"
     OR NEW."taille" IS DISTINCT FROM OLD."taille"
     OR NEW."nom_fichier" IS DISTINCT FROM OLD."nom_fichier"
     OR NEW."depose_at" IS DISTINCT FROM OLD."depose_at" THEN
    RAISE EXCEPTION 'apporteur_changements_iban_rib : seule la purge des octets est permise';
  END IF;
  IF NEW."octets" IS DISTINCT FROM OLD."octets" AND NOT (NEW."octets" IS NULL AND OLD."octets" IS NOT NULL) THEN
    RAISE EXCEPTION 'apporteur_changements_iban_rib : les octets ne sont jamais remplacés, seulement purgés';
  END IF;
  IF OLD."purge_at" IS NOT NULL AND NEW."purge_at" IS DISTINCT FROM OLD."purge_at" THEN
    RAISE EXCEPTION 'apporteur_changements_iban_rib : la date de purge ne change plus';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
