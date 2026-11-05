-- Archive immuable de chaque version des CGV (preuve d acceptation, P1, 2026-11-05).
-- SQL SEUL (les champs Prisma arrivent avec la PR suivante : le worker ne doit pas connaitre la table avant qu elle existe).
-- STRICTEMENT ADDITIF : une table NEUVE et VIDE, codes en VARCHAR + CHECK, AUCUNE enumeration,
-- AUCUN DROP / DELETE / UPDATE de donnees, aucune table existante touchee.
-- Compatible avec l ANCIEN code (qui ignore cette table) : migration AVANT le code, app comme worker.
-- Une version archivee ne se modifie jamais : UPDATE, DELETE et TRUNCATE sont refuses par declencheur
-- (meme doctrine que devis_textes_bibliotheque, migration 20261104120000_devis_formules).
--
-- Retour arriere (JAMAIS execute sans Will ; table vide en prod tant que l archivage n est pas lance), ordre inverse :
--   (apres le retour arriere SQL : prisma migrate resolve --rolled-back 20261104160000_cgv_archives)
--   DROP TRIGGER IF EXISTS "cgv_archives_no_truncate" ON "cgv_archives";
--   DROP TRIGGER IF EXISTS "cgv_archives_no_update_delete" ON "cgv_archives";
--   DROP TABLE IF EXISTS "cgv_archives";
--   DROP FUNCTION IF EXISTS "cgv_archives_refuse_modification"();

CREATE TABLE "cgv_archives" (
    "version" VARCHAR(40) NOT NULL,
    "libelle" VARCHAR(80) NOT NULL,
    "texte_canonique" TEXT NOT NULL,
    "texte_sha256" CHAR(64) NOT NULL,
    "pdf_r2_key" TEXT NOT NULL,
    "pdf_sha256" CHAR(64) NOT NULL,
    "pdf_taille" INTEGER NOT NULL,
    "archivee_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

    CONSTRAINT "cgv_archives_pkey" PRIMARY KEY ("version"),
    CONSTRAINT "cgv_archives_texte_sha256_chk" CHECK ("texte_sha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "cgv_archives_pdf_sha256_chk" CHECK ("pdf_sha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "cgv_archives_pdf_taille_chk" CHECK ("pdf_taille" > 0)
);

CREATE FUNCTION "cgv_archives_refuse_modification"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'cgv_archives : une version archivee ne se modifie ni ne se supprime jamais';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "cgv_archives_no_update_delete"
  BEFORE UPDATE OR DELETE ON "cgv_archives"
  FOR EACH ROW EXECUTE FUNCTION "cgv_archives_refuse_modification"();

-- TRUNCATE aussi (meme fonction : elle refuse sans condition).
CREATE TRIGGER "cgv_archives_no_truncate"
  BEFORE TRUNCATE ON "cgv_archives"
  FOR EACH STATEMENT EXECUTE FUNCTION "cgv_archives_refuse_modification"();
