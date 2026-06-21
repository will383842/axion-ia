// Email — Relance DOUCE d'une échéance d'échéancier de paiement.
//
// Contexte : le client a convenu d'un ÉCHÉANCIER (paiement échelonné) et une
// échéance reste en attente. Ce message est un rappel BIENVEILLANT (oubli
// présumé de bonne foi), orienté solution, qui propose de l'aide.
// Paiement par VIREMENT (réf. = invoiceNumber), jamais carte/Stripe.
// Pas de base légale ici (réservée à la version « firm »).
//
// Payload ci-dessous = forme attendue (avec fallbacks robustes).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";

interface Payload {
  contactName: string;
  /** N° de la facture liée à l'échéancier. Ex. « F-2026-014 ». */
  invoiceNumber: string;
  /** N° de l'échéance dans l'échéancier. Ex. « 2/4 ». Optionnel. */
  installmentNumber?: string;
  /** Montant de l'échéance due, formaté. Ex. « 700,00 € ». */
  amountDue: string;
  /** Date d'échéance d'origine (formatée). Ex. « 20/05/2026 ». */
  dueDate: string;
  /** Date limite souhaitée de régularisation. Optionnelle. */
  deadlineDate?: string;
  /** URL pour régler / obtenir le RIB. Défaut : page contact. */
  regularizeUrl?: string;
}

function field(p: Partial<Payload>, key: keyof Payload, fallback: string): string {
  const v = p[key];
  return v === undefined || v === null || `${v}`.trim() === "" ? fallback : `${v}`;
}

const COPY = {
  fr: {
    title: "Un petit rappel concernant votre échéancier",
    intro: (n: string) => `Bonjour ${n},`,
    oversight: (inv: string, num: string, amount: string, due: string) =>
      `Sauf erreur de notre part, une échéance${num ? ` (${num})` : ""} de votre échéancier de paiement, d'un montant de ${amount}, échue le ${due} au titre de la facture ${inv}, ne nous est pas encore parvenue. Il s'agit sans doute d'un simple oubli.`,
    relationship:
      "Aucune inquiétude : nous tenons à notre collaboration et préférons toujours avancer ensemble. Si vous avez besoin de quoi que ce soit pour régler cette échéance, dites-le-nous simplement.",
    regularize: (inv: string, deadline: string) =>
      `Pour la régulariser, il vous suffit d'effectuer un virement bancaire en indiquant la référence ${inv}${deadline ? `, idéalement avant le ${deadline}` : ""}. Nos coordonnées bancaires (RIB) vous sont transmises sur demande, ou via le bouton ci-dessous.`,
    close:
      "Pour toute question, ou si ce message a croisé votre paiement, répondez simplement à cet email : nous sommes à votre écoute.\n\nBien à vous,\nL'équipe Axion-IA",
    cta: "Régler mon échéance",
  },
  en: {
    title: "A friendly reminder about your payment schedule",
    intro: (n: string) => `Hello ${n},`,
    oversight: (inv: string, num: string, amount: string, due: string) =>
      `Unless we are mistaken, one installment${num ? ` (${num})` : ""} of your payment schedule, for ${amount}, due on ${due} under invoice ${inv}, has not yet reached us. It is most likely a simple oversight.`,
    relationship:
      "No worries at all: we value our collaboration and always prefer to move forward together. If there is anything you need in order to settle this installment, just let us know.",
    regularize: (inv: string, deadline: string) =>
      `To settle it, simply make a bank transfer quoting reference ${inv}${deadline ? `, ideally before ${deadline}` : ""}. Our bank details are available on request, or via the button below.`,
    close:
      "For any question, or if this message crossed your payment, simply reply to this email — we are here to help.\n\nWarm regards,\nThe Axion-IA team",
    cta: "Settle my installment",
  },
} as const;

export const installmentOverdueSoftSubject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const inv = field(payload as Partial<Payload>, "invoiceNumber", "");
  const suffix = inv ? ` ${inv}` : "";
  return locale === "fr"
    ? `Rappel — échéance en attente${suffix} — Axion-IA`
    : `Reminder — installment pending${suffix} — Axion-IA`;
};

export function InstallmentOverdueSoftEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as Partial<Payload>;
  const t = COPY[locale];

  const contactName = field(p, "contactName", "");
  const invoiceNumber = field(p, "invoiceNumber", locale === "fr" ? "concernée" : "concerned");
  const installmentNumber = field(p, "installmentNumber", "");
  const amountDue = field(p, "amountDue", locale === "fr" ? "restant dû" : "outstanding");
  const dueDate = field(p, "dueDate", locale === "fr" ? "son échéance" : "its due date");
  const deadlineDate = field(p, "deadlineDate", "");
  const regularizeUrl = field(p, "regularizeUrl", `${SITE_URL}/contact`);

  const greeting = contactName ? t.intro(contactName) : locale === "fr" ? "Bonjour," : "Hello,";

  return (
    <EmailLayout
      preview={t.title}
      title={t.title}
      cta={{ label: t.cta, href: regularizeUrl }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>{greeting}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {t.oversight(invoiceNumber, installmentNumber, amountDue, dueDate)}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{t.relationship}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.regularize(invoiceNumber, deadlineDate)}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, whiteSpace: "pre-line" }}>{t.close}</Text>
    </EmailLayout>
  );
}
