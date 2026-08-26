-- Suppression du système Booking legacy (décision Will 2026-08-26).
-- Mesuré avant migration : 0 ligne dans bookings/quotes/invoices en dev ET en prod.
-- Garde : purge des relances qui ne visaient QUE des cibles booking (0 attendu).
DELETE FROM "relances_proposees"
WHERE ("quote_id" IS NOT NULL OR "invoice_id" IS NOT NULL)
  AND "facture_formation_id" IS NULL
  AND "devis_id" IS NULL
  AND "dossier_financement_id" IS NULL;

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_submission_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_slot_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_formateur_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_from_submission_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_cadrage_meeting_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_quote_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_contract_document_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_payment_schedule_profile_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_cancelled_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings_options" DROP CONSTRAINT "bookings_options_slot_id_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_booking_id_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_invoice_id_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_booking_id_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_credit_note_of_id_fkey";

-- DropForeignKey
ALTER TABLE "refunds" DROP CONSTRAINT "refunds_invoice_id_fkey";

-- DropForeignKey
ALTER TABLE "refunds" DROP CONSTRAINT "refunds_payment_id_fkey";

-- DropForeignKey
ALTER TABLE "refunds" DROP CONSTRAINT "refunds_admin_user_id_fkey";

-- DropForeignKey
ALTER TABLE "contract_documents" DROP CONSTRAINT "contract_documents_booking_id_fkey";

-- DropForeignKey
ALTER TABLE "contract_documents" DROP CONSTRAINT "contract_documents_template_id_fkey";

-- DropForeignKey
ALTER TABLE "contract_documents" DROP CONSTRAINT "contract_documents_previous_version_id_fkey";

-- DropForeignKey
ALTER TABLE "quotes" DROP CONSTRAINT "quotes_booking_id_fkey";

-- DropForeignKey
ALTER TABLE "quotes" DROP CONSTRAINT "quotes_contract_document_id_fkey";

-- DropForeignKey
ALTER TABLE "cadrage_meetings" DROP CONSTRAINT "cadrage_meetings_held_by_admin_id_fkey";

-- DropForeignKey
ALTER TABLE "pricing_configs" DROP CONSTRAINT "pricing_configs_payment_schedule_profile_id_fkey";

-- DropForeignKey
ALTER TABLE "pricing_configs" DROP CONSTRAINT "pricing_configs_updated_by_admin_id_fkey";

-- DropForeignKey
ALTER TABLE "booking_payment_schedules" DROP CONSTRAINT "booking_payment_schedules_booking_id_fkey";

-- DropForeignKey
ALTER TABLE "booking_payment_schedules" DROP CONSTRAINT "booking_payment_schedules_profile_id_fkey";

-- DropForeignKey
ALTER TABLE "booking_transitions" DROP CONSTRAINT "booking_transitions_booking_id_fkey";

-- DropForeignKey
ALTER TABLE "booking_transitions" DROP CONSTRAINT "booking_transitions_triggered_by_id_fkey";

-- DropForeignKey
ALTER TABLE "relances_proposees" DROP CONSTRAINT "relances_proposees_invoice_id_fkey";

-- DropForeignKey
ALTER TABLE "relances_proposees" DROP CONSTRAINT "relances_proposees_quote_id_fkey";

-- DropIndex
DROP INDEX "payments_booking_id_type_status_idx";

-- DropIndex
DROP INDEX "relances_proposees_invoice_id_idx";

-- DropIndex
DROP INDEX "relances_proposees_quote_id_idx";

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "booking_id",
DROP COLUMN "invoice_id";

-- AlterTable
ALTER TABLE "relances_proposees" DROP COLUMN "invoice_id",
DROP COLUMN "quote_id";

-- DropTable
DROP TABLE "bookings";

-- DropTable
DROP TABLE "calendar_slots";

-- DropTable
DROP TABLE "bookings_options";

-- DropTable
DROP TABLE "invoices";

-- DropTable
DROP TABLE "refunds";

-- DropTable
DROP TABLE "stripe_webhook_events";

-- DropTable
DROP TABLE "contract_documents";

-- DropTable
DROP TABLE "contract_templates";

-- DropTable
DROP TABLE "quotes";

-- DropTable
DROP TABLE "cadrage_meetings";

-- DropTable
DROP TABLE "capacity_windows";

-- DropTable
DROP TABLE "pricing_configs";

-- DropTable
DROP TABLE "payment_schedule_profiles";

-- DropTable
DROP TABLE "booking_payment_schedules";

-- DropTable
DROP TABLE "booking_transitions";

-- DropEnum
DROP TYPE "BookingStatus";

-- DropEnum
DROP TYPE "CalendarSlotStatus";

-- DropEnum
DROP TYPE "BookingOptionStatus";

-- DropEnum
DROP TYPE "InvoiceType";

-- DropEnum
DROP TYPE "InvoiceStatus";

-- DropEnum
DROP TYPE "RefundStatus";

-- DropEnum
DROP TYPE "RefundReason";

-- DropEnum
DROP TYPE "QuoteStatus";

-- DropEnum
DROP TYPE "ContractStatus";

-- DropEnum
DROP TYPE "CadrageStatus";

-- DropEnum
DROP TYPE "CadrageDecision";

-- DropEnum
DROP TYPE "ValidationDecision";

-- DropEnum
DROP TYPE "FeesMode";

-- DropEnum
DROP TYPE "PayerType";

-- DropEnum
DROP TYPE "BookingOriginPath";

-- DropEnum
DROP TYPE "CancellationWindow";

