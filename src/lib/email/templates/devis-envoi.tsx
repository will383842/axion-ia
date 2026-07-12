// Email — envoi MANUEL d'un devis par l'admin (Hub facturation), PDF joint.
//
// Déclenché exclusivement par un clic admin (envoyerDevisEmailAction) — JAMAIS
// par un cron. Le PDF du devis est attaché par le worker (clé R2 dans
// EmailJobData.attachments). Le message personnalisé de l'admin (multi-lignes)
// est affiché tel quel. Ton : courtois, zéro pression.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  clientNom: string;
  /** N° du devis. Ex. « AXI-DEV-2026-014 ». */
  numero: string;
  /** Montant formaté. Ex. « 2 450,00 € HT ». Optionnel. */
  montantLabel?: string;
  /** Date de validité formatée. Ex. « 11/08/2026 ». Optionnelle. */
  dateValiditeLabel?: string;
  /** Message libre de l'admin (multi-lignes, affiché tel quel). Optionnel. */
  messagePersonnalise?: string;
}

function field(p: Partial<Payload>, key: keyof Payload, fallback: string): string {
  const v = p[key];
  return v === undefined || v === null || `${v}`.trim() === "" ? fallback : `${v}`;
}

const COPY = {
  fr: {
    title: "Votre devis Axion-IA",
    intro: (n: string) => (n ? `Bonjour ${n},` : "Bonjour,"),
    body: (num: string, montant: string) =>
      `Veuillez trouver ci-joint votre devis ${num}${montant ? ` d'un montant de ${montant}` : ""}, au format PDF.`,
    validity: (d: string) => (d ? `Il est valable jusqu'au ${d}.` : ""),
    attachment: "Le document est joint à cet email au format PDF.",
    questions:
      "Pour toute question sur le contenu, le périmètre ou les modalités, répondez simplement à cet email : nous sommes à votre écoute.",
    close: "Bien cordialement,\nL'équipe Axion-IA",
  },
  en: {
    title: "Your Axion-IA quote",
    intro: (n: string) => (n ? `Hello ${n},` : "Hello,"),
    body: (num: string, montant: string) =>
      `Please find attached your quote ${num}${montant ? ` for ${montant}` : ""}, in PDF format.`,
    validity: (d: string) => (d ? `It is valid until ${d}.` : ""),
    attachment: "The document is attached to this email in PDF format.",
    questions:
      "For any question about the content, scope or terms, simply reply to this email: we are here for you.",
    close: "Best regards,\nThe Axion-IA team",
  },
} as const;

export const devisEnvoiSubject = (locale: Locale, payload: Record<string, unknown>): string => {
  const num = field(payload as Partial<Payload>, "numero", "");
  return locale === "fr" ? `Votre devis ${num} — Axion-IA` : `Your quote ${num} — Axion-IA`;
};

export function DevisEnvoiEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as Partial<Payload>;
  const t = COPY[locale];
  const message = field(p, "messagePersonnalise", "");

  return (
    <EmailLayout locale={locale} title={t.title} preview={devisEnvoiSubject(locale, payload)}>
      <Text style={emailStyles.paragraphStyle}>{t.intro(field(p, "clientNom", ""))}</Text>
      {message !== "" &&
        message.split("\n").map((line, i) => (
          <Text key={i} style={emailStyles.paragraphStyle}>
            {line}
          </Text>
        ))}
      <Text style={emailStyles.paragraphStyle}>
        {t.body(field(p, "numero", ""), field(p, "montantLabel", ""))}{" "}
        {t.validity(field(p, "dateValiditeLabel", ""))}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{t.attachment}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.questions}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {t.close.split("\n").map((line, i) => (
          <span key={i}>
            {line}
            <br />
          </span>
        ))}
      </Text>
    </EmailLayout>
  );
}
