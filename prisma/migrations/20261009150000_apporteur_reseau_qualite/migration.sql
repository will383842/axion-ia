-- Contrat 2.7 (art. 14) : la qualité de l'apporteur. Société : adresse du siège et fonction de la
-- personne qui signe ; entrepreneur individuel : immatriculé au RCS ou non. Colonnes nullables dans
-- une table séparée, sans clé étrangère déclarée, comme `apporteur_reseau_siret` : aucune requête
-- existante sur `apporteurs_reseau` n'en dépend (fenêtre app/worker), aucun dossier existant n'est
-- touché. Aucune ligne = texte d'avant la 2.7. Ajout seul.
CREATE TABLE "apporteur_reseau_qualite" (
    "apporteur_id" UUID NOT NULL,
    "siege_adresse" VARCHAR(400),
    "fonction_signataire" VARCHAR(100),
    "immatricule_rcs" BOOLEAN,
    "maj_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apporteur_reseau_qualite_pkey" PRIMARY KEY ("apporteur_id")
);
