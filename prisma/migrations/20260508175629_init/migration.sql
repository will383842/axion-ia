-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('fr', 'en');

-- CreateEnum
CREATE TYPE "SubmissionType" AS ENUM ('audit', 'implementation', 'intervention', 'contact');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('new', 'in_progress', 'processed', 'archived');

-- CreateEnum
CREATE TYPE "InterventionType" AS ENUM ('essentielle', 'equipes', 'managers', 'conference', 'dirigeants', 'coaching_individuel');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending', 'confirmed', 'cancelled', 'postponed');

-- CreateEnum
CREATE TYPE "CalendarSlotStatus" AS ENUM ('available', 'reserved', 'blocked');

-- CreateEnum
CREATE TYPE "BookingOptionStatus" AS ENUM ('pending', 'confirmed', 'refused', 'expired', 'converted');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "TestimonialStatus" AS ENUM ('pending', 'published', 'refused', 'archived');

-- CreateEnum
CREATE TYPE "FAQCategory" AS ENUM ('general', 'interventions', 'implementation', 'audit', 'pricing', 'process');

-- CreateEnum
CREATE TYPE "SurveyTrigger" AS ENUM ('immediate', 'scroll_50', 'delay_10s', 'exit_intent');

-- CreateEnum
CREATE TYPE "SurveyStatus" AS ENUM ('draft', 'active', 'ended', 'archived');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('super_admin', 'admin', 'editor', 'reader');

-- CreateEnum
CREATE TYPE "AdminStatus" AS ENUM ('active', 'suspended');

-- CreateEnum
CREATE TYPE "NewsletterStatus" AS ENUM ('pending', 'confirmed', 'unsubscribed', 'bounced');

-- CreateEnum
CREATE TYPE "ModuleKind" AS ENUM ('intervention', 'implementation', 'audit');

-- CreateTable
CREATE TABLE "submissions" (
    "id" UUID NOT NULL,
    "type" "SubmissionType" NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'new',
    "locale" "Locale" NOT NULL DEFAULT 'fr',
    "company_name" VARCHAR(255) NOT NULL,
    "registration_number" VARCHAR(40),
    "sector" VARCHAR(100),
    "address" TEXT,
    "employees_count" VARCHAR(20),
    "contact_name" VARCHAR(255) NOT NULL,
    "contact_role" VARCHAR(100),
    "contact_email" CITEXT NOT NULL,
    "contact_phone" VARCHAR(30),
    "details" JSONB NOT NULL,
    "internal_notes" TEXT,
    "assigned_to" VARCHAR(100),
    "ip_address" VARCHAR(64),
    "user_agent" TEXT,
    "referer" TEXT,
    "turnstile_score" DECIMAL(4,3),
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "intervention_type" "InterventionType" NOT NULL,
    "booking_date" TIMESTAMP(3) NOT NULL,
    "participants_count" INTEGER NOT NULL,
    "participants_tier" VARCHAR(40),
    "price_paid_cents" INTEGER,
    "locale" "Locale" NOT NULL DEFAULT 'fr',
    "submission_id" UUID,
    "slot_id" UUID,
    "calendar_event_id" VARCHAR(255),
    "status" "BookingStatus" NOT NULL DEFAULT 'pending',
    "internal_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_slots" (
    "id" UUID NOT NULL,
    "slot_date" DATE NOT NULL,
    "status" "CalendarSlotStatus" NOT NULL DEFAULT 'available',
    "display_sector" VARCHAR(100),
    "participants_count" INTEGER,
    "intervention_type" "InterventionType",
    "show_publicly" BOOLEAN NOT NULL DEFAULT true,
    "blocked_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings_options" (
    "id" UUID NOT NULL,
    "slot_id" UUID NOT NULL,
    "company_name" VARCHAR(255) NOT NULL,
    "company_sector" VARCHAR(100) NOT NULL,
    "participants_count" INTEGER NOT NULL,
    "intervention_type" "InterventionType" NOT NULL,
    "contact_name" VARCHAR(255) NOT NULL,
    "contact_email" CITEXT NOT NULL,
    "contact_phone" VARCHAR(30) NOT NULL,
    "consent_display" BOOLEAN NOT NULL DEFAULT false,
    "status" "BookingOptionStatus" NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "reminder_sent_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "notes" TEXT,
    "locale" "Locale" NOT NULL DEFAULT 'fr',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" UUID NOT NULL,
    "author_id" UUID,
    "category_id" UUID,
    "featured_image" VARCHAR(512),
    "status" "PublishStatus" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "reading_time" INTEGER,
    "views_count" INTEGER NOT NULL DEFAULT 0,
    "comments_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_translations" (
    "id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "excerpt" TEXT,
    "body" TEXT NOT NULL,
    "meta_title" VARCHAR(70),
    "meta_description" VARCHAR(160),
    "og_image" VARCHAR(512),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "article_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_tags" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "name_fr" VARCHAR(120) NOT NULL,
    "name_en" VARCHAR(120) NOT NULL,
    "desc_fr" TEXT,
    "desc_en" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_tags_on_articles" (
    "article_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "article_tags_on_articles_pkey" PRIMARY KEY ("article_id","tag_id")
);

-- CreateTable
CREATE TABLE "authors" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" CITEXT,
    "avatar_url" VARCHAR(512),
    "bio_fr" TEXT,
    "bio_en" TEXT,
    "linkedin_url" VARCHAR(512),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "authors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testimonials" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "role" VARCHAR(100),
    "company" VARCHAR(255),
    "sector" VARCHAR(100),
    "company_size" VARCHAR(20),
    "short_quote_fr" TEXT NOT NULL,
    "short_quote_en" TEXT NOT NULL,
    "full_quote_fr" TEXT,
    "full_quote_en" TEXT,
    "rating" INTEGER,
    "photo_url" VARCHAR(512),
    "video_url" VARCHAR(512),
    "module" "ModuleKind",
    "result_highlight" VARCHAR(255),
    "display_pages" JSONB,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "status" "TestimonialStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_studies" (
    "id" UUID NOT NULL,
    "sector" VARCHAR(100) NOT NULL,
    "company_size_range" VARCHAR(40) NOT NULL,
    "region" VARCHAR(100),
    "modules_used" JSONB NOT NULL,
    "results_quantified" JSONB NOT NULL,
    "duration_weeks" INTEGER,
    "roi_weeks" INTEGER,
    "testimonial_id" UUID,
    "status" "PublishStatus" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_studies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_study_translations" (
    "id" UUID NOT NULL,
    "case_study_id" UUID NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "problem" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "meta_title" VARCHAR(70),
    "meta_description" VARCHAR(160),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_study_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faqs" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "category" "FAQCategory" NOT NULL DEFAULT 'general',
    "question_fr" VARCHAR(500) NOT NULL,
    "question_en" VARCHAR(500) NOT NULL,
    "answer_fr" TEXT NOT NULL,
    "answer_en" TEXT NOT NULL,
    "meta_title" VARCHAR(70),
    "meta_description" VARCHAR(160),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "status" "PublishStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_articles" (
    "id" UUID NOT NULL,
    "category_id" UUID,
    "is_tutorial" BOOLEAN NOT NULL DEFAULT false,
    "status" "PublishStatus" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_article_translations" (
    "id" UUID NOT NULL,
    "help_article_id" UUID NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "excerpt" TEXT,
    "body" TEXT NOT NULL,
    "meta_title" VARCHAR(70),
    "meta_description" VARCHAR(160),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_article_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surveys" (
    "id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "questions" JSONB NOT NULL,
    "display_pages" JSONB,
    "trigger" "SurveyTrigger" NOT NULL DEFAULT 'immediate',
    "status" "SurveyStatus" NOT NULL DEFAULT 'draft',
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_responses" (
    "id" UUID NOT NULL,
    "survey_id" UUID NOT NULL,
    "answers" JSONB NOT NULL,
    "visitor_id" VARCHAR(120),
    "page_url" TEXT,
    "locale" "Locale" NOT NULL DEFAULT 'fr',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "parent_id" UUID,
    "module" "ModuleKind",
    "name_fr" VARCHAR(255) NOT NULL,
    "name_en" VARCHAR(255) NOT NULL,
    "description_fr" TEXT,
    "description_en" TEXT,
    "icon" VARCHAR(80),
    "color_accent" VARCHAR(7),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "status" "PublishStatus" NOT NULL DEFAULT 'published',
    "seo_title_fr" VARCHAR(70),
    "seo_title_en" VARCHAR(70),
    "seo_desc_fr" VARCHAR(160),
    "seo_desc_en" VARCHAR(160),
    "page_content_fr" TEXT,
    "page_content_en" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" CITEXT NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'reader',
    "two_factor_secret" VARCHAR(255),
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_verified" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMP(3),
    "last_login_ip" VARCHAR(64),
    "status" "AdminStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" UUID NOT NULL,
    "admin_user_id" UUID,
    "action" VARCHAR(120) NOT NULL,
    "target_type" VARCHAR(80),
    "target_id" UUID,
    "changes" JSONB,
    "ip_address" VARCHAR(64),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" VARCHAR(120) NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "newsletter_subscribers" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'fr',
    "status" "NewsletterStatus" NOT NULL DEFAULT 'pending',
    "confirm_token" VARCHAR(120),
    "confirm_sent_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "unsubscribed_at" TIMESTAMP(3),
    "unsubscribe_token" VARCHAR(120),
    "source" VARCHAR(120),
    "ip_address" VARCHAR(64),
    "mailwizz_list_uid" VARCHAR(120),
    "mailwizz_sub_uid" VARCHAR(120),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "submissions_type_idx" ON "submissions"("type");

-- CreateIndex
CREATE INDEX "submissions_status_idx" ON "submissions"("status");

-- CreateIndex
CREATE INDEX "submissions_locale_idx" ON "submissions"("locale");

-- CreateIndex
CREATE INDEX "submissions_submitted_at_idx" ON "submissions"("submitted_at");

-- CreateIndex
CREATE INDEX "submissions_contact_email_idx" ON "submissions"("contact_email");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_slot_id_key" ON "bookings"("slot_id");

-- CreateIndex
CREATE INDEX "bookings_intervention_type_idx" ON "bookings"("intervention_type");

-- CreateIndex
CREATE INDEX "bookings_booking_date_idx" ON "bookings"("booking_date");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE INDEX "bookings_locale_idx" ON "bookings"("locale");

-- CreateIndex
CREATE INDEX "calendar_slots_status_idx" ON "calendar_slots"("status");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_slots_slot_date_key" ON "calendar_slots"("slot_date");

-- CreateIndex
CREATE INDEX "bookings_options_slot_id_idx" ON "bookings_options"("slot_id");

-- CreateIndex
CREATE INDEX "bookings_options_status_idx" ON "bookings_options"("status");

-- CreateIndex
CREATE INDEX "bookings_options_expires_at_idx" ON "bookings_options"("expires_at");

-- CreateIndex
CREATE INDEX "articles_status_idx" ON "articles"("status");

-- CreateIndex
CREATE INDEX "articles_published_at_idx" ON "articles"("published_at");

-- CreateIndex
CREATE INDEX "article_translations_slug_idx" ON "article_translations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "article_translations_article_id_locale_key" ON "article_translations"("article_id", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "article_translations_locale_slug_key" ON "article_translations"("locale", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "article_tags_slug_key" ON "article_tags"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "authors_slug_key" ON "authors"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "testimonials_slug_key" ON "testimonials"("slug");

-- CreateIndex
CREATE INDEX "testimonials_status_idx" ON "testimonials"("status");

-- CreateIndex
CREATE INDEX "testimonials_sector_idx" ON "testimonials"("sector");

-- CreateIndex
CREATE INDEX "case_studies_sector_idx" ON "case_studies"("sector");

-- CreateIndex
CREATE INDEX "case_studies_status_idx" ON "case_studies"("status");

-- CreateIndex
CREATE INDEX "case_studies_published_at_idx" ON "case_studies"("published_at");

-- CreateIndex
CREATE UNIQUE INDEX "case_study_translations_case_study_id_locale_key" ON "case_study_translations"("case_study_id", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "case_study_translations_locale_slug_key" ON "case_study_translations"("locale", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "faqs_slug_key" ON "faqs"("slug");

-- CreateIndex
CREATE INDEX "faqs_category_idx" ON "faqs"("category");

-- CreateIndex
CREATE INDEX "faqs_status_idx" ON "faqs"("status");

-- CreateIndex
CREATE INDEX "help_articles_status_idx" ON "help_articles"("status");

-- CreateIndex
CREATE INDEX "help_articles_published_at_idx" ON "help_articles"("published_at");

-- CreateIndex
CREATE UNIQUE INDEX "help_article_translations_help_article_id_locale_key" ON "help_article_translations"("help_article_id", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "help_article_translations_locale_slug_key" ON "help_article_translations"("locale", "slug");

-- CreateIndex
CREATE INDEX "surveys_status_idx" ON "surveys"("status");

-- CreateIndex
CREATE INDEX "survey_responses_survey_id_idx" ON "survey_responses"("survey_id");

-- CreateIndex
CREATE INDEX "survey_responses_submitted_at_idx" ON "survey_responses"("submitted_at");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE INDEX "categories_module_idx" ON "categories"("module");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "admin_users_role_idx" ON "admin_users"("role");

-- CreateIndex
CREATE INDEX "admin_users_status_idx" ON "admin_users"("status");

-- CreateIndex
CREATE INDEX "activity_logs_admin_user_id_idx" ON "activity_logs"("admin_user_id");

-- CreateIndex
CREATE INDEX "activity_logs_action_idx" ON "activity_logs"("action");

-- CreateIndex
CREATE INDEX "activity_logs_target_type_target_id_idx" ON "activity_logs"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_email_key" ON "newsletter_subscribers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_confirm_token_key" ON "newsletter_subscribers"("confirm_token");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_unsubscribe_token_key" ON "newsletter_subscribers"("unsubscribe_token");

-- CreateIndex
CREATE INDEX "newsletter_subscribers_locale_idx" ON "newsletter_subscribers"("locale");

-- CreateIndex
CREATE INDEX "newsletter_subscribers_status_idx" ON "newsletter_subscribers"("status");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "calendar_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings_options" ADD CONSTRAINT "bookings_options_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "calendar_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "authors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_translations" ADD CONSTRAINT "article_translations_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_tags_on_articles" ADD CONSTRAINT "article_tags_on_articles_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_tags_on_articles" ADD CONSTRAINT "article_tags_on_articles_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "article_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_studies" ADD CONSTRAINT "case_studies_testimonial_id_fkey" FOREIGN KEY ("testimonial_id") REFERENCES "testimonials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_study_translations" ADD CONSTRAINT "case_study_translations_case_study_id_fkey" FOREIGN KEY ("case_study_id") REFERENCES "case_studies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_articles" ADD CONSTRAINT "help_articles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_article_translations" ADD CONSTRAINT "help_article_translations_help_article_id_fkey" FOREIGN KEY ("help_article_id") REFERENCES "help_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

