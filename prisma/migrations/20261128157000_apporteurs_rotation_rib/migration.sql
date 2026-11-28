-- PR P (#2464, point 27) — rotation de la clé de chiffrement : sortie `rotation` du garde des RIB joints.
-- Le garde de 20261126150000 refuse tout remplacement d'octets (« seulement purgés »). La rotation doit réécrire
-- une enveloppe AXB1 par une autre AXB1 (même clair, nouvelle clé). Corps recopié à l'identique, avec UNE sortie en
-- plus, placée avant le premier test : seulement sous `SET LOCAL axion.reecriture_pii = 'rotation'` (le réglage ne
-- survit pas à la transaction), octets chiffrés des deux côtés, et toute autre colonne inchangée.
-- Additif : aucune colonne, aucune table, aucune énumération. Un ancien code ne pose jamais ce réglage.
CREATE OR REPLACE FUNCTION "apporteur_changements_iban_rib_garde_update"() RETURNS trigger AS $$
BEGIN
  IF current_setting('axion.reecriture_pii', true) = 'rotation'
     AND OLD."octets" IS NOT NULL AND NEW."octets" IS NOT NULL
     AND substring(OLD."octets" from 1 for 4) = '\x41584231'::bytea
     AND substring(NEW."octets" from 1 for 4) = '\x41584231'::bytea
     AND (to_jsonb(NEW) - 'octets') = (to_jsonb(OLD) - 'octets') THEN
    RETURN NEW;
  END IF;
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
