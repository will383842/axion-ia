-- CreateEnum
CREATE TYPE "CoachingSessionStatut" AS ENUM ('planifiee', 'realisee', 'annulee');

-- CreateEnum
CREATE TYPE "OptimisationType" AS ENUM ('automatisation', 'delegation', 'simplification', 'outillage', 'organisation');

-- AlterTable
ALTER TABLE "trainers" ADD COLUMN     "last_formateur_login_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "formateur_magic_links" (
    "id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_ip" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "formateur_magic_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coaching_sessions" (
    "id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "trainee_id" UUID,
    "booking_id" UUID,
    "intervention_slug" VARCHAR(80) NOT NULL,
    "date_seance" TIMESTAMP(3) NOT NULL,
    "statut" "CoachingSessionStatut" NOT NULL DEFAULT 'planifiee',
    "beneficiaire_nom" VARCHAR(200),
    "beneficiaire_email" CITEXT,
    "beneficiaire_entreprise" VARCHAR(250),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coaching_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coaching_cartographies" (
    "id" UUID NOT NULL,
    "coaching_session_id" UUID NOT NULL,
    "taches" JSONB NOT NULL DEFAULT '[]',
    "chronophages" TEXT,
    "irritants" TEXT,
    "donnees_sensibles" TEXT,
    "contraintes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coaching_cartographies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coaching_optimisations" (
    "id" UUID NOT NULL,
    "coaching_session_id" UUID NOT NULL,
    "type" "OptimisationType" NOT NULL,
    "titre" VARCHAR(250) NOT NULL,
    "situation_actuelle" TEXT,
    "piste" TEXT,
    "gain_temps_min_par_occ" INTEGER,
    "occurrences_semaine" INTEGER,
    "gain_euro_ou_risque" VARCHAR(250),
    "facilite" INTEGER,
    "priorite" INTEGER,
    "retenue" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coaching_optimisations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coaching_plans" (
    "id" UUID NOT NULL,
    "coaching_session_id" UUID NOT NULL,
    "objectifs" TEXT,
    "optimisations_retenues" JSONB NOT NULL DEFAULT '[]',
    "prochaines_etapes" JSONB NOT NULL DEFAULT '[]',
    "points_vigilance" TEXT,
    "gain_temps_h_semaine" DECIMAL(6,2),
    "suivi_propose" VARCHAR(120),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coaching_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coaching_comptes_rendus" (
    "id" UUID NOT NULL,
    "coaching_session_id" UUID NOT NULL,
    "date_seance" TIMESTAMP(3) NOT NULL,
    "duree_minutes" INTEGER,
    "objectifs" TEXT,
    "mises_en_situation" JSONB NOT NULL DEFAULT '[]',
    "phases_reflexives" JSONB NOT NULL DEFAULT '[]',
    "plan_remis" BOOLEAN NOT NULL DEFAULT false,
    "suite" VARCHAR(120),
    "notes_confidentielles" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coaching_comptes_rendus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coaching_journaux" (
    "id" UUID NOT NULL,
    "coaching_session_id" UUID NOT NULL,
    "date_entree" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periode" VARCHAR(60),
    "acquisitions" TEXT,
    "blocages" TEXT,
    "prochains_focus" TEXT,
    "gain_temps_cumule_h_sem" DECIMAL(6,2),
    "engagement" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coaching_journaux_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "formateur_magic_links_token_hash_key" ON "formateur_magic_links"("token_hash");

-- CreateIndex
CREATE INDEX "formateur_magic_links_trainer_id_idx" ON "formateur_magic_links"("trainer_id");

-- CreateIndex
CREATE INDEX "formateur_magic_links_expires_at_idx" ON "formateur_magic_links"("expires_at");

-- CreateIndex
CREATE INDEX "coaching_sessions_trainer_id_idx" ON "coaching_sessions"("trainer_id");

-- CreateIndex
CREATE INDEX "coaching_sessions_trainee_id_idx" ON "coaching_sessions"("trainee_id");

-- CreateIndex
CREATE INDEX "coaching_sessions_intervention_slug_idx" ON "coaching_sessions"("intervention_slug");

-- CreateIndex
CREATE INDEX "coaching_sessions_date_seance_idx" ON "coaching_sessions"("date_seance");

-- CreateIndex
CREATE UNIQUE INDEX "coaching_cartographies_coaching_session_id_key" ON "coaching_cartographies"("coaching_session_id");

-- CreateIndex
CREATE INDEX "coaching_optimisations_coaching_session_id_idx" ON "coaching_optimisations"("coaching_session_id");

-- CreateIndex
CREATE INDEX "coaching_optimisations_type_idx" ON "coaching_optimisations"("type");

-- CreateIndex
CREATE UNIQUE INDEX "coaching_plans_coaching_session_id_key" ON "coaching_plans"("coaching_session_id");

-- CreateIndex
CREATE INDEX "coaching_comptes_rendus_coaching_session_id_idx" ON "coaching_comptes_rendus"("coaching_session_id");

-- CreateIndex
CREATE INDEX "coaching_comptes_rendus_date_seance_idx" ON "coaching_comptes_rendus"("date_seance");

-- CreateIndex
CREATE INDEX "coaching_journaux_coaching_session_id_idx" ON "coaching_journaux"("coaching_session_id");

-- CreateIndex
CREATE INDEX "coaching_journaux_date_entree_idx" ON "coaching_journaux"("date_entree");

-- AddForeignKey
ALTER TABLE "formateur_magic_links" ADD CONSTRAINT "formateur_magic_links_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coaching_sessions" ADD CONSTRAINT "coaching_sessions_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coaching_sessions" ADD CONSTRAINT "coaching_sessions_trainee_id_fkey" FOREIGN KEY ("trainee_id") REFERENCES "trainees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coaching_cartographies" ADD CONSTRAINT "coaching_cartographies_coaching_session_id_fkey" FOREIGN KEY ("coaching_session_id") REFERENCES "coaching_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coaching_optimisations" ADD CONSTRAINT "coaching_optimisations_coaching_session_id_fkey" FOREIGN KEY ("coaching_session_id") REFERENCES "coaching_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coaching_plans" ADD CONSTRAINT "coaching_plans_coaching_session_id_fkey" FOREIGN KEY ("coaching_session_id") REFERENCES "coaching_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coaching_comptes_rendus" ADD CONSTRAINT "coaching_comptes_rendus_coaching_session_id_fkey" FOREIGN KEY ("coaching_session_id") REFERENCES "coaching_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coaching_journaux" ADD CONSTRAINT "coaching_journaux_coaching_session_id_fkey" FOREIGN KEY ("coaching_session_id") REFERENCES "coaching_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

