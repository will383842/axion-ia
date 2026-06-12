// Email — confirmation cadrage planifié (Sprint X.6 / Booking V1).
//
// Trigger : `scheduleCadrageMeetingAction`. Contient la date/heure, durée,
// lien visio si fourni. Le `.ics` est attaché côté worker BullMQ (Sprint X.12).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName: string;
  interventionType: string;
  scheduledAt: string;
  durationMinutes: number;
  visioUrl: string | null;
  cadrageId: string;
}

const COPY = {
  fr: {
    title: "Cadrage planifié",
    intro: (n: string) => `Bonjour ${n},`,
    body: (i: string, d: string, t: string, dur: number) =>
      `Votre appel de cadrage pour l'intervention « ${i} » est planifié le ${d} à ${t} (durée prévue ${dur} min).`,
    visioRow: (u: string) => `Lien visio : ${u}`,
    visioPending: "Le lien visio vous sera envoyé séparément par Williams avant la date prévue.",
    nextPrep:
      "Préparez 2-3 questions concrètes sur ce que vous attendez de l'intervention. Le cadrage sert à valider la pertinence et préparer le contenu.",
    cta: "Ajouter à mon calendrier",
    refRow: (id: string) => `Référence : ${id}`,
  },
  en: {
    title: "Scoping call scheduled",
    intro: (n: string) => `Hello ${n},`,
    body: (i: string, d: string, t: string, dur: number) =>
      `Your scoping call for the "${i}" session is scheduled on ${d} at ${t} (expected duration ${dur} min).`,
    visioRow: (u: string) => `Video link: ${u}`,
    visioPending: "The video link will be sent separately by Williams before the scheduled date.",
    nextPrep:
      "Prepare 2-3 concrete questions about what you expect from the session. The call validates fit and prepares the content.",
    cta: "Add to my calendar",
    refRow: (id: string) => `Reference: ${id}`,
  },
} as const;

export const cadrageScheduledSubject = (locale: Locale, _p: Record<string, unknown>): string =>
  locale === "fr" ? "Cadrage Axion-IA planifié" : "Axion-IA scoping call scheduled";

export function CadrageScheduledEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const t = COPY[locale];
  const date = new Date(p.scheduledAt);
  const isoDate = date.toISOString().slice(0, 10);
  const isoTime = date.toISOString().slice(11, 16);
  // CTA pointe sur Google Calendar URL (importable sans .ics). Pour le .ics
  // attachment réel, le worker BullMQ (Sprint X.12) le générera via
  // ics-generator.ts et l'attachera à l'envoi.
  const start = date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const end = new Date(date.getTime() + p.durationMinutes * 60_000)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const ctaUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=Cadrage+Axion-IA&dates=${start}/${end}${p.visioUrl ? `&location=${encodeURIComponent(p.visioUrl)}` : ""}`;
  return (
    <EmailLayout
      preview={t.title}
      title={t.title}
      cta={{ label: t.cta, href: ctaUrl }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>{t.intro(p.contactName)}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {t.body(p.interventionType, isoDate, isoTime, p.durationMinutes)}
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        {p.visioUrl ? t.visioRow(p.visioUrl) : t.visioPending}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{t.nextPrep}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.refRow(p.cadrageId)}
      </Text>
    </EmailLayout>
  );
}
