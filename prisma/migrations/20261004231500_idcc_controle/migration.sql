-- INT-T61-A — contrôle croisé de l'IDCC : statut fermé et preuve déclarative.
-- AJOUTS SEULS : deux énumérations et deux tables neuves ; aucune colonne n'est
-- ajoutée ni modifiée sur "clients" ni ailleurs.
-- AUCUNE colonne de fichier, d'adresse de fichier ni de texte libre : une
-- confirmation est une DÉCLARATION typée (auteur, date), jamais une pièce.

-- CreateEnum
CREATE TYPE "StatutIdcc" AS ENUM ('non_renseigne', 'probable', 'concordant', 'anomalie', 'confirme');

-- CreateEnum
CREATE TYPE "PreuveIdccDeclarative" AS ENUM ('attestation_entreprise', 'declaration_opco', 'accord_prise_en_charge_opco');

-- CreateTable
CREATE TABLE "client_idcc_controles" (
    "client_id" UUID NOT NULL,
    "statut" "StatutIdcc" NOT NULL DEFAULT 'non_renseigne',
    "idcc" CHAR(4),
    "preuve_type" "PreuveIdccDeclarative",
    "preuve_auteur_id" UUID,
    "preuve_le" TIMESTAMPTZ(6),
    "maj_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "client_idcc_controles_pkey" PRIMARY KEY ("client_id")
);

-- CreateTable
CREATE TABLE "client_idcc_controle_journal" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "de" "StatutIdcc",
    "vers" "StatutIdcc" NOT NULL,
    "preuve_type" "PreuveIdccDeclarative",
    "auteur_id" UUID,
    "cree_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_idcc_controle_journal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_idcc_controles_statut_idx" ON "client_idcc_controles"("statut");

-- CreateIndex
CREATE INDEX "client_idcc_controle_journal_client_id_cree_at_idx" ON "client_idcc_controle_journal"("client_id", "cree_at");

-- AddForeignKey
ALTER TABLE "client_idcc_controles" ADD CONSTRAINT "client_idcc_controles_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_idcc_controle_journal" ADD CONSTRAINT "client_idcc_controle_journal_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Un IDCC tient sur exactement quatre chiffres.
ALTER TABLE "client_idcc_controles" ADD CONSTRAINT "client_idcc_controles_idcc_check"
  CHECK ("idcc" IS NULL OR "idcc" ~ '^[0-9]{4}$');
-- Les trois champs de la preuve sont posés ensemble, ou pas du tout.
ALTER TABLE "client_idcc_controles" ADD CONSTRAINT "client_idcc_controles_preuve_entiere"
  CHECK (("preuve_type" IS NULL) = ("preuve_auteur_id" IS NULL)
         AND ("preuve_type" IS NULL) = ("preuve_le" IS NULL));
-- « confirme » ⇔ une preuve déclarative ET l'IDCC qu'elle confirme.
ALTER TABLE "client_idcc_controles" ADD CONSTRAINT "client_idcc_controles_confirme_preuve"
  CHECK (("statut" = 'confirme') = ("preuve_type" IS NOT NULL AND "idcc" IS NOT NULL));
-- Le journal ne note qu'un vrai changement.
ALTER TABLE "client_idcc_controle_journal" ADD CONSTRAINT "client_idcc_controle_journal_change"
  CHECK ("de" IS DISTINCT FROM "vers");
-- Une entrée vers « confirme » nomme le type de preuve et son auteur.
ALTER TABLE "client_idcc_controle_journal" ADD CONSTRAINT "client_idcc_controle_journal_confirme_preuve"
  CHECK ("vers" <> 'confirme' OR ("preuve_type" IS NOT NULL AND "auteur_id" IS NOT NULL));
