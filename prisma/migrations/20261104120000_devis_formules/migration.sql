-- Devis a formules (lot 0, 2026-11-04) : colonnes et bibliotheque de textes.
-- SQL SEUL (les champs Prisma arrivent avec la PR B : le worker ne doit pas connaitre les colonnes avant qu elles existent).
-- STRICTEMENT ADDITIF : colonnes nullables sans defaut ni rattrapage, codes en VARCHAR + CHECK, AUCUNE enumeration,
-- AUCUN DROP / DELETE / UPDATE de donnees. Les CHECK portent sur des colonnes neuves, donc NULL partout : aucune ligne existante ne peut les violer.
-- Compatible avec l ANCIEN code (qui ne connait pas ces colonnes) : migration AVANT le code, app comme worker.
-- Codes de formule : 'achat' / 'abonnement' (codes du contrat avec la console ; A/B = affichage seulement).
--
-- Retour arriere (JAMAIS execute sans Will ; colonnes vides en prod tant que l interrupteur devis_formules est eteint), ordre inverse :
--   (apres le retour arriere SQL : prisma migrate resolve --rolled-back 20261104120000_devis_formules)
--   DROP TRIGGER IF EXISTS "devis_textes_bibliotheque_no_truncate" ON "devis_textes_bibliotheque";
--   DROP TRIGGER IF EXISTS "devis_textes_bibliotheque_no_delete" ON "devis_textes_bibliotheque";
--   DROP TABLE IF EXISTS "devis_textes_bibliotheque";
--   DROP FUNCTION IF EXISTS "devis_textes_bibliotheque_refuse_delete"();
--   DROP INDEX IF EXISTS "plans_recurrents_devis_nature_uq";
--   ALTER TABLE "plans_recurrents" DROP CONSTRAINT IF EXISTS "plans_recurrents_devis_nature_chk", DROP CONSTRAINT IF EXISTS "plans_recurrents_nature_chk", DROP CONSTRAINT IF EXISTS "plans_recurrents_devis_id_fkey";
--   ALTER TABLE "plans_recurrents" DROP COLUMN IF EXISTS "valide_par_admin_id", DROP COLUMN IF EXISTS "valide_at", DROP COLUMN IF EXISTS "propose_at", DROP COLUMN IF EXISTS "nature", DROP COLUMN IF EXISTS "devis_id";
--   ALTER TABLE "document_signatures" DROP CONSTRAINT IF EXISTS "document_signatures_choix_offre_sha_chk";
--   ALTER TABLE "document_signatures" DROP COLUMN IF EXISTS "choix_offre_sha256", DROP COLUMN IF EXISTS "choix_offre";
--   DROP INDEX IF EXISTS "devis_choix_signature_id_idx";
--   ALTER TABLE "devis" DROP CONSTRAINT IF EXISTS "devis_formule_sans_offre_chk", DROP CONSTRAINT IF EXISTS "devis_offre_sha_chk", DROP CONSTRAINT IF EXISTS "devis_formule_retenue_chk", DROP CONSTRAINT IF EXISTS "devis_choix_signature_id_fkey";
--   ALTER TABLE "devis" DROP COLUMN IF EXISTS "livre_at", DROP COLUMN IF EXISTS "livraison_debut_at", DROP COLUMN IF EXISTS "choix_signature_id", DROP COLUMN IF EXISTS "choix_retenu", DROP COLUMN IF EXISTS "formule_retenue", DROP COLUMN IF EXISTS "offre_sha256", DROP COLUMN IF EXISTS "offre";

-- ---------------------------------------------------------------------------
-- devis : offre a formules, formule retenue, choix scelle, jalons de livraison
-- ---------------------------------------------------------------------------
ALTER TABLE "devis"
  ADD COLUMN "offre" JSONB,
  ADD COLUMN "offre_sha256" CHAR(64),
  ADD COLUMN "formule_retenue" VARCHAR(12),
  ADD COLUMN "choix_retenu" JSONB,
  ADD COLUMN "choix_signature_id" UUID,
  ADD COLUMN "livraison_debut_at" TIMESTAMP(3),
  ADD COLUMN "livre_at" TIMESTAMP(3);

ALTER TABLE "devis"
  ADD CONSTRAINT "devis_formule_retenue_chk" CHECK ("formule_retenue" IS NULL OR "formule_retenue" IN ('achat', 'abonnement')),
  ADD CONSTRAINT "devis_offre_sha_chk" CHECK (("offre" IS NULL) = ("offre_sha256" IS NULL)),
  ADD CONSTRAINT "devis_formule_sans_offre_chk" CHECK ("formule_retenue" IS NULL OR "offre" IS NOT NULL);

-- Une preuve de signature ne disparait jamais en cascade (comme document_signatures.document_genere_id).
ALTER TABLE "devis"
  ADD CONSTRAINT "devis_choix_signature_id_fkey" FOREIGN KEY ("choix_signature_id") REFERENCES "document_signatures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "devis_choix_signature_id_idx" ON "devis"("choix_signature_id");

-- ---------------------------------------------------------------------------
-- document_signatures : choix du client scelle (hache a partir du sceau V4, lot 4)
-- ---------------------------------------------------------------------------
ALTER TABLE "document_signatures"
  ADD COLUMN "choix_offre" JSONB,
  ADD COLUMN "choix_offre_sha256" CHAR(64);

ALTER TABLE "document_signatures"
  ADD CONSTRAINT "document_signatures_choix_offre_sha_chk" CHECK (("choix_offre" IS NULL) = ("choix_offre_sha256" IS NULL));

-- ---------------------------------------------------------------------------
-- plans_recurrents : rattachement au devis et validation (servira au lot 5)
-- Les automatisations pilotees par la console n ont JAMAIS de plan Hub (un seul createur : la console).
-- ---------------------------------------------------------------------------
ALTER TABLE "plans_recurrents"
  ADD COLUMN "devis_id" UUID,
  ADD COLUMN "nature" VARCHAR(20),
  ADD COLUMN "propose_at" TIMESTAMP(3),
  ADD COLUMN "valide_at" TIMESTAMP(3),
  ADD COLUMN "valide_par_admin_id" UUID;

ALTER TABLE "plans_recurrents"
  ADD CONSTRAINT "plans_recurrents_nature_chk" CHECK ("nature" IS NULL OR "nature" IN ('maintenance', 'abonnement', 'hebergement'));

-- Un plan lie a un devis porte toujours sa nature (sinon l index unique partiel ne le distingue pas).
ALTER TABLE "plans_recurrents"
  ADD CONSTRAINT "plans_recurrents_devis_nature_chk" CHECK ("devis_id" IS NULL OR "nature" IS NOT NULL);

ALTER TABLE "plans_recurrents"
  ADD CONSTRAINT "plans_recurrents_devis_id_fkey" FOREIGN KEY ("devis_id") REFERENCES "devis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Un seul plan d une nature donnee par devis (aucune ligne existante concernee : devis_id est NULL partout).
CREATE UNIQUE INDEX "plans_recurrents_devis_nature_uq" ON "plans_recurrents"("devis_id", "nature") WHERE "devis_id" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- devis_textes_bibliotheque : table NEUVE et VIDE (textes poses au lot 1, a valider par Will et le juriste)
-- Archivage seulement : la suppression est refusee par un trigger.
-- ---------------------------------------------------------------------------
CREATE TABLE "devis_textes_bibliotheque" (
    "id" UUID NOT NULL,
    "formule" VARCHAR(12) NOT NULL,
    "nature" VARCHAR(20) NOT NULL,
    "texte" TEXT NOT NULL,
    "actif_par_defaut" BOOLEAN NOT NULL DEFAULT false,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "a_valider" BOOLEAN NOT NULL DEFAULT true,
    "archive_at" TIMESTAMP(3),
    "maj_par_admin_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devis_textes_bibliotheque_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "devis_textes_bibliotheque_formule_chk" CHECK ("formule" IN ('achat', 'abonnement', 'commun')),
    CONSTRAINT "devis_textes_bibliotheque_nature_chk" CHECK ("nature" IN ('avantage', 'inconvenient', 'prerequis', 'clause'))
);

CREATE INDEX "devis_textes_bibliotheque_formule_nature_idx" ON "devis_textes_bibliotheque"("formule", "nature", "ordre");

CREATE FUNCTION "devis_textes_bibliotheque_refuse_delete"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'devis_textes_bibliotheque : suppression interdite, archiver (archive_at) a la place';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "devis_textes_bibliotheque_no_delete"
  BEFORE DELETE ON "devis_textes_bibliotheque"
  FOR EACH ROW EXECUTE FUNCTION "devis_textes_bibliotheque_refuse_delete"();

-- TRUNCATE aussi (meme fonction : elle refuse sans condition), comme numeros_emis_pas_de_truncate.
CREATE TRIGGER "devis_textes_bibliotheque_no_truncate" BEFORE TRUNCATE ON "devis_textes_bibliotheque"
  FOR EACH STATEMENT EXECUTE FUNCTION "devis_textes_bibliotheque_refuse_delete"();
