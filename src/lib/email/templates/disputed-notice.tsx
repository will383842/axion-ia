// Email — Facture en attente de règlement (relance ferme mais RELATION-CLIENT).
//
// Email sensible : il intervient après des relances restées sans réponse, mais
// le TON reste chaleureux et orienté solution (oubli présumé de bonne foi,
// proposition d'échéancier, conséquence évoquée en dernier recours seulement).
// Paiement par VIREMENT (pas de carte/Stripe). Base légale citée à titre
// informatif et en douceur (art. L.441-10 / D.441-5 C. com.).
//
// `disputed-notice` est déclaré dans EmailJobName mais PAS encore enqueué :
// il ne part jamais automatiquement. Il sera déclenché par un bouton admin
// (envoi décidé au cas par cas). Payload ci-dessous = forme attendue (fallbacks).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";

interface Payload {
  contactName: string;
  /** N° de la facture impayée. Ex. « F-2026-014 ». */
  invoiceNumber: string;
  /** Montant dû, formaté. Ex. « 2 800,00 € ». */
  amountOverdue: string;
  /** Date d'échéance d'origine (formatée). Ex. « 20/05/2026 ». */
  dueDate: string;
  /** Nombre de jours de retard. Optionnel. */
  daysOverdue?: string | number;
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
    title: "Votre facture en attente de règlement",
    intro: (n: string) => `Bonjour ${n},`,
    oversight: (inv: string, amount: string, due: string, days: string) =>
      `Sauf erreur de notre part, votre facture ${inv} d'un montant de ${amount}, échue le ${due}${days ? ` (${days} jours)` : ""}, ne nous est pas encore parvenue. Il s'agit sans doute d'un simple oubli.`,
    relationship:
      "Nous tenons à notre collaboration et préférons trouver une solution ensemble. Si vous traversez une difficulté passagère de trésorerie, dites-le-nous en toute simplicité : nous pouvons convenir d'un échéancier adapté.",
    regularize: (inv: string, deadline: string) =>
      `Pour régulariser, il vous suffit d'effectuer un virement bancaire en indiquant la référence ${inv}${deadline ? `, idéalement avant le ${deadline}` : ""}. Nos coordonnées bancaires (RIB) vous sont transmises sur demande, ou via le bouton ci-dessous.`,
    consequence:
      "À défaut de réponse de votre part, et pour rester en règle, nous serions amenés à confier ce dossier à notre service de recouvrement — une étape que nous préférons sincèrement éviter.",
    legal:
      "Pour information, les articles L.441-10 et D.441-5 du Code de commerce prévoient, en cas de retard, des pénalités et une indemnité forfaitaire de 40 €.",
    close:
      "Pour toute question, une difficulté, ou si ce message a croisé votre paiement, répondez simplement à cet email : nous sommes à votre écoute.\n\nBien à vous,\nL'équipe Axion-IA",
    cta: "Régler ma facture",
  },
  en: {
    title: "Your invoice awaiting payment",
    intro: (n: string) => `Hello ${n},`,
    oversight: (inv: string, amount: string, due: string, days: string) =>
      `Unless we are mistaken, your invoice ${inv} for ${amount}, due on ${due}${days ? ` (${days} days ago)` : ""}, has not yet reached us. It is most likely a simple oversight.`,
    relationship:
      "We value our collaboration and would rather find a solution together. If you are facing a temporary cash-flow difficulty, just let us know — we can arrange a suitable payment schedule.",
    regularize: (inv: string, deadline: string) =>
      `To settle, simply make a bank transfer quoting reference ${inv}${deadline ? `, ideally before ${deadline}` : ""}. Our bank details are available on request, or via the button below.`,
    consequence:
      "Without a reply from you, and to remain compliant, we would have to refer this file to our debt-recovery service — a step we would sincerely prefer to avoid.",
    legal:
      "For information, articles L.441-10 and D.441-5 of the French Commercial Code provide for late-payment penalties and a fixed €40 indemnity in case of delay.",
    close:
      "For any question or difficulty, or if this message crossed your payment, simply reply to this email — we are here to help.\n\nWarm regards,\nThe Axion-IA team",
    cta: "Settle my invoice",
  },
} as const;

export const disputedNoticeSubject = (locale: Locale, payload: Record<string, unknown>): string => {
  const inv = field(payload as Partial<Payload>, "invoiceNumber", "");
  const suffix = inv ? ` ${inv}` : "";
  return locale === "fr"
    ? `Votre facture${suffix} en attente de règlement — Axion-IA`
    : `Your invoice${suffix} awaiting payment — Axion-IA`;
};

export function DisputedNoticeEmail({
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
  const amountOverdue = field(p, "amountOverdue", locale === "fr" ? "restant dû" : "outstanding");
  const dueDate = field(p, "dueDate", locale === "fr" ? "son échéance" : "its due date");
  const daysOverdue = field(p, "daysOverdue", "");
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
        {t.oversight(invoiceNumber, amountOverdue, dueDate, daysOverdue)}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{t.relationship}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.regularize(invoiceNumber, deadlineDate)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.consequence}</Text>
      <Text
        style={{
          ...emailStyles.paragraphStyle,
          fontSize: "13px",
          color: emailStyles.COLORS.textMuted,
        }}
      >
        {t.legal}
      </Text>
      <Text style={{ ...emailStyles.paragraphStyle, whiteSpace: "pre-line" }}>{t.close}</Text>
    </EmailLayout>
  );
}
