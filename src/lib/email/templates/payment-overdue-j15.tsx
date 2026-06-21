// Email — Relance de paiement J+15 (un peu plus ferme, toujours bienveillant).
//
// Séquence d'escalade DOUCE, étape 3/4. Ton plus appuyé mais chaleureux :
// la facture reste impayée 15 jours après l'échéance, on PROPOSE un échéancier
// en cas de difficulté de trésorerie. Base légale (art. L.441-10 / D.441-5
// C. com.) citée À TITRE INFORMATIF et en style muted (13px, textMuted).
// Paiement par VIREMENT (référence = invoiceNumber).
// Payload ci-dessous = forme attendue (fallbacks).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";

interface Payload {
  contactName: string;
  /** N° de la facture impayée. Ex. « F-2026-014 ». */
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
    title: "Votre facture reste à régler",
    intro: (n: string) => `Bonjour ${n},`,
    status: (inv: string, amount: string, due: string, days: string) =>
      `Nous revenons vers vous au sujet de votre facture ${inv} d'un montant de ${amount}, échue le ${due}${days ? ` (${days} jours de retard)` : ""} et toujours en attente de règlement. Malgré nos précédents messages, nous n'avons pas encore reçu votre paiement.`,
    relationship:
      "Nous tenons à notre collaboration et préférons sincèrement trouver une solution ensemble. Si vous traversez une difficulté passagère de trésorerie, dites-le-nous en toute simplicité : nous pouvons convenir d'un échéancier adapté, sans complication.",
    regularize: (inv: string, deadline: string) =>
      `Pour régulariser, il vous suffit d'effectuer un virement bancaire en indiquant la référence ${inv}${deadline ? `, dans la mesure du possible avant le ${deadline}` : ""}. Nos coordonnées bancaires (RIB) vous sont transmises sur demande, ou via le bouton ci-dessous.`,
    legal:
      "Pour information : les articles L.441-10 et D.441-5 du Code de commerce prévoient, en cas de retard de paiement, des pénalités de retard ainsi qu'une indemnité forfaitaire de recouvrement de 40 €.",
    close:
      "Pour toute question, une difficulté, ou si ce message a croisé votre paiement, répondez simplement à cet email : nous trouverons ensemble la meilleure solution.\n\nBien à vous,\nL'équipe Axion-IA",
    cta: "Régler ma facture",
  },
  en: {
    title: "Your invoice is still pending payment",
    intro: (n: string) => `Hello ${n},`,
    status: (inv: string, amount: string, due: string, days: string) =>
      `We are reaching out again regarding your invoice ${inv} for ${amount}, due on ${due}${days ? ` (${days} days overdue)` : ""} and still awaiting payment. Despite our previous messages, we have not yet received your payment.`,
    relationship:
      "We value our collaboration and would sincerely rather find a solution together. If you are facing a temporary cash-flow difficulty, just let us know — we can arrange a suitable payment schedule, with no complication.",
    regularize: (inv: string, deadline: string) =>
      `To settle, simply make a bank transfer quoting reference ${inv}${deadline ? `, where possible before ${deadline}` : ""}. Our bank details are available on request, or via the button below.`,
    legal:
      "For information: articles L.441-10 and D.441-5 of the French Commercial Code provide, in case of late payment, for late-payment penalties as well as a fixed €40 recovery indemnity.",
    close:
      "For any question or difficulty, or if this message crossed your payment, simply reply to this email — we will find the best solution together.\n\nWarm regards,\nThe Axion-IA team",
    cta: "Settle my invoice",
  },
} as const;

export const paymentOverdueJ15Subject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const inv = field(payload as Partial<Payload>, "invoiceNumber", "");
  const suffix = inv ? ` ${inv}` : "";
  return locale === "fr"
    ? `Votre facture${suffix} reste à régler — Axion-IA`
    : `Your invoice${suffix} is still pending — Axion-IA`;
};

export function PaymentOverdueJ15Email({
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
        {t.status(invoiceNumber, amountTtc, dueDate, daysOverdue)}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{t.relationship}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.regularize(invoiceNumber, deadlineDate)}</Text>
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
