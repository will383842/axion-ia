-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('stripe', 'manual_wire', 'manual_check', 'manual_cash');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('deposit', 'installment_2', 'installment_3', 'balance', 'refund');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'cancelled');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('deposit', 'balance', 'installment', 'full', 'credit_note');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'issued', 'paid', 'partially_paid', 'overdue', 'cancelled', 'void', 'refunded');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('pending', 'processing', 'succeeded', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "RefundReason" AS ENUM ('client_cancellation', 'force_majeure', 'admin_decision', 'dispute', 'cgv_window', 'duplicate', 'fraudulent', 'other');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('draft', 'sent', 'accepted', 'declined', 'expired');

-- CreateEnum
CREATE TYPE "SignatureProvider" AS ENUM ('docuseal', 'manual_upload', 'physical_signed');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('draft', 'sent', 'signed', 'declined', 'expired', 'cancelled_admin');

-- CreateEnum
CREATE TYPE "CadrageStatus" AS ENUM ('scheduled', 'held', 'missed', 'rescheduled', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "CadrageDecision" AS ENUM ('pertinent', 'not_pertinent', 'reschedule');

-- CreateEnum
CREATE TYPE "ValidationDecision" AS ENUM ('pertinent', 'not_pertinent', 'reschedule');

-- CreateEnum
CREATE TYPE "FeesMode" AS ENUM ('real_costs', 'flat_rate_by_zone', 'included');

-- CreateEnum
CREATE TYPE "PayerType" AS ENUM ('client', 'opco_v2', 'autre_v2', 'opco', 'autre');

-- CreateEnum
CREATE TYPE "BookingOriginPath" AS ENUM ('direct', 'quote_negotiation');

-- CreateEnum
CREATE TYPE "CancellationWindow" AS ENUM ('more_than_15d', 'between_15d_and_2d', 'less_than_2d', 'force_majeure');

-- CreateEnum
CREATE TYPE "TransitionTriggeredBy" AS ENUM ('admin', 'cron', 'webhook', 'system', 'client', 'user');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('admin', 'cron', 'webhook', 'user', 'system');

-- CreateEnum
CREATE TYPE "SiteSettingCategory" AS ENUM ('booking', 'payment', 'signature', 'email', 'general', 'pricing', 'legal');

-- CreateEnum
CREATE TYPE "CompanySize" AS ENUM ('TPE', 'PME', 'ETI', 'GRANDE_ENTREPRISE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BookingOptionStatus" ADD VALUE 'pending_validation';
ALTER TYPE "BookingOptionStatus" ADD VALUE 'validated';
ALTER TYPE "BookingOptionStatus" ADD VALUE 'lost_other_won';
ALTER TYPE "BookingOptionStatus" ADD VALUE 'expired_no_response';
ALTER TYPE "BookingOptionStatus" ADD VALUE 'awaiting_winner_payment';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BookingStatus" ADD VALUE 'draft';
ALTER TYPE "BookingStatus" ADD VALUE 'option_pending';
ALTER TYPE "BookingStatus" ADD VALUE 'lost_other_won';
ALTER TYPE "BookingStatus" ADD VALUE 'refused';
ALTER TYPE "BookingStatus" ADD VALUE 'expired_no_response';
ALTER TYPE "BookingStatus" ADD VALUE 'cadrage_scheduled';
ALTER TYPE "BookingStatus" ADD VALUE 'cadrage_held';
ALTER TYPE "BookingStatus" ADD VALUE 'cadrage_declined';
ALTER TYPE "BookingStatus" ADD VALUE 'quote_required';
ALTER TYPE "BookingStatus" ADD VALUE 'quote_sent';
ALTER TYPE "BookingStatus" ADD VALUE 'quote_signed';
ALTER TYPE "BookingStatus" ADD VALUE 'quote_declined';
ALTER TYPE "BookingStatus" ADD VALUE 'contract_pending';
ALTER TYPE "BookingStatus" ADD VALUE 'contract_payment_sent';
ALTER TYPE "BookingStatus" ADD VALUE 'contract_signed';
ALTER TYPE "BookingStatus" ADD VALUE 'awaiting_admin_validation';
ALTER TYPE "BookingStatus" ADD VALUE 'paused';
ALTER TYPE "BookingStatus" ADD VALUE 'reminded_j7';
ALTER TYPE "BookingStatus" ADD VALUE 'in_progress';
ALTER TYPE "BookingStatus" ADD VALUE 'completed';
ALTER TYPE "BookingStatus" ADD VALUE 'invoiced_balance';
ALTER TYPE "BookingStatus" ADD VALUE 'installment_overdue';
ALTER TYPE "BookingStatus" ADD VALUE 'paid_balance';
ALTER TYPE "BookingStatus" ADD VALUE 'disputed';
ALTER TYPE "BookingStatus" ADD VALUE 'archived';
ALTER TYPE "BookingStatus" ADD VALUE 'cancelled_by_user';
ALTER TYPE "BookingStatus" ADD VALUE 'cancelled_by_admin';
ALTER TYPE "BookingStatus" ADD VALUE 'no_show';
ALTER TYPE "BookingStatus" ADD VALUE 'force_majeure';
ALTER TYPE "BookingStatus" ADD VALUE 'refunded_partial';
ALTER TYPE "BookingStatus" ADD VALUE 'refunded_full';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SubmissionStatus" ADD VALUE 'qualifying';
ALTER TYPE "SubmissionStatus" ADD VALUE 'negotiating';
ALTER TYPE "SubmissionStatus" ADD VALUE 'converted';
ALTER TYPE "SubmissionStatus" ADD VALUE 'lost';

-- AlterEnum
ALTER TYPE "SubmissionType" ADD VALUE 'quote_request';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "accommodation_fee_cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "additional_fees_cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "additional_fees_notes" TEXT,
ADD COLUMN     "balance_amount_cents" INTEGER,
ADD COLUMN     "balance_paid_at" TIMESTAMP(3),
ADD COLUMN     "base_price_ht_cents" INTEGER,
ADD COLUMN     "cadrage_meeting_id" UUID,
ADD COLUMN     "cancellation_reason" VARCHAR(500),
ADD COLUMN     "cancellation_window" "CancellationWindow",
ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "cancelled_by_user_id" UUID,
ADD COLUMN     "company_city_normalized" VARCHAR(120),
ADD COLUMN     "company_lat" DECIMAL(9,6),
ADD COLUMN     "company_lng" DECIMAL(9,6),
ADD COLUMN     "company_size" "CompanySize",
ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "confirmed_at" TIMESTAMP(3),
ADD COLUMN     "contract_document_id" UUID,
ADD COLUMN     "deposit_amount_cents" INTEGER,
ADD COLUMN     "deposit_paid_at" TIMESTAMP(3),
ADD COLUMN     "fees_mode" "FeesMode" NOT NULL DEFAULT 'real_costs',
ADD COLUMN     "force_majeure_notes" TEXT,
ADD COLUMN     "from_submission_id" UUID,
ADD COLUMN     "meal_fee_cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "nda_required" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "origin_path" "BookingOriginPath" NOT NULL DEFAULT 'direct',
ADD COLUMN     "overrides" JSONB,
ADD COLUMN     "pause_reason" VARCHAR(500),
ADD COLUMN     "paused_at" TIMESTAMP(3),
ADD COLUMN     "paused_until" TIMESTAMP(3),
ADD COLUMN     "payment_schedule_profile_id" UUID,
ADD COLUMN     "quote_id" UUID,
ADD COLUMN     "quote_required" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "training_session_id" UUID,
ADD COLUMN     "travel_buffer_days" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "travel_fee_cents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "invoice_id" UUID,
    "provider" "PaymentProvider" NOT NULL,
    "provider_event_id" VARCHAR(255),
    "provider_customer_id" VARCHAR(120),
    "provider_payment_intent_id" VARCHAR(120),
    "provider_checkout_session_id" VARCHAR(120),
    "amount_cents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "type" "PaymentType" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "paid_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "failure_reason" VARCHAR(500),
    "received_reference" VARCHAR(120),
    "mode" VARCHAR(40),
    "notes" TEXT,
    "recorded_by_admin_id" UUID,
    "is_historical" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "number" VARCHAR(40) NOT NULL,
    "booking_id" UUID NOT NULL,
    "type" "InvoiceType" NOT NULL,
    "installment_number" INTEGER,
    "base_price_ht_cents" INTEGER NOT NULL,
    "travel_fee_cents" INTEGER NOT NULL DEFAULT 0,
    "accommodation_fee_cents" INTEGER NOT NULL DEFAULT 0,
    "meal_fee_cents" INTEGER NOT NULL DEFAULT 0,
    "additional_fees_cents" INTEGER NOT NULL DEFAULT 0,
    "additional_fees_notes" TEXT,
    "amount_ht_cents" INTEGER NOT NULL,
    "vat_rate" DECIMAL(5,2) NOT NULL,
    "vat_reverse_charge" BOOLEAN NOT NULL DEFAULT false,
    "vat_mention" TEXT,
    "amount_ttc_cents" INTEGER NOT NULL,
    "deposit_expected_cents" INTEGER,
    "balance_expected_cents" INTEGER,
    "pdf_url" TEXT,
    "hash_sha256" VARCHAR(64),
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "status" "InvoiceStatus" NOT NULL DEFAULT 'draft',
    "archived_until" TIMESTAMP(3) NOT NULL,
    "payer_type" "PayerType" NOT NULL DEFAULT 'client',
    "payer_name" VARCHAR(300),
    "payer_vat_number" VARCHAR(40),
    "payer_address" TEXT,
    "payer_email" CITEXT,
    "locale" "Locale" NOT NULL DEFAULT 'fr',
    "legal_snapshot" JSONB NOT NULL,
    "credit_note_of_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "reason" "RefundReason" NOT NULL,
    "scope" VARCHAR(20) NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'pending',
    "stripe_refund_id" VARCHAR(120),
    "admin_user_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_webhook_events" (
    "id" UUID NOT NULL,
    "stripe_event_id" VARCHAR(120) NOT NULL,
    "type" VARCHAR(120) NOT NULL,
    "livemode" BOOLEAN NOT NULL DEFAULT false,
    "api_version" VARCHAR(40),
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMP(3),
    "error" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(3),
    "event_created_at" TIMESTAMP(3) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "docuseal_webhook_events" (
    "id" UUID NOT NULL,
    "docuseal_event_id" VARCHAR(120) NOT NULL,
    "type" VARCHAR(120) NOT NULL,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMP(3),
    "error" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "docuseal_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_documents" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "provider" "SignatureProvider" NOT NULL,
    "provider_id" VARCHAR(120),
    "template_id" UUID,
    "body" JSONB NOT NULL,
    "variables" JSONB,
    "status" "ContractStatus" NOT NULL DEFAULT 'draft',
    "sent_at" TIMESTAMP(3),
    "signed_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "pdf_url" TEXT,
    "hash_sha256" VARCHAR(64),
    "signer_email" CITEXT,
    "signer_name" VARCHAR(200),
    "ip_signer" VARCHAR(45),
    "version" INTEGER NOT NULL DEFAULT 1,
    "previous_version_id" UUID,
    "is_addendum" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_templates" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "body" JSONB NOT NULL,
    "variables" JSONB NOT NULL,
    "default_legal_clauses" JSONB NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "locale" "Locale" NOT NULL DEFAULT 'fr',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" UUID NOT NULL,
    "number" VARCHAR(40) NOT NULL,
    "booking_id" UUID NOT NULL,
    "body" JSONB NOT NULL,
    "amount_ht_cents" INTEGER NOT NULL,
    "vat_rate" DECIMAL(5,2) NOT NULL,
    "vat_reverse_charge" BOOLEAN NOT NULL DEFAULT false,
    "vat_mention" TEXT,
    "amount_ttc_cents" INTEGER NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "pdf_url" TEXT,
    "hash_sha256" VARCHAR(64),
    "status" "QuoteStatus" NOT NULL DEFAULT 'draft',
    "sent_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "contract_document_id" UUID,
    "docuseal_submission_id" VARCHAR(120),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cadrage_meetings" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 30,
    "visio_url" TEXT,
    "visio_provider" VARCHAR(40) NOT NULL DEFAULT 'manual_external',
    "status" "CadrageStatus" NOT NULL DEFAULT 'scheduled',
    "held_at" TIMESTAMP(3),
    "validation_decision" "ValidationDecision",
    "notes" TEXT,
    "held_by_admin_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cadrage_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capacity_windows" (
    "id" UUID NOT NULL,
    "week_start" DATE NOT NULL,
    "max_interventions" INTEGER NOT NULL DEFAULT 3,
    "current_bookings" INTEGER NOT NULL DEFAULT 0,
    "recomputed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capacity_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_configs" (
    "id" UUID NOT NULL,
    "intervention_type" VARCHAR(80) NOT NULL,
    "format" VARCHAR(80),
    "base_price_ht_cents" INTEGER NOT NULL,
    "deposit_percentage" INTEGER,
    "deposit_fixed_amount_cents" INTEGER,
    "vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "vat_reverse_charge" BOOLEAN NOT NULL DEFAULT false,
    "vat_mention" TEXT,
    "quote_required" BOOLEAN NOT NULL DEFAULT false,
    "fees_mode" "FeesMode" NOT NULL DEFAULT 'real_costs',
    "flat_rate_config" JSONB,
    "option_duration_days" INTEGER NOT NULL DEFAULT 5,
    "payment_schedule_profile_id" UUID,
    "contract_template_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_admin_id" UUID,

    CONSTRAINT "pricing_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_schedule_profiles" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "installments" JSONB NOT NULL,
    "threshold_min_cents" INTEGER,
    "threshold_max_cents" INTEGER,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_schedule_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_payment_schedules" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "profile_id" UUID,
    "installments" JSONB NOT NULL,
    "override_reason" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_payment_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_settings" (
    "key" VARCHAR(120) NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "category" "SiteSettingCategory" NOT NULL DEFAULT 'general',
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_admin_id" UUID,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "booking_transitions" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "from_status" "BookingStatus",
    "to_status" "BookingStatus" NOT NULL,
    "trigger" VARCHAR(80) NOT NULL,
    "triggered_by" "TransitionTriggeredBy" NOT NULL,
    "triggered_by_id" UUID,
    "reason" VARCHAR(500),
    "snapshot_before" JSONB,
    "snapshot_after" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_event_id_key" ON "payments"("provider_event_id");

-- CreateIndex
CREATE INDEX "payments_booking_id_type_status_idx" ON "payments"("booking_id", "type", "status");

-- CreateIndex
CREATE INDEX "payments_provider_event_id_idx" ON "payments"("provider_event_id");

-- CreateIndex
CREATE INDEX "payments_provider_payment_intent_id_idx" ON "payments"("provider_payment_intent_id");

-- CreateIndex
CREATE INDEX "payments_status_type_paid_at_idx" ON "payments"("status", "type", "paid_at");

-- CreateIndex
CREATE INDEX "payments_provider_status_idx" ON "payments"("provider", "status");

-- CreateIndex
CREATE INDEX "payments_is_historical_idx" ON "payments"("is_historical");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- CreateIndex
CREATE INDEX "invoices_booking_id_type_status_idx" ON "invoices"("booking_id", "type", "status");

-- CreateIndex
CREATE INDEX "invoices_number_idx" ON "invoices"("number");

-- CreateIndex
CREATE INDEX "invoices_due_at_idx" ON "invoices"("due_at");

-- CreateIndex
CREATE INDEX "invoices_paid_at_idx" ON "invoices"("paid_at");

-- CreateIndex
CREATE INDEX "invoices_status_issued_at_idx" ON "invoices"("status", "issued_at");

-- CreateIndex
CREATE INDEX "invoices_payer_email_idx" ON "invoices"("payer_email");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_stripe_refund_id_key" ON "refunds"("stripe_refund_id");

-- CreateIndex
CREATE INDEX "refunds_invoice_id_idx" ON "refunds"("invoice_id");

-- CreateIndex
CREATE INDEX "refunds_payment_id_idx" ON "refunds"("payment_id");

-- CreateIndex
CREATE INDEX "refunds_status_idx" ON "refunds"("status");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_webhook_events_stripe_event_id_key" ON "stripe_webhook_events"("stripe_event_id");

-- CreateIndex
CREATE INDEX "stripe_webhook_events_type_processed_at_idx" ON "stripe_webhook_events"("type", "processed_at");

-- CreateIndex
CREATE INDEX "stripe_webhook_events_stripe_event_id_idx" ON "stripe_webhook_events"("stripe_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "docuseal_webhook_events_docuseal_event_id_key" ON "docuseal_webhook_events"("docuseal_event_id");

-- CreateIndex
CREATE INDEX "docuseal_webhook_events_type_processed_at_idx" ON "docuseal_webhook_events"("type", "processed_at");

-- CreateIndex
CREATE INDEX "contract_documents_booking_id_status_idx" ON "contract_documents"("booking_id", "status");

-- CreateIndex
CREATE INDEX "contract_documents_provider_id_idx" ON "contract_documents"("provider_id");

-- CreateIndex
CREATE INDEX "contract_documents_previous_version_id_idx" ON "contract_documents"("previous_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "contract_templates_name_key" ON "contract_templates"("name");

-- CreateIndex
CREATE UNIQUE INDEX "contract_templates_slug_key" ON "contract_templates"("slug");

-- CreateIndex
CREATE INDEX "contract_templates_slug_idx" ON "contract_templates"("slug");

-- CreateIndex
CREATE INDEX "contract_templates_is_default_archived_at_idx" ON "contract_templates"("is_default", "archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_number_key" ON "quotes"("number");

-- CreateIndex
CREATE INDEX "quotes_booking_id_status_idx" ON "quotes"("booking_id", "status");

-- CreateIndex
CREATE INDEX "quotes_number_idx" ON "quotes"("number");

-- CreateIndex
CREATE UNIQUE INDEX "cadrage_meetings_booking_id_key" ON "cadrage_meetings"("booking_id");

-- CreateIndex
CREATE INDEX "cadrage_meetings_booking_id_status_idx" ON "cadrage_meetings"("booking_id", "status");

-- CreateIndex
CREATE INDEX "cadrage_meetings_scheduled_at_idx" ON "cadrage_meetings"("scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "capacity_windows_week_start_key" ON "capacity_windows"("week_start");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_configs_intervention_type_key" ON "pricing_configs"("intervention_type");

-- CreateIndex
CREATE INDEX "pricing_configs_intervention_type_is_active_idx" ON "pricing_configs"("intervention_type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "payment_schedule_profiles_name_key" ON "payment_schedule_profiles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "payment_schedule_profiles_slug_key" ON "payment_schedule_profiles"("slug");

-- CreateIndex
CREATE INDEX "payment_schedule_profiles_threshold_min_cents_threshold_max_idx" ON "payment_schedule_profiles"("threshold_min_cents", "threshold_max_cents");

-- CreateIndex
CREATE UNIQUE INDEX "booking_payment_schedules_booking_id_key" ON "booking_payment_schedules"("booking_id");

-- CreateIndex
CREATE INDEX "site_settings_category_idx" ON "site_settings"("category");

-- CreateIndex
CREATE INDEX "booking_transitions_booking_id_created_at_idx" ON "booking_transitions"("booking_id", "created_at");

-- CreateIndex
CREATE INDEX "booking_transitions_triggered_by_idx" ON "booking_transitions"("triggered_by");

-- CreateIndex
CREATE UNIQUE INDEX "booking_transitions_idempotence" ON "booking_transitions"("booking_id", "to_status", "trigger");

-- CreateIndex
CREATE INDEX "bookings_origin_path_idx" ON "bookings"("origin_path");

-- CreateIndex
CREATE INDEX "bookings_from_submission_id_idx" ON "bookings"("from_submission_id");

-- CreateIndex
CREATE INDEX "bookings_company_city_normalized_idx" ON "bookings"("company_city_normalized");

-- CreateIndex
CREATE INDEX "bookings_paused_until_idx" ON "bookings"("paused_until");

-- CreateIndex
CREATE INDEX "bookings_cancellation_window_idx" ON "bookings"("cancellation_window");

-- CreateIndex
CREATE INDEX "bookings_options_slot_id_status_idx" ON "bookings_options"("slot_id", "status");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_from_submission_id_fkey" FOREIGN KEY ("from_submission_id") REFERENCES "submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cadrage_meeting_id_fkey" FOREIGN KEY ("cadrage_meeting_id") REFERENCES "cadrage_meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_contract_document_id_fkey" FOREIGN KEY ("contract_document_id") REFERENCES "contract_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_payment_schedule_profile_id_fkey" FOREIGN KEY ("payment_schedule_profile_id") REFERENCES "payment_schedule_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_admin_id_fkey" FOREIGN KEY ("recorded_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_credit_note_of_id_fkey" FOREIGN KEY ("credit_note_of_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_documents" ADD CONSTRAINT "contract_documents_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_documents" ADD CONSTRAINT "contract_documents_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "contract_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_documents" ADD CONSTRAINT "contract_documents_previous_version_id_fkey" FOREIGN KEY ("previous_version_id") REFERENCES "contract_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_contract_document_id_fkey" FOREIGN KEY ("contract_document_id") REFERENCES "contract_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cadrage_meetings" ADD CONSTRAINT "cadrage_meetings_held_by_admin_id_fkey" FOREIGN KEY ("held_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_configs" ADD CONSTRAINT "pricing_configs_payment_schedule_profile_id_fkey" FOREIGN KEY ("payment_schedule_profile_id") REFERENCES "payment_schedule_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_configs" ADD CONSTRAINT "pricing_configs_updated_by_admin_id_fkey" FOREIGN KEY ("updated_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_payment_schedules" ADD CONSTRAINT "booking_payment_schedules_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_payment_schedules" ADD CONSTRAINT "booking_payment_schedules_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "payment_schedule_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_updated_by_admin_id_fkey" FOREIGN KEY ("updated_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_transitions" ADD CONSTRAINT "booking_transitions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_transitions" ADD CONSTRAINT "booking_transitions_triggered_by_id_fkey" FOREIGN KEY ("triggered_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

