// Email — accuse reception contact (Sprint 15 / M8 step 4).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName: string;
  submissionId: string;
}

const COPY = {
  fr: {
    title: "Message bien reçu",
    intro: (n: string) => `Bonjour ${n},`,
    body: "Nous avons bien reçu votre message. Notre équipe revient vers vous sous 48 heures ouvrées.",
    // 🔴 Corrigé le 2026-08-16. Le texte promettait « notre calendrier de
    // réservation » et le bouton disait « Voir le calendrier » — alors que le
    // site n'expose pas de calendrier public, mais une page de réservation
    // d'appel. Changer la destination sans changer le libellé aurait laissé la
    // moitié du défaut : un bouton qui annonce autre chose que ce qu'il ouvre.
    next: "Pour les sujets urgents (intervention sous 7 jours), réservez directement un appel avec nous.",
    cta: "Réserver un appel",
    refRow: (id: string) => `Référence : ${id}`,
  },
  en: {
    title: "Message received",
    intro: (n: string) => `Hello ${n},`,
    body: "We received your message. Our team gets back to you within 48 working hours.",
    next: "For urgent topics (session within 7 days), book a call with us directly.",
    cta: "Book a call",
    refRow: (id: string) => `Reference: ${id}`,
  },
} as const;

export const contactConfirmedSubject = (locale: Locale, _p: Record<string, unknown>): string =>
  locale === "fr" ? "Message bien reçu — Axion-IA" : "Message received — Axion-IA";

export function ContactConfirmedEmail({
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
      // 🔴 Corrigé le 2026-08-16 : le bouton « Voir le calendrier » pointait sur
      // `/interventions`, une page de présentation des prestations — pas un
      // calendrier. Un destinataire qui suivait la promesse du texte (« passez
      // directement par notre calendrier de réservation ») atterrissait sur
      // autre chose. La page de réservation du site est `/appel`.
      cta={{ label: t.cta, href: `${baseUrl}/${locale === "en" ? "en/book-a-call" : "fr/appel"}` }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>{t.intro(p.contactName)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.body}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.next}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.refRow(p.submissionId)}
      </Text>
    </EmailLayout>
  );
}
