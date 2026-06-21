// Email — Relance de paiement J7 (rappel amical AVANT / juste après échéance).
//
// Séquence d'escalade DOUCE, étape 1/4. Ton très léger : la facture arrive à
// échéance (ou vient juste d'échoir), le règlement est sans doute déjà programmé
// côté client. Aucune mention légale à ce stade. Paiement par VIREMENT
// (référence = invoiceNumber). Payload ci-dessous = forme attendue (fallbacks).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";

interface Payload {
  contactName: string;
  /** N° de la facture concernée. Ex. « F-2026-014 ». */
  invoiceNumber: string;
  /** Montant TTC dû, formaté. Ex. « 2 800,00 € ». */
  amountTtc: string;
  /** Alias accepté du montant dû (relances). Ex. « 2 800,00 € ». */
  amountOverdue?: string;
  /** Date d'échéance (formatée). Ex. « 20/05/2026 ». */
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
    title: "Petit rappel : votre facture arrive à échéance",
    intro: (n: string) => `Bonjour ${n},`,
    reminder: (inv: string, amount: string, due: string) =>
      `Un petit rappel tout simple : votre facture ${inv} d'un montant de ${amount} arrive à échéance le ${due}. Elle est sans doute déjà programmée de votre côté — auquel cas, merci, et ce message n'appelle aucune action.`,
    regularize: (inv: string, deadline: string) =>
      `Si ce n'est pas encore fait, le règlement s'effectue par simple virement bancaire en indiquant la référence ${inv}${deadline ? `, idéalement avant le ${deadline}` : ""}. Nos coordonnées bancaires (RIB) vous sont transmises sur demande, ou via le bouton ci-dessous.`,
    close:
      "Pour toute question, ou si ce message a croisé votre paiement, ignorez-le simplement ou répondez-nous : nous sommes à votre écoute.\n\nBien à vous,\nL'équipe Axion-IA",
    cta: "Régler ma facture",
  },
  en: {
    title: "A quick reminder: your invoice is coming due",
    intro: (n: string) => `Hello ${n},`,
    reminder: (inv: string, amount: string, due: string) =>
      `Just a friendly reminder: your invoice ${inv} for ${amount} is due on ${due}. It is most likely already scheduled on your side — if so, thank you, and no action is needed.`,
    regularize: (inv: string, deadline: string) =>
      `If not already done, payment is made by a simple bank transfer quoting reference ${inv}${deadline ? `, ideally before ${deadline}` : ""}. Our bank details are available on request, or via the button below.`,
    close:
      "For any question, or if this message crossed your payment, simply ignore it or reply to us — we are here to help.\n\nWarm regards,\nThe Axion-IA team",
    cta: "Settle my invoice",
  },
} as const;

export const paymentReminderJ7Subject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const inv = field(payload as Partial<Payload>, "invoiceNumber", "");
  const suffix = inv ? ` ${inv}` : "";
  return locale === "fr"
    ? `Rappel : votre facture${suffix} arrive à échéance — Axion-IA`
    : `Reminder: your invoice${suffix} is coming due — Axion-IA`;
};

export function PaymentReminderJ7Email({
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
  const amountTtc = field(
    p,
    "amountTtc",
    field(p, "amountOverdue", locale === "fr" ? "restant dû" : "outstanding"),
  );
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
      <Text style={emailStyles.paragraphStyle}>{t.reminder(invoiceNumber, amountTtc, dueDate)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.regularize(invoiceNumber, deadlineDate)}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, whiteSpace: "pre-line" }}>{t.close}</Text>
    </EmailLayout>
  );
}
