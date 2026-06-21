// Email — Contrat refusé / décliné (cycle de vie du contrat, signature DocuSeal).
//
// Étape délicate mais à traiter avec bienveillance : le client a décliné le
// contrat. Ton compréhensif, porte laissée ouverte, pas de CTA dur. Aucune
// mention de paiement par carte/Stripe.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";

interface Payload {
  contactName: string;
  /** Intitulé de la prestation concernée. Ex. « Formation IA — 2 jours ». */
  interventionType?: string;
  /** Lien de contact (CTA doux). Défaut : page contact. */
  signUrl?: string;
  /** Motif éventuel du refus, communiqué par le client. Optionnel. */
  reason?: string;
}

function field(p: Partial<Payload>, key: keyof Payload, fallback: string): string {
  const v = p[key];
  return v === undefined || v === null || `${v}`.trim() === "" ? fallback : `${v}`;
}

const COPY = {
  fr: {
    title: "Votre décision est bien notée",
    intro: (n: string) => `Bonjour ${n},`,
    noted: (intervention: string) =>
      `Nous avons bien noté votre décision de ne pas donner suite au contrat${intervention ? ` pour ${intervention}` : ""}. Nous la respectons pleinement et vous remercions de nous l'avoir fait savoir.`,
    reason: (r: string) =>
      `Vous nous avez indiqué le motif suivant : « ${r} ». Nous le prenons en compte avec attention.`,
    understanding:
      "Un projet peut évoluer, se reporter ou changer de priorité : c'est tout à fait normal. Aucun engagement n'est pris de votre part.",
    open: "La porte reste grande ouverte : si vos besoins évoluent, ou si nous pouvons vous accompagner autrement, n'hésitez pas à revenir vers nous. Ce sera toujours avec plaisir.",
    close:
      "Nous vous souhaitons une belle continuation et restons à votre disposition.\n\nBien à vous,\nL'équipe Axion-IA",
    cta: "Reprendre contact",
  },
  en: {
    title: "Your decision is noted",
    intro: (n: string) => `Hello ${n},`,
    noted: (intervention: string) =>
      `We've duly noted your decision not to proceed with the contract${intervention ? ` for ${intervention}` : ""}. We fully respect it and thank you for letting us know.`,
    reason: (r: string) =>
      `You mentioned the following reason: "${r}". We take it carefully into account.`,
    understanding:
      "A project can evolve, be postponed or shift in priority — that's perfectly normal. You are under no obligation whatsoever.",
    open: "The door remains wide open: should your needs change, or if we can support you in any other way, please don't hesitate to come back to us. It will always be a pleasure.",
    close:
      "We wish you all the best and remain at your disposal.\n\nWarm regards,\nThe Axion-IA team",
    cta: "Get back in touch",
  },
} as const;

export const contractRefusedSubject = (locale: Locale): string =>
  locale === "fr"
    ? "Votre décision concernant le contrat — Axion-IA"
    : "Your decision regarding the contract — Axion-IA";

export function ContractRefusedEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as Partial<Payload>;
  const t = COPY[locale];

  const contactName = field(p, "contactName", "");
  const interventionType = field(p, "interventionType", "");
  const reason = field(p, "reason", "");
  const contactUrl = field(p, "signUrl", `${SITE_URL}/contact`);

  const greeting = contactName ? t.intro(contactName) : locale === "fr" ? "Bonjour," : "Hello,";

  return (
    <EmailLayout
      preview={t.title}
      title={t.title}
      cta={{ label: t.cta, href: contactUrl }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>{greeting}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.noted(interventionType)}</Text>
      {reason ? <Text style={emailStyles.paragraphStyle}>{t.reason(reason)}</Text> : null}
      <Text style={emailStyles.paragraphStyle}>{t.understanding}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.open}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, whiteSpace: "pre-line" }}>{t.close}</Text>
    </EmailLayout>
  );
}
