-- Réseau d'apporteurs, challenges (invitation libre) — lots « console » et « espace » : la table
-- des règles seulement. Aucune clé étrangère, aucune énumération (fenêtre app/worker), rien
-- d'affiché tant que l'administrateur n'a pas publié (état `brouillon` par défaut). Aucune
-- donnée d'exemple. Ajout seul, rejouable (IF NOT EXISTS) : aucun UPDATE, DELETE ni DROP.
CREATE TABLE IF NOT EXISTS "challenges_apporteur" (
    "id" UUID NOT NULL,
    "titre" VARCHAR(120) NOT NULL,
    "debut_le" DATE NOT NULL,
    "fin_le" DATE NOT NULL,
    "paiement_jusqu_au" DATE,
    "produit" VARCHAR(40) NOT NULL,
    "critere" VARCHAR(40) NOT NULL,
    "seuil" INTEGER NOT NULL,
    "prime_ht_cents" INTEGER NOT NULL,
    "reglement" TEXT NOT NULL,
    "reglement_sha256" CHAR(64),
    "statut" VARCHAR(20) NOT NULL DEFAULT 'brouillon',
    "publie_at" TIMESTAMPTZ(3),
    "archive_at" TIMESTAMPTZ(3),
    "publie_par" VARCHAR(64),
    "cree_par" VARCHAR(64),
    "cree_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maj_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "challenges_apporteur_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "challenges_apporteur_statut_check" CHECK ("statut" IN ('brouillon', 'publie', 'archive')),
    CONSTRAINT "challenges_apporteur_produit_check" CHECK ("produit" IN ('journee-ia')),
    CONSTRAINT "challenges_apporteur_critere_check" CHECK ("critere" IN ('facturees_dans_la_periode')),
    CONSTRAINT "challenges_apporteur_seuil_check" CHECK ("seuil" BETWEEN 1 AND 999),
    CONSTRAINT "challenges_apporteur_prime_check" CHECK ("prime_ht_cents" > 0),
    CONSTRAINT "challenges_apporteur_periode_check" CHECK ("fin_le" >= "debut_le"),
    CONSTRAINT "challenges_apporteur_paiement_check" CHECK ("paiement_jusqu_au" IS NULL OR "paiement_jusqu_au" >= "fin_le")
);

CREATE INDEX IF NOT EXISTS "challenges_apporteur_statut_debut_idx" ON "challenges_apporteur"("statut", "debut_le");
