-- Contrat 2.7 (art. 3.2 et 3.7) : la personne qui a rencontré l'entreprise pour le compte de
-- l'apporteur (associé, salarié), facultative. Nom chiffré par l'application. Table séparée, sans
-- clé étrangère déclarée, comme `presentation_etablissement` : aucune requête existante sur
-- `presentations_entreprise` n'en dépend (fenêtre app/worker). Aucune ligne = l'apporteur
-- lui-même. Ajout seul.
CREATE TABLE "presentation_rencontre" (
    "presentation_id" UUID NOT NULL,
    "personne" TEXT NOT NULL,
    "maj_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "presentation_rencontre_pkey" PRIMARY KEY ("presentation_id")
);
