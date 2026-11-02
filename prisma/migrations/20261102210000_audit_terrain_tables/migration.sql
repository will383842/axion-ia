-- AUDIT PRÉSENTIEL, PR1 (2026-11-02) — trois tables neuves `audit_terrain_*`.
-- STRICTEMENT ADDITIF : aucune énumération Postgres (statuts en VARCHAR, validés par zod),
-- aucune colonne ajoutée à `clients` ni à `audit_missions`, aucun DROP/UPDATE/DELETE.
-- Compatible avec les DEUX conteneurs : l'ancien code (app ou worker) ignore ces tables.
-- Clés étrangères en RESTRICT : jamais de suppression par ricochet.
-- Contenu sensible (`donnees_chiffrees`, `contenu_chiffre`) : chiffré par `chiffrerParole`.
-- Journal en AJOUT SEUL imposé par la base (triggers en fin de fichier) : aucun UPDATE/DELETE/TRUNCATE
-- sur les événements ; sur les rapports, seuls statut / valide_par_id / valide_le peuvent changer.
-- Retour arrière : voir `rollback.sql` (hors migration, jamais joué par migrate deploy ;
-- seulement sur des tables VIDES — après le jour J on révoque le jeton, on ne supprime pas).

-- CreateTable
CREATE TABLE "audit_terrain_sessions" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "audit_mission_id" UUID,
    "statut" VARCHAR(20) NOT NULL DEFAULT 'ouverte',
    "jeton_empreinte" CHAR(64) NOT NULL,
    "jeton_expire_le" TIMESTAMPTZ(3) NOT NULL,
    "jeton_revoque_le" TIMESTAMPTZ(3),
    "cree_par_id" UUID NOT NULL,
    "dernier_seq" INTEGER NOT NULL DEFAULT 0,
    "derniere_etape_index" INTEGER NOT NULL DEFAULT 0,
    "dernier_envoi_le" TIMESTAMPTZ(3),
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_terrain_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_terrain_evenements" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "etape" VARCHAR(40),
    "etape_index" INTEGER,
    "heure_pc" TIMESTAMPTZ(3) NOT NULL,
    "recu_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "empreinte" CHAR(64) NOT NULL,
    "donnees_chiffrees" TEXT NOT NULL,

    CONSTRAINT "audit_terrain_evenements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_terrain_rapports" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "source" VARCHAR(20) NOT NULL,
    "event_id" UUID NOT NULL,
    "contenu_chiffre" TEXT NOT NULL,
    "statut" VARCHAR(20) NOT NULL DEFAULT 'a_relire',
    "valide_par_id" UUID,
    "valide_le" TIMESTAMPTZ(3),
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_terrain_rapports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "audit_terrain_sessions_jeton_empreinte_key" ON "audit_terrain_sessions"("jeton_empreinte");

-- CreateIndex
CREATE INDEX "audit_terrain_sessions_client_id_cree_le_idx" ON "audit_terrain_sessions"("client_id", "cree_le");

-- CreateIndex
CREATE INDEX "audit_terrain_sessions_audit_mission_id_idx" ON "audit_terrain_sessions"("audit_mission_id");

-- CreateIndex
CREATE INDEX "audit_terrain_evenements_session_id_seq_idx" ON "audit_terrain_evenements"("session_id", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "audit_terrain_evenements_session_id_event_id_key" ON "audit_terrain_evenements"("session_id", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_terrain_rapports_event_id_key" ON "audit_terrain_rapports"("event_id");

-- CreateIndex
CREATE INDEX "audit_terrain_rapports_valide_par_id_idx" ON "audit_terrain_rapports"("valide_par_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_terrain_rapports_session_id_version_key" ON "audit_terrain_rapports"("session_id", "version");

-- AddForeignKey
ALTER TABLE "audit_terrain_sessions" ADD CONSTRAINT "audit_terrain_sessions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_terrain_sessions" ADD CONSTRAINT "audit_terrain_sessions_audit_mission_id_fkey" FOREIGN KEY ("audit_mission_id") REFERENCES "audit_missions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_terrain_sessions" ADD CONSTRAINT "audit_terrain_sessions_cree_par_id_fkey" FOREIGN KEY ("cree_par_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_terrain_evenements" ADD CONSTRAINT "audit_terrain_evenements_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "audit_terrain_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_terrain_rapports" ADD CONSTRAINT "audit_terrain_rapports_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "audit_terrain_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_terrain_rapports" ADD CONSTRAINT "audit_terrain_rapports_valide_par_id_fkey" FOREIGN KEY ("valide_par_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ═══ Triggers : journal en ajout seul (objets de la base, invisibles pour Prisma) ═══
-- Les clés étrangères RESTRICT ne déclenchent pas ces triggers (ils portent sur les tables enfants) ;
-- DROP TABLE (retour arrière à vide) ne les déclenche pas non plus.

CREATE FUNCTION "audit_terrain_ajout_seul"() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION '% est un journal en ajout seul : % interdit', TG_TABLE_NAME, TG_OP;
END
$fn$;

CREATE FUNCTION "audit_terrain_rapports_garde"() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'audit_terrain_rapports : suppression interdite';
  END IF;
  IF (NEW."id", NEW."session_id", NEW."version", NEW."source", NEW."event_id", NEW."contenu_chiffre", NEW."cree_le")
     IS DISTINCT FROM
     (OLD."id", OLD."session_id", OLD."version", OLD."source", OLD."event_id", OLD."contenu_chiffre", OLD."cree_le") THEN
    RAISE EXCEPTION 'audit_terrain_rapports : seuls statut, valide_par_id et valide_le peuvent changer';
  END IF;
  RETURN NEW;
END
$fn$;

CREATE TRIGGER "audit_terrain_evenements_ajout_seul" BEFORE UPDATE OR DELETE ON "audit_terrain_evenements"
  FOR EACH ROW EXECUTE FUNCTION "audit_terrain_ajout_seul"();
CREATE TRIGGER "audit_terrain_evenements_pas_de_truncate" BEFORE TRUNCATE ON "audit_terrain_evenements"
  FOR EACH STATEMENT EXECUTE FUNCTION "audit_terrain_ajout_seul"();
CREATE TRIGGER "audit_terrain_rapports_garde" BEFORE UPDATE OR DELETE ON "audit_terrain_rapports"
  FOR EACH ROW EXECUTE FUNCTION "audit_terrain_rapports_garde"();
CREATE TRIGGER "audit_terrain_rapports_pas_de_truncate" BEFORE TRUNCATE ON "audit_terrain_rapports"
  FOR EACH STATEMENT EXECUTE FUNCTION "audit_terrain_ajout_seul"();
