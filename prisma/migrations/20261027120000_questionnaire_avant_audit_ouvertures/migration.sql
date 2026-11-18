-- Questionnaire avant audit (2026-10-27) : les OUVERTURES du lien (quand, combien de fois, jusqu'où),
-- notées par la page elle-même après son chargement réel (pas au rendu serveur), sous l'interrupteur
-- `QUESTIONNAIRE_SUIVI_OUVERTURES_ENABLED`. Aucune IP, aucun cookie, aucun navigateur gardé.
-- ADDITIVE : une table neuve, aucune table existante touchée, aucune ligne existante modifiée,
-- aucune énumération Postgres (VARCHAR), aucune forme de job BullMQ (le worker ne lit pas cette
-- table). RÉ-EXÉCUTABLE : tout est gardé (IF NOT EXISTS, contrainte dans un bloc DO).
-- `lock_timeout` borné : la clé étrangère pose un verrou bref sur `questionnaires_avant_audit` ;
-- si une écriture le tient, la migration échoue vite au lieu de bloquer la page publique.
-- Retour arrière (JAMAIS exécuté par défaut) :
--   DROP TABLE "questionnaires_avant_audit_ouvertures";
SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS "questionnaires_avant_audit_ouvertures" (
    "id" UUID NOT NULL,
    "questionnaire_id" UUID NOT NULL,
    "mode" VARCHAR(8) NOT NULL,
    "membre" VARCHAR(60) NOT NULL DEFAULT '',
    "premiere_ouverture" TIMESTAMP(3) NOT NULL,
    "derniere_ouverture" TIMESTAMP(3) NOT NULL,
    "nombre" INTEGER NOT NULL DEFAULT 1,
    "derniere_etape_atteinte" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "questionnaires_avant_audit_ouvertures_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "questionnaires_avant_audit_ouvertures_personne_key"
    ON "questionnaires_avant_audit_ouvertures"("questionnaire_id", "mode", "membre");
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questionnaires_avant_audit_ouvertures_questionnaire_id_fkey') THEN
        ALTER TABLE "questionnaires_avant_audit_ouvertures"
            ADD CONSTRAINT "questionnaires_avant_audit_ouvertures_questionnaire_id_fkey"
            FOREIGN KEY ("questionnaire_id") REFERENCES "questionnaires_avant_audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Le réglage ne déborde pas sur les migrations suivantes de la même connexion.
RESET lock_timeout;
