// Email — remboursement effectif (Sprint X.15).
//
// Trigger : webhook Stripe `charge.refunded` (worker BullMQ Sprint X.12).
// Notification client du remboursement comptable.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName: string;
  refundAmount: string;
  invoiceNumber: string;
  processedAt: string;
  bookingId: string;
}

const COPY = {
  fr: {
    title: "Remboursement effectué",
    intro: (n: string) => `Bonjour ${n},`,
    body: (a: string, n: string, d: string) =>
      `Nous vous confirmons le remboursement de ${a} sur la facture ${n}, traité le ${d}.`,
    next: "Selon votre banque, le crédit apparaîtra sur votre relevé sous 1 à 10 jours ouvrés. Une note d'avoir sera émise automatiquement (cf. CGV).",
    cta: "Voir mon dossier",
    refRow: (id: string) => `Référence : ${id}`,
  },
  en: {
    title: "Refund processed",
    intro: (n: string) => `Hello ${n},`,
    body: (a: string, n: string, d: string) =>
      `We confirm the refund of ${a} on invoice ${n}, processed on ${d}.`,
    next: "Depending on your bank, the credit will appear on your statement within 1 to 10 business days. A credit note will be issued automatically (cf. Terms).",
    cta: "View my file",
    refRow: (id: string) => `Reference: ${id}`,
  },
} as const;

export const refundIssuedSubject = (locale: Locale, _p: Record<string, unknown>): string =>
  locale === "fr" ? "Remboursement effectué — Axion-IA" : "Refund processed — Axion-IA";

export function RefundIssuedEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const t = COPY[locale];
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  return (
    <EmailLayout
      preview={t.title}
      title={t.title}
      cta={{ label: t.cta, href: `${baseUrl}/${locale}/mes-donnees/booking/${p.bookingId}` }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>{t.intro(p.contactName)}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {t.body(p.refundAmount, p.invoiceNumber, p.processedAt)}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{t.next}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.refRow(p.bookingId)}
      </Text>
    </EmailLayout>
  );
}
