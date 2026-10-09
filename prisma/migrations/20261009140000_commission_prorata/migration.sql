-- Contrat 2.7 (art. 3.6) : une commande qui profite aussi à d'autres établissements est
-- commissionnée au prorata des participants de l'établissement attribué. Les deux nombres sont
-- saisis dans la console ; la commission d'avant (commande entière) est gardée à côté. Table
-- séparée, sans clé étrangère déclarée, comme `apporteur_reseau_retrait` : aucune requête
-- existante n'en dépend (fenêtre app/worker). Aucune ligne = commande entière. Ajout seul.
CREATE TABLE "commission_prorata" (
    "commission_id" UUID NOT NULL,
    "participants_etablissement" INTEGER NOT NULL,
    "participants_commande" INTEGER NOT NULL,
    "montant_avant_cents" INTEGER NOT NULL,
    "maj_par" VARCHAR(64),
    "maj_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_prorata_pkey" PRIMARY KEY ("commission_id")
);
