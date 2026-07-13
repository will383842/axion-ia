-- Facturation finition — URL de signature DocuSeal du devis (migration ADDITIVE).
-- Permet d'envoyer au client le lien pour signer en ligne (l'embed_src etait
-- fabrique puis jete ; on le stocke pour le mettre dans l'email d'envoi).

ALTER TABLE "devis" ADD COLUMN "docuseal_embed_url" TEXT;
