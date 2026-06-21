// Email — Relance de paiement J+1 (lendemain de l'échéance).
//
// Séquence d'escalade DOUCE, étape 2/4. Ton chaleureux, oubli présumé de bonne
// foi : « sauf erreur, votre paiement ne nous est pas encore parvenu, sans doute
// un simple oubli ». Aucune mention légale à ce stade. Paiement par VIREMENT
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
    title: "Votre facture vient d'arriver à échéance",
    intro: (n: string) => `Bonjour ${n},`,
    oversight: (inv: string, amount: string, due: string) =>
      `Sauf erreur de notre part, le règlement de votre facture ${inv} d'un montant de ${amount}, échue hier (${due}), ne nous est pas encore parvenu. Il s'agit très probablement d'un simple oubli, et nous n'avons aucun doute sur votre bonne foi.`,
    regularize: (inv: string, deadline: string) =>
      `Pour régulariser, il vous suffit d'effectuer un virement bancaire en indiquant la référence ${inv}${deadline ? `, idéalement avant le ${deadline}` : ""}. Nos coordonnées bancaires (RIB) vous sont transmises sur demande, ou via le bouton ci-dessous.`,
    close:
      "Pour toute question, une difficulté, ou si ce message a croisé votre paiement, répondez simplement à cet email : nous sommes à votre écoute.\n\nBien à vous,\nL'équipe Axion-IA",
    cta: "Régler ma facture",
  },
  en: {
    title: "Your invoice has just reached its due date",
    intro: (n: string) => `Hello ${n},`,
    oversight: (inv: string, amount: string, due: string) =>
      `Unless we are mistaken, payment of your invoice ${inv} for ${amount}, due yesterday (${due}), has not yet reached us. This is very likely a simple oversight, and we have no doubt about your good faith.`,
    regularize: (inv: string, deadline: string) =>
      `To settle, simply make a bank transfer quoting reference ${inv}${deadline ? `, ideally before ${deadline}` : ""}. Our bank details are available on request, or via the button below.`,
    close:
      "For any question or difficulty, or if this message crossed your payment, simply reply to this email — we are here to help.\n\nWarm regards,\nThe Axion-IA team",
    cta: "Settle my invoice",
  },
} as const;

export const paymentOverdueJ1Subject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const inv = field(payload as Partial<Payload>, "invoiceNumber", "");
  const suffix = inv ? ` ${inv}` : "";
  return locale === "fr"
    ? `Votre facture${suffix} arrivée à échéance — Axion-IA`
    : `Your invoice${suffix} now due — Axion-IA`;
};

export function PaymentOverdueJ1Email({
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
      <Text style={emailStyles.paragraphStyle}>
        {t.oversight(invoiceNumber, amountTtc, dueDate)}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{t.regularize(invoiceNumber, deadlineDate)}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, whiteSpace: "pre-line" }}>{t.close}</Text>
    </EmailLayout>
  );
}
