-- Avenant 2.8 (#2512, lot S1) : table des avenants proposés aux apporteurs signés en 2.6.
-- Purement additive. Sans clé étrangère (fenêtre app/worker), comme `apporteur_reseau_siret`.
CREATE TABLE IF NOT EXISTS "apporteur_avenants" (
    "id" UUID NOT NULL,
    "apporteur_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "version_cible" VARCHAR(16) NOT NULL,
    "version_depart" VARCHAR(16) NOT NULL,
    "texte_avenant" TEXT NOT NULL,
    "texte_avenant_sha256" CHAR(64) NOT NULL,
    "texte_contrat_sha256" CHAR(64) NOT NULL,
    "statut" VARCHAR(16) NOT NULL DEFAULT 'propose',
    "propose_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "relance_at" TIMESTAMPTZ(3),
    "accepte_at" TIMESTAMPTZ(3),
    "preuve" JSONB,
    "enregistre_at" TIMESTAMPTZ(3),
    "pdf_cle" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apporteur_avenants_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "apporteur_avenants_statut_check" CHECK ("statut" IN ('propose', 'accepte', 'enregistre', 'decline', 'retire'))
);

CREATE INDEX IF NOT EXISTS "apporteur_avenants_apporteur_id_idx" ON "apporteur_avenants"("apporteur_id");

-- Une seule ligne active par apporteur.
CREATE UNIQUE INDEX IF NOT EXISTS "apporteur_avenants_une_active_uniq" ON "apporteur_avenants"("apporteur_id") WHERE "statut" IN ('propose', 'accepte', 'enregistre');
