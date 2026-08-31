// Email — reçu de paiement (Sprint X.13 / Booking V1).
//
// Trigger : webhook Stripe `checkout.session.completed`. Confirmation
// paiement acompte ou solde.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName: string;
  invoiceNumber: string;
  amountTtc: string;
  paidAt: string;
  paymentType: "deposit" | "balance" | "installment";
  bookingId: string;
}

const COPY = {
  fr: {
    title: "Paiement reçu",
    preview: (a: string) => `${a} encaissés. Ce message vaut reçu — à conserver.`,
    intro: (n: string) => `Bonjour ${n},`,
    body: (n: string, a: string, d: string) =>
      `Nous avons bien reçu votre paiement de ${a} pour la facture ${n} le ${d}. Merci.`,
    nextDeposit:
      "Vous recevrez prochainement un email de validation par Williams, puis votre intervention sera officiellement verrouillée dans le calendrier.",
    nextBalance:
      "Toutes les opérations sont soldées. Votre dossier passe en archives administratives sous 30 jours.",
    nextInstallment: "L'échéance suivante sera facturée selon votre échéancier convenu.",
    cta: "Voir mon dossier",
  },
  en: {
    title: "Payment received",
    preview: (a: string) => `${a} received. This message is your receipt — keep it.`,
    intro: (n: string) => `Hello ${n},`,
    body: (n: string, a: string, d: string) =>
      `We received your payment of ${a} for invoice ${n} on ${d}. Thank you.`,
    nextDeposit:
      "You'll soon receive a final validation email from Williams, after which your session will be officially locked in the calendar.",
    nextBalance:
      "All operations are settled. Your file will move to administrative archives within 30 days.",
    nextInstallment: "The next installment will be billed according to your agreed schedule.",
    cta: "View my file",
  },
} as const;

export const paymentReceiptSubject = (locale: Locale, p: Record<string, unknown>): string => {
  const n = (p as unknown as Payload).invoiceNumber;
  return locale === "fr" ? `Paiement reçu — ${n}` : `Payment received — ${n}`;
};

export function PaymentReceiptEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const t = COPY[locale];
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const next =
    p.paymentType === "deposit"
      ? t.nextDeposit
      : p.paymentType === "balance"
        ? t.nextBalance
        : t.nextInstallment;
  return (
    <EmailLayout
      famille="A"
      preview={t.preview(p.amountTtc)}
      title={t.title}
      cta={{ label: t.cta, href: `${baseUrl}/${locale}/mes-donnees/booking/${p.bookingId}` }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>
        {t.body(p.invoiceNumber, p.amountTtc, p.paidAt)}
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        {t.intro(p.contactName)} {next}
      </Text>
    </EmailLayout>
  );
}
