// Router des 8 templates email × 2 locales (Sprint 15 / M8 step 4).
//
// Chaque template est un composant qui prend `locale` + `payload`. Le router
// `renderEmailTemplate(name, locale, payload)` retourne { subject, html, text }.

import { render } from "@react-email/render";
import type { ReactElement } from "react";
import type { EmailJobName } from "@/server/queue/types";
import type { Locale } from "../../../../prisma/generated/client";
import { getPublishedReviewStats } from "../review-stats";
import { setReviewStats } from "./_layout";
import { BookingConfirmedEmail, bookingConfirmedSubject } from "./booking-confirmed";
import { BookingCancelledEmail, bookingCancelledSubject } from "./booking-cancelled";
import { OptionPostedEmail, optionPostedSubject } from "./option-posted";
import { OptionReminderEmail, optionReminderSubject } from "./option-reminder";
import { OptionExpiredEmail, optionExpiredSubject } from "./option-expired";
import {
  OptionConfirmedByAdminEmail,
  optionConfirmedByAdminSubject,
} from "./option-confirmed-by-admin";
import { OptionRefusedByAdminEmail, optionRefusedByAdminSubject } from "./option-refused-by-admin";
import { AuditConfirmedEmail, auditConfirmedSubject } from "./audit-confirmed";
import {
  ImplementationConfirmedEmail,
  implementationConfirmedSubject,
} from "./implementation-confirmed";
import {
  NewsletterConfirmOptinEmail,
  newsletterConfirmOptinSubject,
} from "./newsletter-confirm-optin";
import { ContactConfirmedEmail, contactConfirmedSubject } from "./contact-confirmed";
import { GdprExportLinkEmail, gdprExportLinkSubject } from "./gdpr-export-link";
import { QuoteRequestReceivedEmail, quoteRequestReceivedSubject } from "./quote-request-received";
import { PaymentLinkEmail, paymentLinkSubject } from "./payment-link";
import { PaymentReceiptEmail, paymentReceiptSubject } from "./payment-receipt";
import { PaymentFailedEmail, paymentFailedSubject } from "./payment-failed";
import {
  BookingValidatedOnCalendarEmail,
  bookingValidatedOnCalendarSubject,
} from "./booking-validated-on-calendar";
import {
  BookingPausedConfirmationEmail,
  bookingPausedConfirmationSubject,
} from "./booking-paused-confirmation";
import {
  BookingResumedNotificationEmail,
  bookingResumedNotificationSubject,
} from "./booking-resumed-notification";
import { ForceMajeureNoticeEmail, forceMajeureNoticeSubject } from "./force-majeure-notice";
import { CadrageScheduledEmail, cadrageScheduledSubject } from "./cadrage-scheduled";
import { CadrageDeclinedEmail, cadrageDeclinedSubject } from "./cadrage-declined";
import { QuoteSentEmail, quoteSentSubject } from "./quote-sent";
import { QuoteSignedEmail, quoteSignedSubject } from "./quote-signed";
import { QuoteDeclinedEmail, quoteDeclinedSubject } from "./quote-declined";
import {
  CancellationConfirmedByUserEmail,
  cancellationConfirmedByUserSubject,
} from "./cancellation-confirmed-by-user";
import { RefundIssuedEmail, refundIssuedSubject } from "./refund-issued";
import { SubmissionReplyEmail, submissionReplySubject } from "./submission-reply";
// T15 — emails auto Qualiopi lifecycle
import { QualiopiConvocationEmail, qualiopiConvocationSubject } from "./qualiopi-convocation";
import { QualiopiRappelJ7Email, qualiopiRappelJ7Subject } from "./qualiopi-rappel-j7";
import {
  QualiopiSatisfactionJ1Email,
  qualiopiSatisfactionJ1Subject,
} from "./qualiopi-satisfaction-j1";
import { QualiopiSuiviJ30Email, qualiopiSuiviJ30Subject } from "./qualiopi-suivi-j30";
import { QualiopiPortailAccesEmail, qualiopiPortailAccesSubject } from "./qualiopi-portail-acces";
import {
  QualiopiAttestationDisponibleEmail,
  qualiopiAttestationDisponibleSubject,
} from "./qualiopi-attestation-disponible";
import {
  QualiopiAlerteInterneEmail,
  qualiopiAlerteInterneSubject,
} from "./qualiopi-alerte-interne";
import {
  DocumentsNouvelleVersionEmail,
  documentsNouvelleVersionSubject,
} from "./documents-nouvelle-version";
import { FormateurMagicLinkEmail, formateurMagicLinkSubject } from "./formateur-magic-link";
import { RessourcesMagicLinkEmail, ressourcesMagicLinkSubject } from "./ressources-magic-link";
// P1 refonte 2026-06-21 — templates « pleins » (sortis du stub-factory)
import { DisputedNoticeEmail, disputedNoticeSubject } from "./disputed-notice";
import { PaymentReminderJ7Email, paymentReminderJ7Subject } from "./payment-reminder-j7";
import { PaymentOverdueJ1Email, paymentOverdueJ1Subject } from "./payment-overdue-j1";
import { PaymentOverdueJ15Email, paymentOverdueJ15Subject } from "./payment-overdue-j15";
import { PaymentOverdueJ30Email, paymentOverdueJ30Subject } from "./payment-overdue-j30";
import {
  InstallmentOverdueSoftEmail,
  installmentOverdueSoftSubject,
} from "./installment-overdue-soft";
import {
  InstallmentOverdueFirmEmail,
  installmentOverdueFirmSubject,
} from "./installment-overdue-firm";
import { ContractSentEmail, contractSentSubject } from "./contract-sent";
import { ContractSignedEmail, contractSignedSubject } from "./contract-signed";
import { ContractRefusedEmail, contractRefusedSubject } from "./contract-refused";
import { ContractReminderEmail, contractReminderSubject } from "./contract-reminder";
import {
  ContractVersionUpdatedEmail,
  contractVersionUpdatedSubject,
} from "./contract-version-updated";
import { CadrageJ1ReminderEmail, cadrageJ1ReminderSubject } from "./cadrage-j1-reminder";
import { CadrageH2ReminderEmail, cadrageH2ReminderSubject } from "./cadrage-h2-reminder";
import {
  BookingRescheduledByAdminEmail,
  bookingRescheduledByAdminSubject,
} from "./booking-rescheduled-by-admin";
import { BookingJ1ReminderEmail, bookingJ1ReminderSubject } from "./booking-j1-reminder";
import {
  BookingCompletedThanksEmail,
  bookingCompletedThanksSubject,
} from "./booking-completed-thanks";
import { QuoteReminderEmail, quoteReminderSubject } from "./quote-reminder";
import { QuoteExpiredEmail, quoteExpiredSubject } from "./quote-expired";
import { DevisEnvoiEmail, devisEnvoiSubject } from "./devis-envoi";
import { FactureEnvoiEmail, factureEnvoiSubject } from "./facture-envoi";

type TemplateMap = {
  [K in EmailJobName]: {
    subject: (locale: Locale, payload: Record<string, unknown>) => string;
    component: (props: { locale: Locale; payload: Record<string, unknown> }) => ReactElement;
  };
};

const TEMPLATES: TemplateMap = {
  "booking-confirmed": {
    subject: bookingConfirmedSubject,
    component: BookingConfirmedEmail,
  },
  "booking-cancelled": {
    subject: bookingCancelledSubject,
    component: BookingCancelledEmail,
  },
  "option-posted": {
    subject: optionPostedSubject,
    component: OptionPostedEmail,
  },
  "option-reminder": {
    subject: optionReminderSubject,
    component: OptionReminderEmail,
  },
  "option-expired": {
    subject: optionExpiredSubject,
    component: OptionExpiredEmail,
  },
  "option-confirmed-by-admin": {
    subject: optionConfirmedByAdminSubject,
    component: OptionConfirmedByAdminEmail,
  },
  "option-refused-by-admin": {
    subject: optionRefusedByAdminSubject,
    component: OptionRefusedByAdminEmail,
  },
  "audit-confirmed": {
    subject: auditConfirmedSubject,
    component: AuditConfirmedEmail,
  },
  "implementation-confirmed": {
    subject: implementationConfirmedSubject,
    component: ImplementationConfirmedEmail,
  },
  "newsletter-confirm-optin": {
    subject: newsletterConfirmOptinSubject,
    component: NewsletterConfirmOptinEmail,
  },
  "contact-confirmed": {
    subject: contactConfirmedSubject,
    component: ContactConfirmedEmail,
  },
  "gdpr-export-link": {
    subject: gdprExportLinkSubject,
    component: GdprExportLinkEmail,
  },
  "quote-request-received": {
    subject: quoteRequestReceivedSubject,
    component: QuoteRequestReceivedEmail,
  },
  "payment-link": {
    subject: paymentLinkSubject,
    component: PaymentLinkEmail,
  },
  "payment-receipt": {
    subject: paymentReceiptSubject,
    component: PaymentReceiptEmail,
  },
  "payment-failed": {
    subject: paymentFailedSubject,
    component: PaymentFailedEmail,
  },
  "booking-validated-on-calendar": {
    subject: bookingValidatedOnCalendarSubject,
    component: BookingValidatedOnCalendarEmail,
  },
  "booking-paused-confirmation": {
    subject: bookingPausedConfirmationSubject,
    component: BookingPausedConfirmationEmail,
  },
  "booking-resumed-notification": {
    subject: bookingResumedNotificationSubject,
    component: BookingResumedNotificationEmail,
  },
  "force-majeure-notice": {
    subject: forceMajeureNoticeSubject,
    component: ForceMajeureNoticeEmail,
  },
  "cadrage-scheduled": {
    subject: cadrageScheduledSubject,
    component: CadrageScheduledEmail,
  },
  "cadrage-declined": {
    subject: cadrageDeclinedSubject,
    component: CadrageDeclinedEmail,
  },
  "quote-sent": {
    subject: quoteSentSubject,
    component: QuoteSentEmail,
  },
  "quote-signed": {
    subject: quoteSignedSubject,
    component: QuoteSignedEmail,
  },
  "quote-declined": {
    subject: quoteDeclinedSubject,
    component: QuoteDeclinedEmail,
  },
  "cancellation-confirmed-by-user": {
    subject: cancellationConfirmedByUserSubject,
    component: CancellationConfirmedByUserEmail,
  },
  "refund-issued": {
    subject: refundIssuedSubject,
    component: RefundIssuedEmail,
  },
  "submission-reply": {
    subject: submissionReplySubject,
    component: SubmissionReplyEmail,
  },
  // T15 — emails auto Qualiopi lifecycle
  "qualiopi-convocation": {
    subject: qualiopiConvocationSubject,
    component: QualiopiConvocationEmail,
  },
  "qualiopi-rappel-j7": {
    subject: qualiopiRappelJ7Subject,
    component: QualiopiRappelJ7Email,
  },
  "qualiopi-satisfaction-j1": {
    subject: qualiopiSatisfactionJ1Subject,
    component: QualiopiSatisfactionJ1Email,
  },
  "qualiopi-suivi-j30": {
    subject: qualiopiSuiviJ30Subject,
    component: QualiopiSuiviJ30Email,
  },
  "qualiopi-attestation-disponible": {
    subject: qualiopiAttestationDisponibleSubject,
    component: QualiopiAttestationDisponibleEmail,
  },
  "qualiopi-portail-acces": {
    subject: qualiopiPortailAccesSubject,
    component: QualiopiPortailAccesEmail,
  },
  "qualiopi-alerte-interne": {
    subject: qualiopiAlerteInterneSubject,
    component: QualiopiAlerteInterneEmail,
  },
  "documents-nouvelle-version": {
    subject: documentsNouvelleVersionSubject,
    component: DocumentsNouvelleVersionEmail,
  },
  "formateur-magic-link": {
    subject: formateurMagicLinkSubject,
    component: FormateurMagicLinkEmail,
  },
  "ressources-magic-link": {
    subject: ressourcesMagicLinkSubject,
    component: RessourcesMagicLinkEmail,
  },
  // P1 refonte 2026-06-21 — templates pleins (relation-client, FR+EN)
  "contract-version-updated": {
    subject: contractVersionUpdatedSubject,
    component: ContractVersionUpdatedEmail,
  },
  "contract-sent": { subject: contractSentSubject, component: ContractSentEmail },
  "contract-signed": { subject: contractSignedSubject, component: ContractSignedEmail },
  "contract-refused": { subject: contractRefusedSubject, component: ContractRefusedEmail },
  "contract-reminder": { subject: contractReminderSubject, component: ContractReminderEmail },
  "payment-reminder-j7": {
    subject: paymentReminderJ7Subject,
    component: PaymentReminderJ7Email,
  },
  "payment-overdue-j1": { subject: paymentOverdueJ1Subject, component: PaymentOverdueJ1Email },
  "payment-overdue-j15": { subject: paymentOverdueJ15Subject, component: PaymentOverdueJ15Email },
  "payment-overdue-j30": { subject: paymentOverdueJ30Subject, component: PaymentOverdueJ30Email },
  "installment-overdue-soft": {
    subject: installmentOverdueSoftSubject,
    component: InstallmentOverdueSoftEmail,
  },
  "installment-overdue-firm": {
    subject: installmentOverdueFirmSubject,
    component: InstallmentOverdueFirmEmail,
  },
  "disputed-notice": {
    subject: disputedNoticeSubject,
    component: DisputedNoticeEmail,
  },
  // P1 refonte 2026-06-21 — cadrage / booking / devis (templates pleins)
  "cadrage-j1-reminder": { subject: cadrageJ1ReminderSubject, component: CadrageJ1ReminderEmail },
  "cadrage-h2-reminder": { subject: cadrageH2ReminderSubject, component: CadrageH2ReminderEmail },
  "booking-rescheduled-by-admin": {
    subject: bookingRescheduledByAdminSubject,
    component: BookingRescheduledByAdminEmail,
  },
  "booking-j1-reminder": { subject: bookingJ1ReminderSubject, component: BookingJ1ReminderEmail },
  "booking-completed-thanks": {
    subject: bookingCompletedThanksSubject,
    component: BookingCompletedThanksEmail,
  },
  "quote-reminder": { subject: quoteReminderSubject, component: QuoteReminderEmail },
  "quote-expired": { subject: quoteExpiredSubject, component: QuoteExpiredEmail },
  // Hub facturation — envois MANUELS admin (PDF joint par le worker, clé R2).
  "devis-envoi": { subject: devisEnvoiSubject, component: DevisEnvoiEmail },
  "facture-envoi": { subject: factureEnvoiSubject, component: FactureEnvoiEmail },
};

/** Tous les noms de templates email enregistrés (pour tests de couverture). */
export const EMAIL_TEMPLATE_NAMES = Object.keys(TEMPLATES) as EmailJobName[];

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export async function renderEmailTemplate(
  name: EmailJobName,
  locale: Locale,
  payload: Record<string, unknown>,
): Promise<RenderedEmail> {
  const tpl = TEMPLATES[name];
  const Component = tpl.component;
  const subject = tpl.subject(locale, payload);
  // Injecte les stats avis RÉELLES (DB, cache 15 min) dans le bandeau de confiance
  // de tous les templates, sans changer chaque template. On pose la valeur AVANT
  // chaque `render` synchrone (parcours React sync → pas d'interleave concurrent).
  const reviewStats = await getPublishedReviewStats();
  const element = <Component locale={locale} payload={payload} />;
  setReviewStats(reviewStats);
  const html = await render(element, { pretty: false });
  setReviewStats(reviewStats);
  const text = await render(element, { plainText: true });
  return { subject, html, text };
}
