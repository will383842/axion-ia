-- Tour France IA (2026-10-27), PR-2a : le registre des demandes faites AVANT le rendez-vous en visio
-- (e-mail, ville, nom, téléphone). Nom, e-mail et téléphone y sont CHIFFRÉS par l'application.
-- ADDITIVE : une table neuve, aucune table existante modifiée (la clé étrangère vers `clients` ne
-- touche aucune colonne de `clients`), aucune ligne existante touchée, aucune énumération Postgres
-- (statuts en VARCHAR), aucune forme de job BullMQ : le worker ne lit pas cette table. Les deux
-- conteneurs (app, worker) peuvent donc tourner avant ou après cette migration sans erreur ; l'app
-- lit la table dans un `try` (rien n'est affiché si elle manque).
-- RÉ-EXÉCUTABLE : tout est gardé (IF NOT EXISTS, contrainte dans un bloc DO).
-- `lock_timeout` borné : la clé étrangère pose un verrou bref sur `clients` ; si une écriture le
-- tient, la migration échoue vite au lieu de bloquer la console.
-- Retour arrière (JAMAIS exécuté par défaut) :
--   DROP TABLE "tour_demandes";
SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS "tour_demandes" (
    "id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "email_hash" VARCHAR(64),
    "telephone_fin" VARCHAR(9),
    "ville_saisie" VARCHAR(80) NOT NULL,
    "ville_cle" VARCHAR(100) NOT NULL,
    "ville_nom" VARCHAR(100),
    "statut" VARCHAR(20) NOT NULL DEFAULT 'recue',
    "statut_change_le" TIMESTAMP(3),
    "statut_change_par_id" UUID,
    "compte" BOOLEAN NOT NULL DEFAULT false,
    "cle_comptage_personne" VARCHAR(170),
    "cle_comptage_domaine" VARCHAR(360),
    "cle_comptage_telephone" VARCHAR(120),
    "doublon_de_id" UUID,
    "rattachement" VARCHAR(20) NOT NULL DEFAULT 'a_verifier',
    "client_id" UUID,
    "fiches_proches" JSONB,
    "depuis" VARCHAR(60),
    "utm_source" VARCHAR(60),
    "utm_medium" VARCHAR(60),
    "utm_campaign" VARCHAR(60),
    "utm_content" VARCHAR(60),
    "ip_hash" VARCHAR(64),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tour_demandes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tour_demandes_cle_comptage_personne_key"
    ON "tour_demandes"("cle_comptage_personne");
CREATE UNIQUE INDEX IF NOT EXISTS "tour_demandes_cle_comptage_domaine_key"
    ON "tour_demandes"("cle_comptage_domaine");
CREATE UNIQUE INDEX IF NOT EXISTS "tour_demandes_cle_comptage_telephone_key"
    ON "tour_demandes"("cle_comptage_telephone");
CREATE INDEX IF NOT EXISTS "tour_demandes_ville_cle_compte_idx"
    ON "tour_demandes"("ville_cle", "compte");
CREATE INDEX IF NOT EXISTS "tour_demandes_email_hash_idx"
    ON "tour_demandes"("email_hash");
CREATE INDEX IF NOT EXISTS "tour_demandes_cree_le_idx"
    ON "tour_demandes"("cree_le");
CREATE INDEX IF NOT EXISTS "tour_demandes_client_id_idx"
    ON "tour_demandes"("client_id");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tour_demandes_client_id_fkey') THEN
        ALTER TABLE "tour_demandes"
            ADD CONSTRAINT "tour_demandes_client_id_fkey"
            FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Le réglage ne déborde pas sur les migrations suivantes de la même connexion.
RESET lock_timeout;
