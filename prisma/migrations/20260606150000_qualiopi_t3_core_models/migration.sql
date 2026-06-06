-- T3 Qualiopi — modèles cœur (Formation, Session, Trainer, Trainee, Enrollment,
-- FormationTransition). Migration ADDITIVE uniquement (nouvelles tables + enums
-- + index + FK). Aucune modification des tables existantes.

-- CreateEnum
CREATE TYPE "FormationStatutGeneration" AS ENUM ('intention', 'structure_generee', 'contenu_evalue', 'structure_validee', 'contenu_genere', 'contenu_valide', 'assemble', 'publie', 'archive');

-- CreateEnum
CREATE TYPE "FormationStatut" AS ENUM ('actif', 'publie', 'archive');

-- CreateEnum
CREATE TYPE "TrainingSessionStatut" AS ENUM ('planifiee', 'en_cours', 'realisee', 'annulee', 'reportee');

-- CreateEnum
CREATE TYPE "EnrollmentStatut" AS ENUM ('planifiee', 'presente', 'abandon', 'exclu');

-- CreateEnum
CREATE TYPE "TypeActionQualiopi" AS ENUM ('classique', 'certifiante', 'foad', 'alternance_afest', 'sous_traitance', 'cpf', 'opco', 'france_travail', 'handicap');

-- CreateEnum
CREATE TYPE "TrainerStatut" AS ENUM ('salarie', 'sous_traitant');

-- CreateEnum
CREATE TYPE "ModaliteFormation" AS ENUM ('presentiel', 'distanciel', 'hybride');

-- CreateEnum
CREATE TYPE "CertificationType" AS ENUM ('aucune', 'rs', 'rncp');

-- CreateEnum
CREATE TYPE "FinancementType" AS ENUM ('direct', 'opco', 'cpf', 'france_travail', 'mixte');

-- CreateEnum
CREATE TYPE "OpcoStatut" AS ENUM ('non_demande', 'demande_en_cours', 'accord_recu', 'refuse', 'paiement_recu');

-- CreateTable
CREATE TABLE "formations" (
    "id" UUID NOT NULL,
    "numero" VARCHAR(40) NOT NULL,
    "titre" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "offre_site_id" UUID NOT NULL,
    "client_id" UUID,
    "est_sur_mesure" BOOLEAN NOT NULL DEFAULT false,
    "duree_heures" INTEGER NOT NULL,
    "modalite" "ModaliteFormation" NOT NULL DEFAULT 'presentiel',
    "objectifs_pedagogiques" JSONB NOT NULL DEFAULT '[]',
    "programme_detaille" JSONB NOT NULL DEFAULT '[]',
    "methodes_pedagogiques" TEXT NOT NULL DEFAULT '',
    "seuil_reussite_pct" INTEGER NOT NULL DEFAULT 70,
    "ratio_pratique_pct" INTEGER,
    "accessible_handicap" BOOLEAN NOT NULL DEFAULT false,
    "certification_type" "CertificationType" NOT NULL DEFAULT 'aucune',
    "code_cpf" VARCHAR(20),
    "edof_verifie_at" TIMESTAMP(3),
    "edof_verifie_par" UUID,
    "statut_generation" "FormationStatutGeneration" NOT NULL DEFAULT 'intention',
    "statut" "FormationStatut" NOT NULL DEFAULT 'actif',
    "version_programme" TEXT NOT NULL DEFAULT '1.0',
    "version_historique" JSONB NOT NULL DEFAULT '[]',
    "langue_generation" TEXT NOT NULL DEFAULT 'fr',
    "types_action_qualiopi" "TypeActionQualiopi"[] DEFAULT ARRAY[]::"TypeActionQualiopi"[],
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "ai_model" VARCHAR(80),
    "ai_prompt_version" INTEGER,
    "validated_by" UUID,
    "validated_at" TIMESTAMP(3),
    "tarif_ht_cents" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "formations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_sessions" (
    "id" UUID NOT NULL,
    "numero" VARCHAR(40) NOT NULL,
    "titre_session" VARCHAR(300) NOT NULL,
    "formation_id" UUID NOT NULL,
    "date_debut" TIMESTAMP(3) NOT NULL,
    "date_fin" TIMESTAMP(3) NOT NULL,
    "duree_reelle_heures" INTEGER,
    "modalite" "ModaliteFormation" NOT NULL,
    "ical_uid" VARCHAR(255),
    "client_id" UUID,
    "devis_id" UUID,
    "financement_type" "FinancementType",
    "montant_ht_cents" INTEGER NOT NULL,
    "opco_statut" "OpcoStatut" NOT NULL DEFAULT 'non_demande',
    "opco_subrogation" BOOLEAN NOT NULL DEFAULT false,
    "convention_tripartite_signee_at" TIMESTAMP(3),
    "edof_verifie_at" TIMESTAMP(3),
    "ft_poei_offre_emploi_numero" VARCHAR(50),
    "ft_poei_accord_financement_at" TIMESTAMP(3),
    "ft_poei_engagement_signe_at" TIMESTAMP(3),
    "ft_aif_prescription_date" TIMESTAMP(3),
    "nb_participants_prevus" INTEGER NOT NULL,
    "nb_participants_reels" INTEGER,
    "co_formateurs" JSONB NOT NULL DEFAULT '[]',
    "session_parent_id" UUID,
    "session_reportee_id" UUID,
    "statut" "TrainingSessionStatut" NOT NULL DEFAULT 'planifiee',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainers" (
    "id" UUID NOT NULL,
    "nom" VARCHAR(200) NOT NULL,
    "prenom" VARCHAR(200) NOT NULL,
    "email" CITEXT NOT NULL,
    "telephone" VARCHAR(40),
    "statut" "TrainerStatut" NOT NULL,
    "cv_url" TEXT,
    "cv_uploaded_at" TIMESTAMP(3),
    "domaines_competences" JSONB NOT NULL DEFAULT '[]',
    "formations_habilitees" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "date_embauche" TIMESTAMP(3),
    "tarif_journee_ht_cents" INTEGER,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trainers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainees" (
    "id" UUID NOT NULL,
    "nom" VARCHAR(200) NOT NULL,
    "prenom" VARCHAR(200) NOT NULL,
    "email" CITEXT NOT NULL,
    "telephone" VARCHAR(40),
    "entreprise" VARCHAR(250),
    "fonction" VARCHAR(200),
    "situation_handicap" BOOLEAN NOT NULL DEFAULT false,
    "handicap_details_chiffre" TEXT,
    "handicap_verifie_par" UUID,
    "handicap_verifie_at" TIMESTAMP(3),
    "consentement_formation" BOOLEAN NOT NULL DEFAULT false,
    "consentement_email" BOOLEAN NOT NULL DEFAULT false,
    "consentement_version" VARCHAR(20),
    "consentement_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trainees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "trainee_id" UUID NOT NULL,
    "statut" "EnrollmentStatut" NOT NULL DEFAULT 'planifiee',
    "taux_presence_pct" INTEGER,
    "emargement_signe_at" TIMESTAMP(3),
    "adaptations_realisees" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formation_transitions" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "from_status" "TrainingSessionStatut",
    "to_status" "TrainingSessionStatut" NOT NULL,
    "trigger" VARCHAR(80) NOT NULL,
    "triggered_by" "TransitionTriggeredBy" NOT NULL,
    "triggered_by_id" UUID,
    "reason" VARCHAR(500),
    "snapshot_before" JSONB,
    "snapshot_after" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "formation_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "formations_numero_key" ON "formations"("numero");
CREATE UNIQUE INDEX "formations_slug_key" ON "formations"("slug");
CREATE INDEX "formations_offre_site_id_idx" ON "formations"("offre_site_id");
CREATE INDEX "formations_client_id_idx" ON "formations"("client_id");
CREATE INDEX "formations_statut_idx" ON "formations"("statut");
CREATE INDEX "formations_statut_generation_idx" ON "formations"("statut_generation");
CREATE INDEX "formations_certification_type_idx" ON "formations"("certification_type");
CREATE UNIQUE INDEX "training_sessions_numero_key" ON "training_sessions"("numero");
CREATE INDEX "training_sessions_formation_id_idx" ON "training_sessions"("formation_id");
CREATE INDEX "training_sessions_client_id_idx" ON "training_sessions"("client_id");
CREATE INDEX "training_sessions_devis_id_idx" ON "training_sessions"("devis_id");
CREATE INDEX "training_sessions_statut_idx" ON "training_sessions"("statut");
CREATE INDEX "training_sessions_date_debut_idx" ON "training_sessions"("date_debut");
CREATE INDEX "training_sessions_session_parent_id_idx" ON "training_sessions"("session_parent_id");
CREATE INDEX "training_sessions_session_reportee_id_idx" ON "training_sessions"("session_reportee_id");
CREATE UNIQUE INDEX "trainers_email_key" ON "trainers"("email");
CREATE INDEX "trainers_statut_idx" ON "trainers"("statut");
CREATE INDEX "trainers_actif_idx" ON "trainers"("actif");
CREATE UNIQUE INDEX "trainees_email_key" ON "trainees"("email");
CREATE INDEX "trainees_email_idx" ON "trainees"("email");
CREATE INDEX "trainees_entreprise_idx" ON "trainees"("entreprise");
CREATE INDEX "trainees_situation_handicap_idx" ON "trainees"("situation_handicap");
CREATE INDEX "enrollments_session_id_idx" ON "enrollments"("session_id");
CREATE INDEX "enrollments_trainee_id_idx" ON "enrollments"("trainee_id");
CREATE INDEX "enrollments_statut_idx" ON "enrollments"("statut");
CREATE INDEX "formation_transitions_session_id_created_at_idx" ON "formation_transitions"("session_id", "created_at");
CREATE INDEX "formation_transitions_triggered_by_idx" ON "formation_transitions"("triggered_by");
CREATE UNIQUE INDEX "formation_transitions_idempotence" ON "formation_transitions"("session_id", "to_status", "trigger");

-- AddForeignKey
ALTER TABLE "formations" ADD CONSTRAINT "formations_offre_site_id_fkey" FOREIGN KEY ("offre_site_id") REFERENCES "offres_site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "formations" ADD CONSTRAINT "formations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_formation_id_fkey" FOREIGN KEY ("formation_id") REFERENCES "formations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_devis_id_fkey" FOREIGN KEY ("devis_id") REFERENCES "devis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_session_parent_id_fkey" FOREIGN KEY ("session_parent_id") REFERENCES "training_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_session_reportee_id_fkey" FOREIGN KEY ("session_reportee_id") REFERENCES "training_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_trainee_id_fkey" FOREIGN KEY ("trainee_id") REFERENCES "trainees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "formation_transitions" ADD CONSTRAINT "formation_transitions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "formation_transitions" ADD CONSTRAINT "formation_transitions_triggered_by_id_fkey" FOREIGN KEY ("triggered_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
