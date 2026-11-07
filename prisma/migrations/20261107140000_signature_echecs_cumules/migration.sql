-- Signature renforcee du devis, audit securite (2026-11-07) : compteur d echecs de saisie de code CUMULE par
-- (piece, partie), tous codes confondus. Le blocage de 15 minutes se contournait en redemandant un code
-- (le compteur d essais etait par code) ; ce compteur survit a l emission d un nouveau code.
-- STRICTEMENT ADDITIF : une table NEUVE et VIDE, aucune colonne ajoutee ailleurs, aucune enumeration,
-- AUCUN DROP / DELETE / UPDATE de donnees. Compatible avec l ANCIEN code (qui ignore cette table) :
-- migration AVANT le code, app comme worker.
--
-- Retour arriere (JAMAIS execute sans Will ; table vide tant qu aucune signature renforcee n a echoue), ordre inverse :
--   (apres le retour arriere SQL : prisma migrate resolve --rolled-back 20261107140000_signature_echecs_cumules)
--   DROP TABLE IF EXISTS "document_signature_echecs";

CREATE TABLE "document_signature_echecs" (
    "id" UUID NOT NULL,
    "document_genere_id" UUID NOT NULL,
    "partie" "DocumentPartieSignataire" NOT NULL,
    "echecs" INTEGER NOT NULL DEFAULT 0,
    "fenetre_debut_at" TIMESTAMP(3) NOT NULL,
    "bloque_jusqu_a" TIMESTAMP(3),

    CONSTRAINT "document_signature_echecs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "document_signature_echecs_echecs_chk" CHECK ("echecs" >= 0)
);

CREATE UNIQUE INDEX "document_signature_echecs_document_genere_id_partie_key"
  ON "document_signature_echecs"("document_genere_id", "partie");
