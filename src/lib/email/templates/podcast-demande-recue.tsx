// Email — accusé de réception d'une demande de tournage podcast.
//
// ── Pourquoi un gabarit dédié ─────────────────────────────────────────────
// Le formulaire `/podcast` est un canal d'entrée à part entière, relayé par
// les QR des flyers papier. Il ne renvoyait AUCUN accusé : un dirigeant
// remplissait le formulaire et n'entendait plus jamais parler de nous.
//
// On n'a pas réutilisé `contact-confirmed` : ce gabarit sert déjà d'accusé à
// huit flux différents (contact, devis, presse, partenariat, investisseur,
// support, candidatures, avis). Y ajouter le podcast aurait aggravé une dette
// déjà signalée — et un dirigeant qui propose son entreprise pour un tournage
// n'attend pas le même message qu'un candidat à une offre d'emploi.
//
// 🔴 Aucun engagement de tournage n'est pris ici. Le podcast est une offre
// gratuite et sélective : promettre une date dans l'accusé créerait une
// attente qu'on ne maîtrise pas.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  leaderName: string;
  companyName: string;
  city: string;
}

const COPY = {
  fr: {
    title: "Votre demande de tournage est arrivée",
    preview:
      "Étudiée une par une. Le nombre de tournages est limité, et on vous le dira franchement.",
    intro: (n: string) => `Bonjour ${n},`,
    body: (e: string, v: string) =>
      `Nous avons bien reçu votre proposition de tournage pour ${e}, à ${v}. Merci de nous avoir écrit.`,
    suite:
      "Nous étudions chaque demande une par une, et nous revenons vers vous pour vous dire si nous pouvons donner suite et, le cas échéant, convenir d'une date.",
    honnete:
      "Le nombre de tournages que nous pouvons assurer est limité : nous ne pourrons pas répondre favorablement à tout le monde, et nous vous le dirons franchement.",
    contact: "Une précision à ajouter ? Répondez simplement à ce message.",
  },
  en: {
    title: "Your filming request has arrived",
    preview: "Reviewed one by one. Slots are limited, and we will tell you plainly.",
    intro: (n: string) => `Hello ${n},`,
    body: (e: string, v: string) =>
      `We have received your filming proposal for ${e}, in ${v}. Thank you for writing to us.`,
    suite:
      "We review each request individually and will get back to you to say whether we can proceed and, if so, agree on a date.",
    honnete:
      "The number of shoots we can take on is limited: we will not be able to say yes to everyone, and we will tell you plainly.",
    contact: "Anything to add? Simply reply to this message.",
  },
} as const;

export const podcastDemandeRecueSubject = (locale: Locale, _p: Record<string, unknown>): string =>
  locale === "fr" ? "Votre demande de tournage podcast" : "Your podcast filming request";

export function PodcastDemandeRecueEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const t = COPY[locale];
  return (
    <EmailLayout famille="B" preview={t.preview} title={t.title} locale={locale}>
      <Text style={emailStyles.paragraphStyle}>{t.intro(p.leaderName)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.body(p.companyName, p.city)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.suite}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.honnete}
      </Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.contact}
      </Text>
    </EmailLayout>
  );
}
