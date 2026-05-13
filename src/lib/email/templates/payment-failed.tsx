// Email — échec de paiement (Sprint X.13 / Booking V1).
//
// Trigger : webhook Stripe `payment_intent.payment_failed`. Le slot reste
// pré-réservé, le client est invité à retenter via un nouveau Checkout.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName: string;
  invoiceNumber: string;
  amountTtc: string;
  reasonCode?: string;
  retryUrl?: string;
}

const COPY = {
  fr: {
    title: "Paiement non abouti",
    intro: (n: string) => `Bonjour ${n},`,
    body: (n: string, a: string) =>
      `Le paiement de ${a} pour la facture ${n} n'a pas pu aboutir. Aucun débit n'a été effectué sur votre compte.`,
    reasonGeneric:
      "La cause peut être un solde insuffisant, une carte expirée, ou un refus 3D Secure.",
    nextRetry:
      "Vous pouvez réessayer via le bouton ci-dessous. Si le problème persiste, contactez votre banque ou répondez à cet email.",
    nextContact: "Le créneau reste pré-réservé pendant 48 h le temps que vous régliez le paiement.",
    cta: "Réessayer le paiement",
    ctaContact: "Nous contacter",
  },
  en: {
    title: "Payment failed",
    intro: (n: string) => `Hello ${n},`,
    body: (n: string, a: string) =>
      `The payment of ${a} for invoice ${n} could not be completed. No debit was made on your account.`,
    reasonGeneric: "The cause may be insufficient funds, an expired card, or a 3D Secure refusal.",
    nextRetry:
      "You can retry via the button below. If the problem persists, contact your bank or reply to this email.",
    nextContact: "The slot remains pre-reserved for 48 h while you process the payment.",
    cta: "Retry payment",
    ctaContact: "Contact us",
  },
} as const;

export const paymentFailedSubject = (locale: Locale, p: Record<string, unknown>): string => {
  const n = (p as unknown as Payload).invoiceNumber;
  return locale === "fr"
    ? `Paiement non abouti — ${n} — Axion-IA`
    : `Payment failed — ${n} — Axion-IA`;
};

export function PaymentFailedEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const t = COPY[locale];
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const cta = p.retryUrl
    ? { label: t.cta, href: p.retryUrl }
    : { label: t.ctaContact, href: `${baseUrl}/${locale}/contact` };
  return (
    <EmailLayout preview={t.title} title={t.title} cta={cta} locale={locale}>
      <Text style={emailStyles.paragraphStyle}>{t.intro(p.contactName)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.body(p.invoiceNumber, p.amountTtc)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.reasonGeneric}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.nextRetry}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.nextContact}
      </Text>
    </EmailLayout>
  );
}
