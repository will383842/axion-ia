-- Fiche client en 7 onglets, étapes 3 et 4 (2026-10-26, décisions de Will) :
--   (1) projet_suivis : ce que le client a PRIS (type de prestation, étape forcée, montant) ;
--   (2) client_factures_hors_console : « Facture établie hors console (date) » -> prospect devient client.
-- ADDITIVE : DEUX tables NEUVES, 1-1 avec "projets" et "clients" (ADR 0053 : aucune colonne ajoutée
-- à une table existante). Aucune donnée existante touchée, aucune énumération, aucune forme de job
-- BullMQ changée. RÉ-EXÉCUTABLE : IF NOT EXISTS partout, contraintes gardées dans un bloc DO.
-- Migration livrée SEULE, AVANT le code qui l'écrit (deux conteneurs app/worker : aucun code ne
-- lit ni n'écrit ces tables dans cette PR).
-- Clés étrangères en RESTRICT : supprimer une fiche ou un projet est un geste de Will, le bilan de
-- la suppression manuelle devra les compter (code, PR suivante).
-- Aucune donnée personnelle : un type, une étape, un montant et une date d'entreprise
-- (`rgpd: technique` dans le schéma).
-- Retour arrière (JAMAIS exécuté par défaut) :
--   DROP TABLE "client_factures_hors_console";
--   DROP TABLE "projet_suivis";
CREATE TABLE IF NOT EXISTS "projet_suivis" (
    "projet_id" UUID NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "etape_forcee" VARCHAR(30),
    "montant_cents" INTEGER,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maj_le" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projet_suivis_pkey" PRIMARY KEY ("projet_id")
);

CREATE INDEX IF NOT EXISTS "projet_suivis_type_idx" ON "projet_suivis"("type");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projet_suivis_projet_id_fkey') THEN
    ALTER TABLE "projet_suivis"
      ADD CONSTRAINT "projet_suivis_projet_id_fkey"
      FOREIGN KEY ("projet_id") REFERENCES "projets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "client_factures_hors_console" (
    "client_id" UUID NOT NULL,
    "etabli_le" DATE NOT NULL,
    "par_admin_id" UUID,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_factures_hors_console_pkey" PRIMARY KEY ("client_id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_factures_hors_console_client_id_fkey') THEN
    ALTER TABLE "client_factures_hors_console"
      ADD CONSTRAINT "client_factures_hors_console_client_id_fkey"
      FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
