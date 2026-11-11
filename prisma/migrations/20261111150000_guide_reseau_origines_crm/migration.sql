-- Lot guide réseau 4 (2026-11-11) — état CRM de chaque origine de guide réseau.
-- STRICTEMENT ADDITIF : deux colonnes NULLABLES et un index partiel sur une table existante.
-- Aucune reprise de données : les origines existantes restent NULL (« pas encore parties »).
-- Compatible avec l'ANCIEN conteneur (il ignore les colonnes). À atterrir SEUL, avant tout code qui les lit.
-- Valeurs de crm_statut : NULL | 'transmise' | 'ecartee' (VARCHAR : aucune énumération Postgres).
-- Retour arrière : éteindre les interrupteurs ; les colonnes restent (aucun DROP).

-- AlterTable
ALTER TABLE "guide_reseau_origines"
  ADD COLUMN "crm_statut"     VARCHAR(16),
  ADD COLUMN "crm_traitee_le" TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "guide_reseau_origines_crm_a_faire_idx"
  ON "guide_reseau_origines" ("created_at") WHERE "crm_statut" IS NULL;
