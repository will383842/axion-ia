-- Devis a formules, lot 4 (2026-11-06) : sceau de signature V4 (choix d'offre + preuve d'acceptation des CGV)
-- et fait sortant `commande.signee` vers la console des automatisations.
-- STRICTEMENT ADDITIF : colonnes nullables sans defaut ni rattrapage, une table NEUVE et VIDE, codes en VARCHAR + CHECK,
-- AUCUNE enumeration, AUCUN DROP / DELETE / UPDATE de donnees. Les CHECK portent sur des colonnes neuves (NULL partout).
-- Compatible avec l ANCIEN code (qui ignore ces colonnes et cette table) : migration AVANT le code, app comme worker.
-- Les colonnes choix_offre / choix_offre_sha256 existent deja (migration 20261104120000_devis_formules).
-- Les colonnes cgv_pdf_sha256 et cgv_trace_sha256 sont posees ICI, vides, pour que le sceau V4 les prevoie des
-- maintenant : le chantier d archive du PDF des CGV et de trace d acces remplira des VALEURS, jamais une V5.
--
-- Retour arriere (JAMAIS execute sans Will ; colonnes et table vides en prod tant que l interrupteur devis_formules est eteint), ordre inverse :
--   (apres le retour arriere SQL : prisma migrate resolve --rolled-back 20261106100000_devis_signature_choix_v4)
--   DROP TRIGGER IF EXISTS "console_commandes_no_truncate" ON "console_commandes";
--   DROP TRIGGER IF EXISTS "console_commandes_no_delete" ON "console_commandes";
--   DROP TRIGGER IF EXISTS "console_commandes_immuable" ON "console_commandes";
--   DROP TABLE IF EXISTS "console_commandes";
--   DROP FUNCTION IF EXISTS "console_commandes_refuse_delete"();
--   DROP FUNCTION IF EXISTS "console_commandes_refuse_modification"();
--   DROP INDEX IF EXISTS "document_signatures_jeton_id_idx";
--   ALTER TABLE "document_signatures" DROP CONSTRAINT IF EXISTS "document_signatures_cgv_preuve_chk", DROP CONSTRAINT IF EXISTS "document_signatures_cgv_sha_chk", DROP CONSTRAINT IF EXISTS "document_signatures_jeton_id_fkey";
--   ALTER TABLE "document_signatures" DROP COLUMN IF EXISTS "jeton_id", DROP COLUMN IF EXISTS "cgv_trace_sha256", DROP COLUMN IF EXISTS "cgv_acceptee_at", DROP COLUMN IF EXISTS "cgv_pdf_sha256", DROP COLUMN IF EXISTS "cgv_texte_sha256";

-- ---------------------------------------------------------------------------
-- document_signatures : preuve d acceptation des CGV + lien de signature, scelles a partir de la V4
-- ---------------------------------------------------------------------------
ALTER TABLE "document_signatures"
  ADD COLUMN "cgv_texte_sha256" CHAR(64),
  ADD COLUMN "cgv_pdf_sha256" CHAR(64),
  ADD COLUMN "cgv_acceptee_at" TIMESTAMP(3),
  ADD COLUMN "cgv_trace_sha256" CHAR(64),
  ADD COLUMN "jeton_id" UUID;

ALTER TABLE "document_signatures"
  ADD CONSTRAINT "document_signatures_cgv_sha_chk" CHECK (
    ("cgv_texte_sha256" IS NULL OR "cgv_texte_sha256" ~ '^[0-9a-f]{64}$')
    AND ("cgv_pdf_sha256" IS NULL OR "cgv_pdf_sha256" ~ '^[0-9a-f]{64}$')
    AND ("cgv_trace_sha256" IS NULL OR "cgv_trace_sha256" ~ '^[0-9a-f]{64}$')
  ),
  -- Une empreinte de texte va avec l instant de la case cochee ET avec une version de CGV ;
  -- le PDF et la trace n existent jamais sans le texte.
  ADD CONSTRAINT "document_signatures_cgv_preuve_chk" CHECK (
    ("cgv_texte_sha256" IS NULL) = ("cgv_acceptee_at" IS NULL)
    AND ("cgv_texte_sha256" IS NULL OR "cgv_version" IS NOT NULL)
    AND ("cgv_texte_sha256" IS NOT NULL OR ("cgv_pdf_sha256" IS NULL AND "cgv_trace_sha256" IS NULL))
  );

-- Une preuve de signature ne disparait jamais en cascade : RESTRICT, comme les autres liens de la table.
ALTER TABLE "document_signatures"
  ADD CONSTRAINT "document_signatures_jeton_id_fkey" FOREIGN KEY ("jeton_id") REFERENCES "document_signature_tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "document_signatures_jeton_id_idx" ON "document_signatures"("jeton_id");

-- ---------------------------------------------------------------------------
-- console_commandes : le fait `commande.signee`, ecrit dans la MEME transaction que l acceptation du devis
-- (une ligne par devis signe) ; l etat d activation renvoye par la console n y est qu AFFICHE.
-- Table NEUVE et VIDE. Le contenu du fait (payload, identifiants) ne se modifie jamais.
-- ---------------------------------------------------------------------------
CREATE TABLE "console_commandes" (
    "id" UUID NOT NULL,
    "devis_id" UUID NOT NULL,
    "numero_devis" VARCHAR(40) NOT NULL,
    "event_id" CHAR(64) NOT NULL,
    "choix_offre_sha256" CHAR(64) NOT NULL,
    "payload" JSONB NOT NULL,
    "cree_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "envoi_essais" INTEGER NOT NULL DEFAULT 0,
    "envoye_at" TIMESTAMP(3),
    "etat" VARCHAR(24),
    "etat_detail" JSONB,
    "etat_recu_at" TIMESTAMP(3),
    "etat_cle_idempotence" VARCHAR(120),

    CONSTRAINT "console_commandes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "console_commandes_event_id_chk" CHECK ("event_id" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "console_commandes_choix_sha_chk" CHECK ("choix_offre_sha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "console_commandes_essais_chk" CHECK ("envoi_essais" >= 0),
    CONSTRAINT "console_commandes_etat_chk" CHECK ("etat" IS NULL OR "etat" IN ('recue', 'a_trancher', 'acompte_attendu', 'outils_a_relier', 'en_service', 'suspendue')),
    CONSTRAINT "console_commandes_etat_coherent_chk" CHECK (("etat" IS NULL) = ("etat_recu_at" IS NULL))
);

CREATE UNIQUE INDEX "console_commandes_devis_id_key" ON "console_commandes"("devis_id");
CREATE UNIQUE INDEX "console_commandes_numero_devis_key" ON "console_commandes"("numero_devis");
CREATE UNIQUE INDEX "console_commandes_event_id_key" ON "console_commandes"("event_id");

ALTER TABLE "console_commandes"
  ADD CONSTRAINT "console_commandes_devis_id_fkey" FOREIGN KEY ("devis_id") REFERENCES "devis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "console_commandes_refuse_delete"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'console_commandes : suppression interdite (le fait commande.signee est une preuve)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "console_commandes_no_delete"
  BEFORE DELETE ON "console_commandes"
  FOR EACH ROW EXECUTE FUNCTION "console_commandes_refuse_delete"();

CREATE TRIGGER "console_commandes_no_truncate"
  BEFORE TRUNCATE ON "console_commandes"
  FOR EACH STATEMENT EXECUTE FUNCTION "console_commandes_refuse_delete"();

-- Seuls l envoi (essais, date) et l etat d activation se mettent a jour ; le fait lui-meme est immuable.
CREATE FUNCTION "console_commandes_refuse_modification"() RETURNS trigger AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."devis_id" IS DISTINCT FROM OLD."devis_id"
     OR NEW."numero_devis" IS DISTINCT FROM OLD."numero_devis"
     OR NEW."event_id" IS DISTINCT FROM OLD."event_id"
     OR NEW."choix_offre_sha256" IS DISTINCT FROM OLD."choix_offre_sha256"
     OR NEW."payload" IS DISTINCT FROM OLD."payload"
     OR NEW."cree_at" IS DISTINCT FROM OLD."cree_at" THEN
    RAISE EXCEPTION 'console_commandes : le contenu du fait commande.signee ne se modifie jamais';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "console_commandes_immuable"
  BEFORE UPDATE ON "console_commandes"
  FOR EACH ROW EXECUTE FUNCTION "console_commandes_refuse_modification"();
