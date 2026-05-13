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
