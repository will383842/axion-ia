// Email — cadrage négatif (Sprint X.6 / Booking V1).
//
// Trigger : `markCadrageHeldAction` avec decision='not_pertinent' (I7).
// Le booking passe en cadrage_declined (terminal). Refund éventuel selon CGV.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName: string;
  interventionType: string;
  notes?: string;
}

const COPY = {
  fr: {
    title: "Cadrage : intervention non retenue",
    intro: (n: string) => `Bonjour ${n},`,
    body: (i: string) =>
      `Suite à notre appel de cadrage pour l'intervention « ${i} », nous n'avons pas pu valider la pertinence du format demandé dans votre contexte actuel.`,
    notesRow: (n: string) => `Précisions : ${n}`,
    refund:
      "Aucun frais ne sera facturé. Si un acompte avait été versé, le remboursement intégral sera traité sous 5 à 10 jours ouvrés.",
    next: "N'hésitez pas à revenir vers nous si votre contexte évolue (équipe restructurée, nouveau projet IA, etc.) — nous serons ravis de refaire un point.",
    cta: "Nous écrire",
  },
  en: {
    title: "Scoping: session not retained",
    intro: (n: string) => `Hello ${n},`,
    body: (i: string) =>
      `Following our scoping call for the "${i}" session, we couldn't validate the relevance of the requested format in your current context.`,
    notesRow: (n: string) => `Details: ${n}`,
    refund:
      "No fees will be charged. If a deposit was paid, a full refund will be processed within 5 to 10 business days.",
    next: "Feel free to get back to us if your context evolves (restructured team, new AI project, etc.) — we'd be happy to revisit.",
    cta: "Contact us",
  },
} as const;

export const cadrageDeclinedSubject = (locale: Locale, _p: Record<string, unknown>): string =>
  locale === "fr" ? "Cadrage Axion-IA — non retenu" : "Axion-IA scoping — not retained";

export function CadrageDeclinedEmail({
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
      cta={{ label: t.cta, href: `${baseUrl}/${locale}/contact` }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>{t.intro(p.contactName)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.body(p.interventionType)}</Text>
      {p.notes ? <Text style={emailStyles.paragraphStyle}>{t.notesRow(p.notes)}</Text> : null}
      <Text style={emailStyles.paragraphStyle}>{t.refund}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.next}
      </Text>
    </EmailLayout>
  );
}
