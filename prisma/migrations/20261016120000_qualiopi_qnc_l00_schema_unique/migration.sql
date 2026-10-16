-- Chantier QNC (levée des 15 non-conformités Qualiopi), lot L00 — SCHÉMA UNIQUE.
-- ADDITIF uniquement : aucun DROP, aucun RENAME, aucune reprise de données.
--
-- ## Ce que pose cette migration
--
--   1. `est_test_interne` sur `training_sessions` et `enrollments` (convention
--      ADR 0061 : booléen, défaut false) — le banc d'essai des interrupteurs
--      `qualiopi.<lot>.actif` en position `essai` ;
--   2. `training_sessions.projet_id` → `projets` (SET NULL : la purge du pilote
--      supprime les projets de test). La clé est portée par `training_sessions` :
--      aucun objet SQL brut sur `projets` ni sur les tables du chantier visio ;
--   3. `incidents` : nature, déclarant, origine, auteur de la saisie ;
--   4. dix journaux en AJOUT SEUL : `incident_notes`, `reclamation_etapes`,
--      `remises_retours`, `moyens_pedagogiques_historique`,
--      `sessions_changements_modalite_lieu`, `relances_journal`,
--      `actions_amelioration` (AXI-AMC), `actions_amelioration_etapes`,
--      `questionnaire_versions` (+ `questionnaires.version_id`),
--      `espace_stagiaire_ouvertures` (patron ADR 0063 : ni IP, ni navigateur) ;
--   5. en SQL brut, invisible à `migrate diff`, déclaré dans
--      `src/server/qualiopi/socle/objets-sql.ts` et confronté à la base en Gate D :
--        - 6 CHECK (motifs ≥ 10 caractères, retour → remise, rang ≥ 1,
--          version ≥ 1, empreinte SHA-256) ;
--        - 20 triggers « ajout seul » (UPDATE/DELETE ligne à ligne, TRUNCATE)
--          sur les dix journaux, fonction `qualiopi_ajout_seul` ;
--        - 3 triggers posés ÉTEINTS, qui ne refusent que si leur interrupteur
--          (table `settings`, valeur `{"etat":"actif"}`) est allumé :
--          `veilles_ajout_seul`, `veilles_pas_de_truncate`
--          (clé `qualiopi.veille.actif`) et
--          `revues_direction_plan_actions_lecture_seule`
--          (clé `qualiopi.amelioration.actif`). Clé absente = éteint : la
--          console de veille et la revue de direction fonctionnent comme avant.
--
-- Aucune valeur n'est AJOUTÉE à une énumération existante : les dix
-- énumérations sont neuves, donc utilisables dans la même transaction (pas de
-- migration séparée à poser avant celle-ci).
--
-- ## Fenêtre app/worker (~50 min)
--
-- Rien ne lit ni n'écrit ces colonnes et tables dans ce lot. L'application N-1
-- sur base migrée : colonnes nullables ou à défaut, tables vides, triggers
-- éteints — elle écrit exactement ce qu'elle écrivait.
--
-- ⚠️ Pas de `lock_timeout` (même raisonnement que 20260930120000) : une
-- migration inscrite `failed` bloquerait les suivantes (P3009). Les ADD COLUMN
-- à défaut constant ne réécrivent pas la table (PostgreSQL ≥ 11).
--
-- ## Réversible (détruit des pièces d'audit : en connaissance de cause)
--
--   DROP TRIGGER … (les 23 triggers listés dans objets-sql.ts) ;
--   DROP FUNCTION "qualiopi_ajout_seul"(), "qualiopi_veille_ajout_seul"(),
--     "qualiopi_plan_actions_lecture_seule"(), "qualiopi_interrupteur_etat"(text) ;
--   DROP TABLE des dix journaux ; ALTER TABLE … DROP COLUMN des colonnes
--   ajoutées ; DROP TYPE des dix énumérations.

-- ═══ 1. Ce que Prisma exprime ════════════════════════════════════════════════

-- CreateEnum
CREATE TYPE "incident_nature" AS ENUM ('alea', 'dysfonctionnement', 'difficulte');

-- CreateEnum
CREATE TYPE "partie_prenante_qualiopi" AS ENUM ('stagiaire', 'entreprise', 'formateur', 'financeur', 'organisme');

-- CreateEnum
CREATE TYPE "incident_origine" AS ENUM ('console', 'espace_stagiaire', 'espace_formateur', 'email', 'telephone', 'questionnaire', 'detection_automatique');

-- CreateEnum
CREATE TYPE "etape_reclamation" AS ENUM ('reception', 'accuse', 'analyse', 'reponse', 'reexamen', 'cloture');

-- CreateEnum
CREATE TYPE "destinataire_remise" AS ENUM ('stagiaire', 'entreprise', 'formateur', 'financeur');

-- CreateEnum
CREATE TYPE "canal_remise" AS ENUM ('espace', 'email', 'papier', 'autre');

-- CreateEnum
CREATE TYPE "nature_remise_retour" AS ENUM ('remise', 'ouverture', 'telechargement', 'signature', 'reponse');

-- CreateEnum
CREATE TYPE "changement_session_nature" AS ENUM ('modalite', 'lieu');

-- CreateEnum
CREATE TYPE "origine_amelioration" AS ENUM ('reclamation', 'incident', 'appreciation', 'revue_direction', 'veille', 'audit', 'autre');

-- CreateEnum
CREATE TYPE "etape_amelioration" AS ENUM ('mise_en_oeuvre', 'realisee', 'efficacite_verifiee', 'abandonnee', 'note');

-- AlterTable
ALTER TABLE "training_sessions" ADD COLUMN     "est_test_interne" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "projet_id" UUID;

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "est_test_interne" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "questionnaires" ADD COLUMN     "version_id" UUID;

-- AlterTable
ALTER TABLE "incidents" ADD COLUMN     "declarant" "partie_prenante_qualiopi",
ADD COLUMN     "declare_par_id" UUID,
ADD COLUMN     "nature" "incident_nature",
ADD COLUMN     "origine" "incident_origine";

-- CreateTable
CREATE TABLE "incident_notes" (
    "id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "texte" TEXT NOT NULL,
    "auteur_id" UUID,
    "auteur_nom" VARCHAR(200) NOT NULL,
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reclamation_etapes" (
    "id" UUID NOT NULL,
    "reclamation_id" UUID NOT NULL,
    "etape" "etape_reclamation" NOT NULL,
    "contenu" TEXT NOT NULL DEFAULT '',
    "auteur_id" UUID,
    "auteur_nom" VARCHAR(200) NOT NULL,
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reclamation_etapes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remises_retours" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "enrollment_id" UUID,
    "nature" "nature_remise_retour" NOT NULL,
    "remise_id" UUID,
    "destinataire" "destinataire_remise" NOT NULL,
    "canal" "canal_remise" NOT NULL,
    "objet" VARCHAR(80) NOT NULL,
    "libelle" VARCHAR(300) NOT NULL DEFAULT '',
    "document_genere_id" UUID,
    "email_log_id" UUID,
    "auteur_id" UUID,
    "survenu_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "remises_retours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moyens_pedagogiques_historique" (
    "id" UUID NOT NULL,
    "moyen_id" UUID NOT NULL,
    "avant" JSONB NOT NULL,
    "apres" JSONB NOT NULL,
    "motif" TEXT NOT NULL,
    "auteur_id" UUID,
    "auteur_nom" VARCHAR(200) NOT NULL,
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moyens_pedagogiques_historique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions_changements_modalite_lieu" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "nature" "changement_session_nature" NOT NULL,
    "avant" JSONB NOT NULL,
    "apres" JSONB NOT NULL,
    "motif" TEXT NOT NULL,
    "auteur_id" UUID,
    "auteur_nom" VARCHAR(200) NOT NULL,
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_changements_modalite_lieu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relances_journal" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "enrollment_id" UUID,
    "objet" VARCHAR(80) NOT NULL,
    "destinataire" "destinataire_remise" NOT NULL,
    "canal" "canal_remise" NOT NULL,
    "rang" SMALLINT NOT NULL,
    "automatique" BOOLEAN NOT NULL DEFAULT false,
    "email_log_id" UUID,
    "auteur_id" UUID,
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relances_journal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actions_amelioration" (
    "id" UUID NOT NULL,
    "numero" VARCHAR(40) NOT NULL,
    "origine" "origine_amelioration" NOT NULL,
    "origine_ref_id" UUID,
    "constat" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "auteur_id" UUID,
    "auteur_nom" VARCHAR(200) NOT NULL,
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "actions_amelioration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actions_amelioration_etapes" (
    "id" UUID NOT NULL,
    "action_id" UUID NOT NULL,
    "etape" "etape_amelioration" NOT NULL,
    "commentaire" TEXT NOT NULL DEFAULT '',
    "auteur_id" UUID,
    "auteur_nom" VARCHAR(200) NOT NULL,
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "actions_amelioration_etapes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questionnaire_versions" (
    "id" UUID NOT NULL,
    "type" "QuestionnaireType" NOT NULL,
    "version" SMALLINT NOT NULL,
    "contenu" JSONB NOT NULL,
    "empreinte" CHAR(64) NOT NULL,
    "auteur_id" UUID,
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questionnaire_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "espace_stagiaire_ouvertures" (
    "id" UUID NOT NULL,
    "trainee_id" UUID NOT NULL,
    "enrollment_id" UUID,
    "origine" "origine_ouverture_document" NOT NULL,
    "ouvert_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "espace_stagiaire_ouvertures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "incident_notes_incident_id_cree_le_idx" ON "incident_notes"("incident_id", "cree_le");

-- CreateIndex
CREATE INDEX "reclamation_etapes_reclamation_id_cree_le_idx" ON "reclamation_etapes"("reclamation_id", "cree_le");

-- CreateIndex
CREATE INDEX "remises_retours_session_id_survenu_le_idx" ON "remises_retours"("session_id", "survenu_le");

-- CreateIndex
CREATE INDEX "remises_retours_enrollment_id_idx" ON "remises_retours"("enrollment_id");

-- CreateIndex
CREATE INDEX "remises_retours_remise_id_idx" ON "remises_retours"("remise_id");

-- CreateIndex
CREATE INDEX "moyens_pedagogiques_historique_moyen_id_cree_le_idx" ON "moyens_pedagogiques_historique"("moyen_id", "cree_le");

-- CreateIndex
CREATE INDEX "sessions_changements_modalite_lieu_session_id_cree_le_idx" ON "sessions_changements_modalite_lieu"("session_id", "cree_le");

-- CreateIndex
CREATE INDEX "relances_journal_session_id_cree_le_idx" ON "relances_journal"("session_id", "cree_le");

-- CreateIndex
CREATE INDEX "relances_journal_enrollment_id_idx" ON "relances_journal"("enrollment_id");

-- CreateIndex
CREATE UNIQUE INDEX "actions_amelioration_numero_key" ON "actions_amelioration"("numero");

-- CreateIndex
CREATE INDEX "actions_amelioration_origine_origine_ref_id_idx" ON "actions_amelioration"("origine", "origine_ref_id");

-- CreateIndex
CREATE INDEX "actions_amelioration_cree_le_idx" ON "actions_amelioration"("cree_le");

-- CreateIndex
CREATE INDEX "actions_amelioration_etapes_action_id_cree_le_idx" ON "actions_amelioration_etapes"("action_id", "cree_le");

-- CreateIndex
CREATE UNIQUE INDEX "questionnaire_versions_type_version_key" ON "questionnaire_versions"("type", "version");

-- CreateIndex
CREATE INDEX "espace_stagiaire_ouvertures_trainee_id_ouvert_le_idx" ON "espace_stagiaire_ouvertures"("trainee_id", "ouvert_le");

-- CreateIndex
CREATE INDEX "training_sessions_projet_id_idx" ON "training_sessions"("projet_id");

-- CreateIndex
CREATE INDEX "questionnaires_version_id_idx" ON "questionnaires"("version_id");

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_projet_id_fkey" FOREIGN KEY ("projet_id") REFERENCES "projets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionnaires" ADD CONSTRAINT "questionnaires_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "questionnaire_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_notes" ADD CONSTRAINT "incident_notes_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamation_etapes" ADD CONSTRAINT "reclamation_etapes_reclamation_id_fkey" FOREIGN KEY ("reclamation_id") REFERENCES "reclamations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remises_retours" ADD CONSTRAINT "remises_retours_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "training_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remises_retours" ADD CONSTRAINT "remises_retours_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remises_retours" ADD CONSTRAINT "remises_retours_remise_id_fkey" FOREIGN KEY ("remise_id") REFERENCES "remises_retours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moyens_pedagogiques_historique" ADD CONSTRAINT "moyens_pedagogiques_historique_moyen_id_fkey" FOREIGN KEY ("moyen_id") REFERENCES "moyens_pedagogiques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions_changements_modalite_lieu" ADD CONSTRAINT "sessions_changements_modalite_lieu_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "training_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relances_journal" ADD CONSTRAINT "relances_journal_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "training_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relances_journal" ADD CONSTRAINT "relances_journal_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions_amelioration_etapes" ADD CONSTRAINT "actions_amelioration_etapes_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions_amelioration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ═══ 2. SQL BRUT — CHECK (déclarés dans objets-sql.ts) ════════════════════════

-- Un motif illisible ne vaut rien devant un auditeur (même seuil que ADR 0060).
ALTER TABLE "moyens_pedagogiques_historique" ADD CONSTRAINT "moyens_pedagogiques_historique_motif" CHECK (char_length(btrim("motif")) >= 10);
ALTER TABLE "sessions_changements_modalite_lieu" ADD CONSTRAINT "sessions_changements_modalite_lieu_motif" CHECK (char_length(btrim("motif")) >= 10);

-- Une remise ne vise rien ; un retour (ouverture, téléchargement, signature,
-- réponse) vise toujours sa remise.
ALTER TABLE "remises_retours" ADD CONSTRAINT "remises_retours_retour_vise_une_remise" CHECK (("nature" = 'remise') = ("remise_id" IS NULL));

ALTER TABLE "relances_journal" ADD CONSTRAINT "relances_journal_rang_positif" CHECK ("rang" >= 1);
ALTER TABLE "questionnaire_versions" ADD CONSTRAINT "questionnaire_versions_version_positive" CHECK ("version" >= 1);
ALTER TABLE "questionnaire_versions" ADD CONSTRAINT "questionnaire_versions_empreinte_sha256" CHECK ("empreinte" ~ '^[0-9a-f]{64}$');

-- ═══ 3. SQL BRUT — AJOUT SEUL (déclarés dans objets-sql.ts) ═══════════════════

-- Une seule fonction pour les dix journaux : le message nomme la table.
CREATE FUNCTION "qualiopi_ajout_seul"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% est en ajout seul : % refusé (chantier QNC, L00)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END
$$;

CREATE TRIGGER "incident_notes_ajout_seul" BEFORE UPDATE OR DELETE ON "incident_notes"
  FOR EACH ROW EXECUTE FUNCTION "qualiopi_ajout_seul"();
CREATE TRIGGER "incident_notes_pas_de_truncate" BEFORE TRUNCATE ON "incident_notes"
  FOR EACH STATEMENT EXECUTE FUNCTION "qualiopi_ajout_seul"();

CREATE TRIGGER "reclamation_etapes_ajout_seul" BEFORE UPDATE OR DELETE ON "reclamation_etapes"
  FOR EACH ROW EXECUTE FUNCTION "qualiopi_ajout_seul"();
CREATE TRIGGER "reclamation_etapes_pas_de_truncate" BEFORE TRUNCATE ON "reclamation_etapes"
  FOR EACH STATEMENT EXECUTE FUNCTION "qualiopi_ajout_seul"();

CREATE TRIGGER "remises_retours_ajout_seul" BEFORE UPDATE OR DELETE ON "remises_retours"
  FOR EACH ROW EXECUTE FUNCTION "qualiopi_ajout_seul"();
CREATE TRIGGER "remises_retours_pas_de_truncate" BEFORE TRUNCATE ON "remises_retours"
  FOR EACH STATEMENT EXECUTE FUNCTION "qualiopi_ajout_seul"();

CREATE TRIGGER "moyens_pedagogiques_historique_ajout_seul" BEFORE UPDATE OR DELETE ON "moyens_pedagogiques_historique"
  FOR EACH ROW EXECUTE FUNCTION "qualiopi_ajout_seul"();
CREATE TRIGGER "moyens_pedagogiques_historique_pas_de_truncate" BEFORE TRUNCATE ON "moyens_pedagogiques_historique"
  FOR EACH STATEMENT EXECUTE FUNCTION "qualiopi_ajout_seul"();

CREATE TRIGGER "sessions_changements_modalite_lieu_ajout_seul" BEFORE UPDATE OR DELETE ON "sessions_changements_modalite_lieu"
  FOR EACH ROW EXECUTE FUNCTION "qualiopi_ajout_seul"();
CREATE TRIGGER "sessions_changements_modalite_lieu_pas_de_truncate" BEFORE TRUNCATE ON "sessions_changements_modalite_lieu"
  FOR EACH STATEMENT EXECUTE FUNCTION "qualiopi_ajout_seul"();

CREATE TRIGGER "relances_journal_ajout_seul" BEFORE UPDATE OR DELETE ON "relances_journal"
  FOR EACH ROW EXECUTE FUNCTION "qualiopi_ajout_seul"();
CREATE TRIGGER "relances_journal_pas_de_truncate" BEFORE TRUNCATE ON "relances_journal"
  FOR EACH STATEMENT EXECUTE FUNCTION "qualiopi_ajout_seul"();

CREATE TRIGGER "actions_amelioration_ajout_seul" BEFORE UPDATE OR DELETE ON "actions_amelioration"
  FOR EACH ROW EXECUTE FUNCTION "qualiopi_ajout_seul"();
CREATE TRIGGER "actions_amelioration_pas_de_truncate" BEFORE TRUNCATE ON "actions_amelioration"
  FOR EACH STATEMENT EXECUTE FUNCTION "qualiopi_ajout_seul"();

CREATE TRIGGER "actions_amelioration_etapes_ajout_seul" BEFORE UPDATE OR DELETE ON "actions_amelioration_etapes"
  FOR EACH ROW EXECUTE FUNCTION "qualiopi_ajout_seul"();
CREATE TRIGGER "actions_amelioration_etapes_pas_de_truncate" BEFORE TRUNCATE ON "actions_amelioration_etapes"
  FOR EACH STATEMENT EXECUTE FUNCTION "qualiopi_ajout_seul"();

CREATE TRIGGER "questionnaire_versions_ajout_seul" BEFORE UPDATE OR DELETE ON "questionnaire_versions"
  FOR EACH ROW EXECUTE FUNCTION "qualiopi_ajout_seul"();
CREATE TRIGGER "questionnaire_versions_pas_de_truncate" BEFORE TRUNCATE ON "questionnaire_versions"
  FOR EACH STATEMENT EXECUTE FUNCTION "qualiopi_ajout_seul"();

CREATE TRIGGER "espace_stagiaire_ouvertures_ajout_seul" BEFORE UPDATE OR DELETE ON "espace_stagiaire_ouvertures"
  FOR EACH ROW EXECUTE FUNCTION "qualiopi_ajout_seul"();
CREATE TRIGGER "espace_stagiaire_ouvertures_pas_de_truncate" BEFORE TRUNCATE ON "espace_stagiaire_ouvertures"
  FOR EACH STATEMENT EXECUTE FUNCTION "qualiopi_ajout_seul"();

-- ═══ 4. SQL BRUT — TRIGGERS POSÉS ÉTEINTS (déclarés dans objets-sql.ts) ════════

-- L'état d'un interrupteur `qualiopi.<lot>.actif`, lu dans `settings` comme le
-- lit `src/server/qualiopi/socle/interrupteurs.ts` : `{"etat": "eteint" |
-- "essai" | "actif"}`. Clé absente, valeur inconnue ou mal formée : `eteint`.
CREATE FUNCTION "qualiopi_interrupteur_etat"(cle text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE s."value"->>'etat' WHEN 'actif' THEN 'actif' WHEN 'essai' THEN 'essai' ELSE 'eteint' END
  FROM (SELECT 1) AS un LEFT JOIN "settings" s ON s."key" = cle
$$;

-- La veille : la console la modifie et la supprime aujourd'hui. Le trigger ne
-- refuse qu'une fois `qualiopi.veille.actif` à `actif` — posé par le lot qui
-- remplace ces gestes par l'archivage. `essai` n'y change rien : la veille n'a
-- pas de session, donc pas de banc d'essai.
CREATE FUNCTION "qualiopi_veille_ajout_seul"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF "qualiopi_interrupteur_etat"('qualiopi.veille.actif') = 'actif' THEN
    RAISE EXCEPTION 'veilles est en ajout seul : % refusé (qualiopi.veille.actif)', TG_OP
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF TG_LEVEL = 'STATEMENT' THEN RETURN NULL; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "veilles_ajout_seul" BEFORE UPDATE OR DELETE ON "veilles"
  FOR EACH ROW EXECUTE FUNCTION "qualiopi_veille_ajout_seul"();
CREATE TRIGGER "veilles_pas_de_truncate" BEFORE TRUNCATE ON "veilles"
  FOR EACH STATEMENT EXECUTE FUNCTION "qualiopi_veille_ajout_seul"();

-- Le plan d'actions de la revue de direction passe en lecture seule pour
-- l'historique quand `qualiopi.amelioration.actif` vaut `actif` : le registre
-- `actions_amelioration` devient la SEULE source. Le reste de la revue reste
-- modifiable.
CREATE FUNCTION "qualiopi_plan_actions_lecture_seule"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."plan_actions" IS DISTINCT FROM OLD."plan_actions"
     AND "qualiopi_interrupteur_etat"('qualiopi.amelioration.actif') = 'actif' THEN
    RAISE EXCEPTION 'revues_direction.plan_actions est en lecture seule : les actions d''amélioration vivent dans actions_amelioration (qualiopi.amelioration.actif)'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "revues_direction_plan_actions_lecture_seule" BEFORE UPDATE OF "plan_actions" ON "revues_direction"
  FOR EACH ROW EXECUTE FUNCTION "qualiopi_plan_actions_lecture_seule"();
