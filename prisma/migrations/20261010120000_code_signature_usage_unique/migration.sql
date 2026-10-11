-- Lot S6a (e) — code à usage unique pour signer une pièce (ADR 0066 étape 7).
-- Empreinte HMAC seule, jamais le clair. Table neuve, sans clé étrangère déclarée :
-- aucune requête existante n'en dépend (fenêtre app/worker). Ajout seul.
-- CreateTable
CREATE TABLE "document_signature_codes" (
    "id" UUID NOT NULL,
    "document_genere_id" UUID NOT NULL,
    "partie" "DocumentPartieSignataire" NOT NULL,
    "code_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "essais" INTEGER NOT NULL DEFAULT 0,
    "utilise_at" TIMESTAMP(3),
    "invalide_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_signature_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_signature_codes_document_genere_id_partie_idx" ON "document_signature_codes"("document_genere_id", "partie");

-- CreateIndex
CREATE INDEX "document_signature_codes_expires_at_idx" ON "document_signature_codes"("expires_at");

