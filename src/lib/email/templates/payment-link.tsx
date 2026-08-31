// Email — lien de paiement Stripe Checkout (Sprint X.13 / Booking V1).
//
// Trigger : Will clic 1 "Envoi contrat + demande acompte" (X.4
// sendContractAndDepositRequestAction). Email envoyé au client avec l'URL
// Stripe Checkout pour payer l'acompte.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName: string;
  invoiceNumber: string;
  amountTtc: string;
  checkoutUrl: string;
  expiresAt: string;
}

const COPY = {
  fr: {
    title: "Lien de paiement acompte",
    preview: (a: string) => `${a} à régler par carte — paiement sécurisé Stripe.`,
    intro: (n: string) => `Bonjour ${n},`,
    body: (n: string, a: string) =>
      `Votre facture d'acompte ${n} pour ${a} est prête. Cliquez sur le bouton ci-dessous pour régler en ligne par carte bancaire (paiement sécurisé Stripe).`,
    expires: (d: string) =>
      `Lien valable jusqu'au ${d}. Au-delà, l'admin générera un nouveau lien.`,
    cta: "Payer l'acompte",
  },
  en: {
    title: "Deposit payment link",
    preview: (a: string) => `${a} to pay by card — secure Stripe payment.`,
    intro: (n: string) => `Hello ${n},`,
    body: (n: string, a: string) =>
      `Your deposit invoice ${n} for ${a} is ready. Click the button below to pay online by card (secure Stripe payment).`,
    expires: (d: string) => `Link valid until ${d}. After that, the admin will generate a new one.`,
    cta: "Pay deposit",
  },
} as const;

export const paymentLinkSubject = (locale: Locale, p: Record<string, unknown>): string => {
  const n = (p as unknown as Payload).invoiceNumber;
  return locale === "fr" ? `Lien de paiement acompte — ${n}` : `Deposit payment link — ${n}`;
};

export function PaymentLinkEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const t = COPY[locale];
  return (
    <EmailLayout
      famille="A"
      preview={t.preview(p.amountTtc)}
      title={t.title}
      cta={{ label: t.cta, href: p.checkoutUrl }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>{t.body(p.invoiceNumber, p.amountTtc)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.intro(p.contactName)}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.expires(p.expiresAt)}
      </Text>
    </EmailLayout>
  );
}
