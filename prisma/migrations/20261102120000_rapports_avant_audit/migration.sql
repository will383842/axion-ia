-- Rapport d'analyse avant audit (2026-11-02) : un lancement = une ligne, historique gardé.
-- ADDITIVE, AUTONOME : CREATE TABLE / CREATE INDEX / contraintes dans un bloc DO. Aucun DROP,
-- aucune énumération Postgres (statut en texte + CHECK), aucune colonne sur `clients` (ADR 0053).
-- RÉ-EXÉCUTABLE (IF NOT EXISTS). Fenêtre app/worker (~50 min) : seul le worker lit la table, et
-- seulement sur un job posé par l'action de la console — donc par l'app, après cette migration.
-- `base_audit` et `propositions_fiche` : chiffrés par `chiffrerParole` ; jamais de clair.
-- `client_id` en RESTRICT : une fiche qui a un rapport ne part pas avec lui (aucune purge).
-- Retour arrière (JAMAIS exécuté par défaut) :
--   DROP TABLE "rapports_avant_audit";

CREATE TABLE IF NOT EXISTS "rapports_avant_audit" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "questionnaire_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "statut" VARCHAR(20) NOT NULL DEFAULT 'en_attente',
    "etape" VARCHAR(200),
    "progression" INTEGER NOT NULL DEFAULT 0,
    "erreur" TEXT,
    "lance_par_id" UUID,
    "debut_le" TIMESTAMP(3),
    "fin_le" TIMESTAMP(3),
    "version_schema" VARCHAR(40),
    "base_audit" TEXT,
    "base_empreinte" VARCHAR(64),
    "jetons_entree" INTEGER NOT NULL DEFAULT 0,
    "jetons_sortie" INTEGER NOT NULL DEFAULT 0,
    "nb_recherches" INTEGER NOT NULL DEFAULT 0,
    "pdf_chemin" TEXT,
    "pdf_valide_le" TIMESTAMP(3),
    "pdf_valide_par_id" UUID,
    "propositions_fiche" JSONB,
    "ecarte_le" TIMESTAMP(3),
    "ecarte_motif" VARCHAR(200),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maj_le" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rapports_avant_audit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "rapports_avant_audit_client_id_cree_le_idx" ON "rapports_avant_audit"("client_id", "cree_le");
CREATE INDEX IF NOT EXISTS "rapports_avant_audit_statut_idx" ON "rapports_avant_audit"("statut");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rapports_avant_audit_client_id_fkey') THEN
    ALTER TABLE "rapports_avant_audit" ADD CONSTRAINT "rapports_avant_audit_client_id_fkey"
      FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rapports_avant_audit_statut_check') THEN
    ALTER TABLE "rapports_avant_audit" ADD CONSTRAINT "rapports_avant_audit_statut_check"
      CHECK ("statut" IN ('en_attente', 'en_cours', 'termine', 'erreur', 'annule'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rapports_avant_audit_progression_check') THEN
    ALTER TABLE "rapports_avant_audit" ADD CONSTRAINT "rapports_avant_audit_progression_check"
      CHECK ("progression" BETWEEN 0 AND 100);
  END IF;
END $$;
