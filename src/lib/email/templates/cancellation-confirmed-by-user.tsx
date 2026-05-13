// Email — confirmation annulation self-service (Sprint X.15).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName: string;
  cancellationWindow: "more_than_15d" | "between_15d_and_2d" | "less_than_2d";
  refundPercentage: number;
  bookingId: string;
}

const COPY = {
  fr: {
    title: "Annulation confirmée",
    intro: (n: string) => `Bonjour ${n},`,
    body: "Nous confirmons l'annulation de votre intervention. Aucun débit supplémentaire ne sera effectué.",
    refundYes: (p: number) =>
      `Remboursement de l'acompte : ${p} %. Traitement sous 5 à 10 jours ouvrés sur le moyen de paiement initial.`,
    refundNo: "Conformément à nos CGV, l'acompte est conservé pour cette fenêtre d'annulation.",
    next: "Vous pouvez revenir vers nous à tout moment pour planifier une nouvelle intervention.",
    cta: "Voir nos formats",
    refRow: (id: string) => `Référence : ${id}`,
  },
  en: {
    title: "Cancellation confirmed",
    intro: (n: string) => `Hello ${n},`,
    body: "We confirm the cancellation of your session. No further charges will be made.",
    refundYes: (p: number) =>
      `Deposit refund: ${p}%. Processed within 5 to 10 business days to the original payment method.`,
    refundNo: "Per our Terms, the deposit is retained for this cancellation window.",
    next: "You can come back to us anytime to schedule a new session.",
    cta: "See our formats",
    refRow: (id: string) => `Reference: ${id}`,
  },
} as const;

export const cancellationConfirmedByUserSubject = (
  locale: Locale,
  _p: Record<string, unknown>,
): string =>
  locale === "fr" ? "Annulation confirmée — Axion-IA" : "Cancellation confirmed — Axion-IA";

export function CancellationConfirmedByUserEmail({
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
      cta={{ label: t.cta, href: `${baseUrl}/${locale}/interventions` }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>{t.intro(p.contactName)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.body}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {p.refundPercentage > 0 ? t.refundYes(p.refundPercentage) : t.refundNo}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{t.next}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.refRow(p.bookingId)}
      </Text>
    </EmailLayout>
  );
}
