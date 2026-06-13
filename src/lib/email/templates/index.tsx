// Router des 8 templates email × 2 locales (Sprint 15 / M8 step 4).
//
// Chaque template est un composant qui prend `locale` + `payload`. Le router
// `renderEmailTemplate(name, locale, payload)` retourne { subject, html, text }.

import { render } from "@react-email/render";
import type { ReactElement } from "react";
import type { EmailJobName } from "@/server/queue/types";
import type { Locale } from "../../../../prisma/generated/client";
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
// Sprint X.3 + X.7 + X.12 + X.13 — stubs minimaux (copy finale livrée Sprint X.13)
import {
  contractVersionUpdated,
  contractSent,
  contractSigned,
  contractRefused,
  contractReminder,
  cadrageJ1Reminder,
  cadrageH2Reminder,
  paymentReminderJ7,
  paymentOverdueJ1,
  paymentOverdueJ15,
  paymentOverdueJ30,
  installmentOverdueSoft,
  installmentOverdueFirm,
  disputedNotice,
  bookingRescheduledByAdmin,
  bookingJ1Reminder,
  bookingCompletedThanks,
  quoteReminder,
  quoteExpired,
} from "./_pending-templates";

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
  // Sprint X.3 / X.7 / X.12 / X.13 — stubs (copy finale Sprint X.13 dédié)
  "contract-version-updated": contractVersionUpdated,
  "contract-sent": contractSent,
  "contract-signed": contractSigned,
  "contract-refused": contractRefused,
  "contract-reminder": contractReminder,
  "cadrage-j1-reminder": cadrageJ1Reminder,
  "cadrage-h2-reminder": cadrageH2Reminder,
  "payment-reminder-j7": paymentReminderJ7,
  "payment-overdue-j1": paymentOverdueJ1,
  "payment-overdue-j15": paymentOverdueJ15,
  "payment-overdue-j30": paymentOverdueJ30,
  "installment-overdue-soft": installmentOverdueSoft,
  "installment-overdue-firm": installmentOverdueFirm,
  "disputed-notice": disputedNotice,
  "booking-rescheduled-by-admin": bookingRescheduledByAdmin,
  "booking-j1-reminder": bookingJ1Reminder,
  "booking-completed-thanks": bookingCompletedThanks,
  "quote-reminder": quoteReminder,
  "quote-expired": quoteExpired,
};

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
  const element = <Component locale={locale} payload={payload} />;
  const html = await render(element, { pretty: false });
  const text = await render(element, { plainText: true });
  return { subject, html, text };
}
