-- Devis a formules, lot 4 bis (2026-11-07) : signature electronique « simple renforcee » gratuite du devis.
-- Code a usage unique par e-mail (plafonds par lien, blocage de 15 minutes), declaration du signataire (nom, fonction,
-- pouvoir d engager la societe) scellee en V4, et horodatage certifie RFC 3161 du sceau (table neuve, completee par un job).
-- STRICTEMENT ADDITIF : colonnes nullables sans defaut ni rattrapage, une table NEUVE et VIDE, aucune enumeration,
-- AUCUN DROP / DELETE / UPDATE de donnees. Les CHECK portent sur des colonnes neuves (NULL partout).
-- Compatible avec l ANCIEN code (qui ignore ces colonnes et cette table) : migration AVANT le code, app comme worker.
--
-- Retour arriere (JAMAIS execute sans Will ; colonnes et table vides en prod tant qu aucune signature renforcee n existe), ordre inverse :
--   (apres le retour arriere SQL : prisma migrate resolve --rolled-back 20261107120000_devis_signature_renforcee)
--   DROP TRIGGER IF EXISTS "document_signature_horodatages_no_truncate" ON "document_signature_horodatages";
--   DROP TRIGGER IF EXISTS "document_signature_horodatages_no_delete" ON "document_signature_horodatages";
--   DROP TRIGGER IF EXISTS "document_signature_horodatages_garde" ON "document_signature_horodatages";
--   DROP TABLE IF EXISTS "document_signature_horodatages";
--   DROP FUNCTION IF EXISTS "document_signature_horodatages_refuse_delete"();
--   DROP FUNCTION IF EXISTS "document_signature_horodatages_garde_update"();
--   ALTER TABLE "document_signatures" DROP CONSTRAINT IF EXISTS "document_signatures_declaration_chk";
--   ALTER TABLE "document_signatures" DROP COLUMN IF EXISTS "code_verifie_at", DROP COLUMN IF EXISTS "pouvoir_declare_at", DROP COLUMN IF EXISTS "declaration_fonction", DROP COLUMN IF EXISTS "declaration_nom";
--   DROP INDEX IF EXISTS "document_signature_codes_jeton_id_created_at_idx";
--   ALTER TABLE "document_signature_codes" DROP COLUMN IF EXISTS "bloque_jusqu_a", DROP COLUMN IF EXISTS "jeton_id";

-- ---------------------------------------------------------------------------
-- document_signature_codes : lien demandeur (plafond d envois par lien) + blocage apres 5 echecs
-- ---------------------------------------------------------------------------
ALTER TABLE "document_signature_codes"
  ADD COLUMN "jeton_id" UUID,
  ADD COLUMN "bloque_jusqu_a" TIMESTAMP(3);

CREATE INDEX "document_signature_codes_jeton_id_created_at_idx"
  ON "document_signature_codes"("jeton_id", "created_at");

-- ---------------------------------------------------------------------------
-- document_signatures : ce que le signataire a saisi et declare, scelle en V4 quand il est present
-- ---------------------------------------------------------------------------
ALTER TABLE "document_signatures"
  ADD COLUMN "declaration_nom" VARCHAR(200),
  ADD COLUMN "declaration_fonction" VARCHAR(200),
  ADD COLUMN "pouvoir_declare_at" TIMESTAMP(3),
  ADD COLUMN "code_verifie_at" TIMESTAMP(3);

-- Tout ou rien : une declaration est complete (nom, fonction, pouvoir, code) ou absente.
ALTER TABLE "document_signatures"
  ADD CONSTRAINT "document_signatures_declaration_chk" CHECK (
    (
      "declaration_nom" IS NULL AND "declaration_fonction" IS NULL
      AND "pouvoir_declare_at" IS NULL AND "code_verifie_at" IS NULL
    ) OR (
      length(btrim("declaration_nom")) >= 2 AND length(btrim("declaration_fonction")) >= 2
      AND "pouvoir_declare_at" IS NOT NULL AND "code_verifie_at" IS NOT NULL
      AND "pouvoir_declare_at" <= "signe_at" AND "code_verifie_at" <= "signe_at"
    )
  );

-- ---------------------------------------------------------------------------
-- document_signature_horodatages : horodatage RFC 3161 du sceau. Table NEUVE et VIDE.
-- La signature ne depend jamais de l horodatage : la ligne naît en_attente, un job la complete.
-- ---------------------------------------------------------------------------
CREATE TABLE "document_signature_horodatages" (
    "id" UUID NOT NULL,
    "signature_id" UUID NOT NULL,
    "empreinte_sha256" CHAR(64) NOT NULL,
    "statut" VARCHAR(12) NOT NULL DEFAULT 'en_attente',
    "autorite" VARCHAR(300),
    "jeton" BYTEA,
    "jeton_sha256" CHAR(64),
    "horodate_at" TIMESTAMP(3),
    "essais" INTEGER NOT NULL DEFAULT 0,
    "dernier_essai_at" TIMESTAMP(3),
    "prochain_essai_at" TIMESTAMP(3) NOT NULL,
    "derniere_erreur" VARCHAR(200),
    "cree_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_signature_horodatages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "document_signature_horodatages_empreinte_chk" CHECK ("empreinte_sha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "document_signature_horodatages_statut_chk" CHECK ("statut" IN ('en_attente', 'obtenu')),
    CONSTRAINT "document_signature_horodatages_essais_chk" CHECK ("essais" >= 0),
    CONSTRAINT "document_signature_horodatages_jeton_sha_chk" CHECK ("jeton_sha256" IS NULL OR "jeton_sha256" ~ '^[0-9a-f]{64}$'),
    -- Obtenu = jeton, son empreinte, l instant du jeton et l autorite, ensemble ; en attente = aucun des quatre.
    CONSTRAINT "document_signature_horodatages_coherent_chk" CHECK (
      ("statut" = 'obtenu' AND "jeton" IS NOT NULL AND "jeton_sha256" IS NOT NULL
        AND "horodate_at" IS NOT NULL AND "autorite" IS NOT NULL)
      OR ("statut" = 'en_attente' AND "jeton" IS NULL AND "jeton_sha256" IS NULL
        AND "horodate_at" IS NULL AND "autorite" IS NULL)
    )
);

CREATE UNIQUE INDEX "document_signature_horodatages_signature_id_key" ON "document_signature_horodatages"("signature_id");
CREATE INDEX "document_signature_horodatages_statut_prochain_essai_at_idx" ON "document_signature_horodatages"("statut", "prochain_essai_at");

-- Une preuve ne disparait jamais en cascade : RESTRICT, comme les autres liens de la table des signatures.
ALTER TABLE "document_signature_horodatages"
  ADD CONSTRAINT "document_signature_horodatages_signature_id_fkey"
  FOREIGN KEY ("signature_id") REFERENCES "document_signatures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ajout seul : ni DELETE ni TRUNCATE. Seuls les champs de SUIVI (essais, echeance, erreur) et le passage
-- en_attente -> obtenu sont modifiables ; la signature, l empreinte, la date de creation et un jeton obtenu ne changent plus.
CREATE FUNCTION "document_signature_horodatages_refuse_delete"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'document_signature_horodatages : suppression interdite (ajout seul)';
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "document_signature_horodatages_garde_update"() RETURNS trigger AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."signature_id" IS DISTINCT FROM OLD."signature_id"
     OR NEW."empreinte_sha256" IS DISTINCT FROM OLD."empreinte_sha256"
     OR NEW."cree_at" IS DISTINCT FROM OLD."cree_at" THEN
    RAISE EXCEPTION 'document_signature_horodatages : signature, empreinte et creation sont immuables';
  END IF;
  IF OLD."statut" = 'obtenu' AND (
       NEW."statut" IS DISTINCT FROM OLD."statut"
       OR NEW."jeton" IS DISTINCT FROM OLD."jeton"
       OR NEW."jeton_sha256" IS DISTINCT FROM OLD."jeton_sha256"
       OR NEW."horodate_at" IS DISTINCT FROM OLD."horodate_at"
       OR NEW."autorite" IS DISTINCT FROM OLD."autorite") THEN
    RAISE EXCEPTION 'document_signature_horodatages : un jeton obtenu est definitif';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "document_signature_horodatages_no_delete"
  BEFORE DELETE ON "document_signature_horodatages"
  FOR EACH ROW EXECUTE FUNCTION "document_signature_horodatages_refuse_delete"();
CREATE TRIGGER "document_signature_horodatages_no_truncate"
  BEFORE TRUNCATE ON "document_signature_horodatages"
  FOR EACH STATEMENT EXECUTE FUNCTION "document_signature_horodatages_refuse_delete"();
CREATE TRIGGER "document_signature_horodatages_garde"
  BEFORE UPDATE ON "document_signature_horodatages"
  FOR EACH ROW EXECUTE FUNCTION "document_signature_horodatages_garde_update"();
