-- Pilotage SEO & GEO, P10 : passages quotidiens des robots d'IA (agrégats Cloudflare).
-- UNE table NOUVELLE, sans clé étrangère, sans énumération Postgres. Ajout seul et rejouable
-- (IF NOT EXISTS) : aucun UPDATE, DELETE, DROP ni ALTER. Ni adresse IP ni user-agent brut.

CREATE TABLE IF NOT EXISTS "robot_ia_jours" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "robot" VARCHAR(40) NOT NULL,
    "famille" VARCHAR(20) NOT NULL,
    "famille_chemin" VARCHAR(40) NOT NULL,
    "nombre" INTEGER NOT NULL DEFAULT 0,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "robot_ia_jours_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "robot_ia_jours_cle_key" ON "robot_ia_jours"("date", "robot", "famille_chemin");
CREATE INDEX IF NOT EXISTS "robot_ia_jours_robot_date_idx" ON "robot_ia_jours"("robot", "date");
