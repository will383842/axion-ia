-- PR L (#2464, point 20) : dernier contrôle du registre public pour un apporteur sous contrat.
-- Ajout seul : une table NEUVE, aucune clé étrangère, aucune énumération Postgres (état en VARCHAR + CHECK).
-- Compatible avec l'ancien et le nouveau conteneur (app et worker) : tout lecteur tolère la table absente (P2021).

-- CreateTable
CREATE TABLE "apporteur_controles_registre" (
    "apporteur_id" UUID NOT NULL,
    "dernier_controle_at" TIMESTAMPTZ(3) NOT NULL,
    "etat" VARCHAR(16) NOT NULL,
    "etat_depuis" TIMESTAMPTZ(3) NOT NULL,
    "consecutifs" INTEGER NOT NULL DEFAULT 1,
    "alertee_at" TIMESTAMPTZ(3),

    CONSTRAINT "apporteur_controles_registre_pkey" PRIMARY KEY ("apporteur_id"),
    CONSTRAINT "apporteur_controles_registre_etat_check" CHECK ("etat" IN ('active', 'fermee', 'introuvable'))
);

-- CreateIndex
CREATE INDEX "apporteur_controles_registre_dernier_controle_at_idx" ON "apporteur_controles_registre"("dernier_controle_at");
