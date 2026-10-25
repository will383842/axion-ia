-- Synchro AUTOMATIQUE du dossier client console → CRM (2026-10-25, décision de Will), étape 4 :
-- l'état de la synchro, UNE ligne par client (version émise, empreinte du dernier dossier émis,
-- dernier changement vu du CRM).
-- ADDITIVE : une table nouvelle, une clé étrangère CASCADE vers "clients" (supprimer une fiche
-- supprime son état de synchro). Aucune colonne sur "clients" (ADR 0053), aucune énumération,
-- aucune donnée existante touchée, aucune forme de job BullMQ changée. Aucune donnée personnelle.
-- RÉ-EXÉCUTABLE : IF NOT EXISTS partout, contrainte gardée dans un bloc DO.
-- Migration livrée SEULE, AVANT le code qui l'écrit (deux conteneurs app/worker : le worker peut
-- tourner du code sans la table ; aucun code ne la lit ou l'écrit dans cette PR).
-- Retour arrière (JAMAIS exécuté par défaut) :
--   DROP TABLE "crm_dossier_synchro";
CREATE TABLE IF NOT EXISTS "crm_dossier_synchro" (
    "client_id"     UUID NOT NULL,
    "version"       INTEGER NOT NULL DEFAULT 0,
    "empreinte"     VARCHAR(64),
    "emis_le"       TIMESTAMPTZ(3),
    "crm_vu_le"     TIMESTAMPTZ(3),
    "crm_empreinte" VARCHAR(64),
    "created_at"    TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "crm_dossier_synchro_pkey" PRIMARY KEY ("client_id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_dossier_synchro_client_id_fkey') THEN
    ALTER TABLE "crm_dossier_synchro"
      ADD CONSTRAINT "crm_dossier_synchro_client_id_fkey"
      FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
