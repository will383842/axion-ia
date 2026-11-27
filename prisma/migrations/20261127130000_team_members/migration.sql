-- Pages collaborateurs : quatre tables NOUVELLES, leurs index et les clés étrangères entre elles.
-- Ajout seul : aucun ALTER, UPDATE, DELETE ni DROP sur une table existante, aucune énumération,
-- aucune donnée insérée. Compatible avec l'ancien et le nouveau conteneur ; le worker ne lit ni
-- n'écrit ces tables.
-- Effacement réel : supprimer une fiche supprime ses invitations et ses réponses (ON DELETE CASCADE) ;
-- le journal garde ses lignes, le lien vers la fiche passe à NULL (ON DELETE SET NULL).

-- CreateTable
CREATE TABLE "team_members" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "previous_slugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" VARCHAR(40) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'brouillon',
    "first_name" VARCHAR(80) NOT NULL,
    "organization_name" VARCHAR(160),
    "job_title" VARCHAR(120) NOT NULL,
    "headline" VARCHAR(200),
    "bio_md" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category_answers" JSONB,
    "questionnaire_version" VARCHAR(40),
    "linkedin_url" VARCHAR(512),
    "website_url" VARCHAR(512),
    "city_slug" VARCHAR(100),
    "department_code" VARCHAR(3),
    "location_label" VARCHAR(120),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "show_on_map" BOOLEAN NOT NULL DEFAULT false,
    "photo_kind" VARCHAR(20) NOT NULL DEFAULT 'avatar',
    "photo_storage_path" VARCHAR(512),
    "photo_url_256" VARCHAR(512),
    "photo_url_1024" VARCHAR(512),
    "photo_alt" VARCHAR(200),
    "avatar_seed" VARCHAR(64),
    "publication_consent_at" TIMESTAMPTZ(3),
    "publication_consent_version" VARCHAR(64),
    "photo_consent_at" TIMESTAMPTZ(3),
    "photo_consent_version" VARCHAR(64),
    "linkedin_consent_at" TIMESTAMPTZ(3),
    "linkedin_consent_version" VARCHAR(64),
    "consent_source" VARCHAR(20),
    "consent_note" TEXT,
    "contact_email_enc" TEXT,
    "contact_email_hash" VARCHAR(64),
    "withdraw_token_hash" VARCHAR(64),
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    "published_at" TIMESTAMPTZ(3),
    "validated_at" TIMESTAMPTZ(3),
    "validated_by_admin_id" VARCHAR(64),
    "withdrawn_at" TIMESTAMPTZ(3),
    "withdrawn_by" VARCHAR(20),
    "erasure_requested_at" TIMESTAMPTZ(3),
    "apporteur_reseau_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_questionnaire_invites" (
    "id" UUID NOT NULL,
    "member_id" UUID,
    "category" VARCHAR(40) NOT NULL,
    "questionnaire_version" VARCHAR(40) NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "email_hash" VARCHAR(64),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "first_opened_at" TIMESTAMPTZ(3),
    "used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "created_by_admin_id" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_questionnaire_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_questionnaire_submissions" (
    "id" UUID NOT NULL,
    "invite_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "questionnaire_version" VARCHAR(40) NOT NULL,
    "answers" JSONB NOT NULL,
    "photo_storage_path" VARCHAR(512),
    "status" VARCHAR(20) NOT NULL DEFAULT 'recue',
    "review_note" TEXT,
    "ip_hash" VARCHAR(64),
    "user_agent" VARCHAR(300),
    "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(3),

    CONSTRAINT "team_questionnaire_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_member_events" (
    "id" UUID NOT NULL,
    "member_id" UUID,
    "action" VARCHAR(40) NOT NULL,
    "actor" VARCHAR(64) NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_member_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_members_slug_key" ON "team_members"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_withdraw_token_hash_key" ON "team_members"("withdraw_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_apporteur_reseau_id_key" ON "team_members"("apporteur_reseau_id");

-- CreateIndex
CREATE INDEX "team_members_status_category_idx" ON "team_members"("status", "category");

-- CreateIndex
CREATE INDEX "team_members_status_show_on_map_idx" ON "team_members"("status", "show_on_map");

-- CreateIndex
CREATE INDEX "team_members_contact_email_hash_idx" ON "team_members"("contact_email_hash");

-- CreateIndex
CREATE INDEX "team_members_previous_slugs_idx" ON "team_members" USING GIN ("previous_slugs");

-- CreateIndex
CREATE UNIQUE INDEX "team_questionnaire_invites_token_hash_key" ON "team_questionnaire_invites"("token_hash");

-- CreateIndex
CREATE INDEX "team_questionnaire_invites_member_id_idx" ON "team_questionnaire_invites"("member_id");

-- CreateIndex
CREATE INDEX "team_questionnaire_invites_email_hash_idx" ON "team_questionnaire_invites"("email_hash");

-- CreateIndex
CREATE INDEX "team_questionnaire_submissions_member_id_status_idx" ON "team_questionnaire_submissions"("member_id", "status");

-- CreateIndex
CREATE INDEX "team_questionnaire_submissions_invite_id_idx" ON "team_questionnaire_submissions"("invite_id");

-- CreateIndex
CREATE INDEX "team_member_events_member_id_created_at_idx" ON "team_member_events"("member_id", "created_at");

-- CreateIndex
CREATE INDEX "team_member_events_action_created_at_idx" ON "team_member_events"("action", "created_at");

-- AddForeignKey
ALTER TABLE "team_questionnaire_invites" ADD CONSTRAINT "team_questionnaire_invites_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_questionnaire_submissions" ADD CONSTRAINT "team_questionnaire_submissions_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "team_questionnaire_invites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_questionnaire_submissions" ADD CONSTRAINT "team_questionnaire_submissions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member_events" ADD CONSTRAINT "team_member_events_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

