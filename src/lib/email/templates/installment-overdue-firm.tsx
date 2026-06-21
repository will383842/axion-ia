// Email — Relance FERME (mais courtoise) d'une échéance d'échéancier de paiement.
//
// Contexte : le client a convenu d'un ÉCHÉANCIER (paiement échelonné) et une
// échéance reste en attente malgré une première relance. Le TON reste courtois
// et orienté solution : on rappelle que, sans règlement, l'ensemble du solde
// pourrait devenir exigible (clause de déchéance du terme), tout en PROPOSANT
// de réaménager l'échéancier en cas de difficulté.
// Paiement par VIREMENT (réf. = invoiceNumber), jamais carte/Stripe.
// Base légale citée à titre informatif et en douceur (art. L.441-10 / D.441-5).
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
    title: "Votre échéance reste en attente de règlement",
    intro: (n: string) => `Bonjour ${n},`,
    overdue: (inv: string, num: string, amount: string, due: string) =>
      `Malgré notre précédent message, l'échéance${num ? ` (${num})` : ""} de votre échéancier de paiement, d'un montant de ${amount}, échue le ${due} au titre de la facture ${inv}, demeure à ce jour en attente de règlement.`,
    consequence:
      "Nous souhaitons attirer votre attention sur un point : conformément aux conditions de votre échéancier, en l'absence de règlement, l'ensemble du solde restant pourrait devenir immédiatement exigible. Nous préférerions sincèrement éviter d'en arriver là.",
    relationship:
      "Si vous traversez une difficulté passagère de trésorerie, dites-le-nous en toute simplicité : nous restons ouverts à réaménager ensemble votre échéancier pour trouver une solution adaptée à votre situation.",
    regularize: (inv: string, deadline: string) =>
      `Pour régulariser, il vous suffit d'effectuer un virement bancaire en indiquant la référence ${inv}${deadline ? `, avant le ${deadline}` : " dans les meilleurs délais"}. Nos coordonnées bancaires (RIB) vous sont transmises sur demande, ou via le bouton ci-dessous.`,
    legal:
      "Pour information, les articles L.441-10 et D.441-5 du Code de commerce prévoient, en cas de retard, des pénalités et une indemnité forfaitaire de 40 €.",
    close:
      "Pour toute question, une difficulté, ou si ce message a croisé votre paiement, répondez simplement à cet email : nous sommes à votre écoute.\n\nBien à vous,\nL'équipe Axion-IA",
    cta: "Régler mon échéance",
  },
  en: {
    title: "Your installment is still awaiting payment",
    intro: (n: string) => `Hello ${n},`,
    overdue: (inv: string, num: string, amount: string, due: string) =>
      `Despite our previous message, the installment${num ? ` (${num})` : ""} of your payment schedule, for ${amount}, due on ${due} under invoice ${inv}, remains unpaid to date.`,
    consequence:
      "We would like to draw your attention to one point: under the terms of your payment schedule, in the absence of payment, the entire remaining balance could become immediately due. We would sincerely prefer to avoid reaching that stage.",
    relationship:
      "If you are facing a temporary cash-flow difficulty, just let us know — we remain open to rearranging your payment schedule together to find a solution suited to your situation.",
    regularize: (inv: string, deadline: string) =>
      `To settle, simply make a bank transfer quoting reference ${inv}${deadline ? `, before ${deadline}` : " as soon as possible"}. Our bank details are available on request, or via the button below.`,
    legal:
      "For information, articles L.441-10 and D.441-5 of the French Commercial Code provide for late-payment penalties and a fixed €40 indemnity in case of delay.",
    close:
      "For any question or difficulty, or if this message crossed your payment, simply reply to this email — we are here to help.\n\nWarm regards,\nThe Axion-IA team",
    cta: "Settle my installment",
  },
} as const;

export const installmentOverdueFirmSubject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const inv = field(payload as Partial<Payload>, "invoiceNumber", "");
  const suffix = inv ? ` ${inv}` : "";
  return locale === "fr"
    ? `Échéance en attente de règlement${suffix} — Axion-IA`
    : `Installment awaiting payment${suffix} — Axion-IA`;
};

export function InstallmentOverdueFirmEmail({
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
        {t.overdue(invoiceNumber, installmentNumber, amountDue, dueDate)}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{t.consequence}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.relationship}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.regularize(invoiceNumber, deadlineDate)}</Text>
      <Text
        style={{ ...emailStyles.paragraphStyle, fontSize: "13px", color: emailStyles.COLORS.textMuted }}
      >
        {t.legal}
      </Text>
      <Text style={{ ...emailStyles.paragraphStyle, whiteSpace: "pre-line" }}>{t.close}</Text>
    </EmailLayout>
  );
}
