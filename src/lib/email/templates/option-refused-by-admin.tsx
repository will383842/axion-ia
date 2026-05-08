// Email — option refusee par l'admin (Sprint 15 / M8 step 4).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName: string;
  bookingDate: string;
  interventionType: string;
  reason?: string;
}

const COPY = {
  fr: {
    title: "Option non retenue",
    intro: (n: string) => `Bonjour ${n},`,
    body: (d: string, i: string) =>
      `Après examen, nous n'avons pas pu valider votre option pour le ${d} (${i}). Le créneau est libéré pour d'autres demandes.`,
    reason: (r: string) => `Motif : ${r}.`,
    next: "Vous pouvez choisir un autre créneau ou nous écrire pour discuter d'alternatives. Nous restons disponibles pour vous accompagner.",
    cta: "Voir d'autres créneaux",
  },
  en: {
    title: "Option not retained",
    intro: (n: string) => `Hello ${n},`,
    body: (d: string, i: string) =>
      `After review, we couldn't validate your option for ${d} (${i}). The slot is released for other requests.`,
    reason: (r: string) => `Reason: ${r}.`,
    next: "You can choose another slot or contact us to discuss alternatives. We remain available to support you.",
    cta: "See other slots",
  },
} as const;

export const optionRefusedByAdminSubject = (locale: Locale, _p: Record<string, unknown>): string =>
  locale === "fr" ? "Option non retenue — Axion-IA" : "Option not retained — Axion-IA";

export function OptionRefusedByAdminEmail({
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
      <Text style={emailStyles.paragraphStyle}>{t.body(p.bookingDate, p.interventionType)}</Text>
      {p.reason && (
        <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
          {t.reason(p.reason)}
        </Text>
      )}
      <Text style={emailStyles.paragraphStyle}>{t.next}</Text>
    </EmailLayout>
  );
}
