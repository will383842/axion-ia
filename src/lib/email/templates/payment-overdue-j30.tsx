// Email — Relance de paiement J+30 (dernier rappel chaleureux avant recouvrement).
//
// Séquence d'escalade DOUCE, étape 4/4 (la dernière). Ton toujours bienveillant
// et orienté solution : on évoque la transmission au service de recouvrement
// comme une étape « qu'on préfère sincèrement éviter », et on propose ENCORE un
// échéancier. Base légale (art. L.441-10 / D.441-5 C. com.) citée À TITRE
// INFORMATIF et en style muted (13px, textMuted). Paiement par VIREMENT
// (référence = invoiceNumber). Payload ci-dessous = forme attendue (fallbacks).

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
    title: "Dernier rappel avant transmission de votre dossier",
    intro: (n: string) => `Bonjour ${n},`,
    status: (inv: string, amount: string, due: string, days: string) =>
      `Malgré nos précédentes relances, votre facture ${inv} d'un montant de ${amount}, échue le ${due}${days ? ` (${days} jours de retard)` : ""}, demeure impayée. Nous vous adressons ce message en toute confiance, persuadés qu'une solution reste possible.`,
    relationship:
      "Nous tenons réellement à notre collaboration. Si un imprévu ou une difficulté de trésorerie explique ce retard, parlons-en : nous restons ouverts à un échéancier adapté à votre situation, sans jugement.",
    regularize: (inv: string, deadline: string) =>
      `Pour régulariser, un simple virement bancaire suffit, en indiquant la référence ${inv}${deadline ? `, si possible avant le ${deadline}` : ""}. Nos coordonnées bancaires (RIB) vous sont transmises sur demande, ou via le bouton ci-dessous.`,
    consequence:
      "Sans nouvelle ni règlement de votre part, nous serions contraints, à regret, de confier ce dossier à notre service de recouvrement — une étape que nous préférons sincèrement éviter et qui n'a pas lieu d'être entre partenaires de bonne foi.",
    legal:
      "Pour information : les articles L.441-10 et D.441-5 du Code de commerce prévoient, en cas de retard de paiement, des pénalités de retard ainsi qu'une indemnité forfaitaire de recouvrement de 40 €.",
    close:
      "Pour toute question, une difficulté, ou si ce message a croisé votre paiement, répondez simplement à cet email : nous trouverons ensemble la meilleure issue.\n\nBien à vous,\nL'équipe Axion-IA",
    cta: "Régler ma facture",
  },
  en: {
    title: "Final reminder before your file is referred",
    intro: (n: string) => `Hello ${n},`,
    status: (inv: string, amount: string, due: string, days: string) =>
      `Despite our previous reminders, your invoice ${inv} for ${amount}, due on ${due}${days ? ` (${days} days overdue)` : ""}, remains unpaid. We are writing to you in full confidence, certain that a solution is still possible.`,
    relationship:
      "We genuinely value our collaboration. If an unforeseen event or a cash-flow difficulty explains this delay, let's talk about it: we remain open to a payment schedule suited to your situation, without judgement.",
    regularize: (inv: string, deadline: string) =>
      `To settle, a simple bank transfer is enough, quoting reference ${inv}${deadline ? `, if possible before ${deadline}` : ""}. Our bank details are available on request, or via the button below.`,
    consequence:
      "Without a reply or payment from you, we would regrettably be compelled to refer this file to our debt-recovery service — a step we sincerely prefer to avoid and which has no place between partners acting in good faith.",
    legal:
      "For information: articles L.441-10 and D.441-5 of the French Commercial Code provide, in case of late payment, for late-payment penalties as well as a fixed €40 recovery indemnity.",
    close:
      "For any question or difficulty, or if this message crossed your payment, simply reply to this email — we will find the best outcome together.\n\nWarm regards,\nThe Axion-IA team",
    cta: "Settle my invoice",
  },
} as const;

export const paymentOverdueJ30Subject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const inv = field(payload as Partial<Payload>, "invoiceNumber", "");
  const suffix = inv ? ` ${inv}` : "";
  return locale === "fr"
    ? `Dernier rappel : votre facture${suffix} — Axion-IA`
    : `Final reminder: your invoice${suffix} — Axion-IA`;
};

export function PaymentOverdueJ30Email({
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
