// Email — accusé de réception d'une candidature à une offre d'emploi.
//
// ── Pourquoi ce gabarit remplace `contact-confirmed` ─────────────────────
// Les candidatures recevaient l'accusé générique, qui promet : « Notre équipe
// revient vers vous sous 48 heures ouvrées. »
//
// 🔴 C'était une promesse FAUSSE. Un recrutement ne se traite pas en deux
// jours, et le stock de candidatures en attente le démontrait. Promettre un
// délai qu'on ne tient pas coûte plus cher que ne rien promettre : le candidat
// relance, s'agace, et le raconte.
//
// Ce gabarit ne donne donc aucun délai. Il dit ce qui est vrai : la
// candidature est arrivée, elle sera lue, et une réponse viendra — y compris
// si elle est négative. C'est le seul engagement qu'on peut tenir.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName?: string;
  /** Intitulé de l'offre, tel qu'affiché au moment de la candidature. */
  offerTitle?: string;
}

const COPY = {
  fr: {
    title: "Votre candidature est bien arrivée",
    intro: (n?: string) => (n ? `Bonjour ${n},` : "Bonjour,"),
    body: (offre?: string) =>
      offre
        ? `Nous avons bien reçu votre candidature pour le poste de ${offre}. Merci de l'intérêt que vous portez à Axion-IA.`
        : "Nous avons bien reçu votre candidature. Merci de l'intérêt que vous portez à Axion-IA.",
    lecture:
      "Chaque candidature est lue par une personne, pas par un filtre automatique. Nous prenons le temps de le faire sérieusement.",
    // Aucun délai annoncé : voir l'en-tête de ce fichier.
    reponse:
      "Nous vous répondrons, que la réponse soit positive ou non. Si vous n'avez pas de nouvelles rapidement, ce n'est pas un refus tacite — c'est que nous n'avons pas encore terminé.",
    contact: "Un élément à ajouter à votre dossier ? Répondez simplement à ce message.",
  },
  en: {
    title: "Your application has arrived",
    intro: (n?: string) => (n ? `Hello ${n},` : "Hello,"),
    body: (offre?: string) =>
      offre
        ? `We have received your application for the ${offre} position. Thank you for your interest in Axion-IA.`
        : "We have received your application. Thank you for your interest in Axion-IA.",
    lecture:
      "Every application is read by a person, not by an automated filter. We take the time to do it properly.",
    reponse:
      "We will reply to you, whether the answer is positive or not. If you do not hear from us quickly, it is not a silent rejection — it means we have not finished yet.",
    contact: "Anything to add to your file? Simply reply to this message.",
  },
} as const;

export const candidatureRecueSubject = (locale: Locale, _p: Record<string, unknown>): string =>
  locale === "fr"
    ? "Votre candidature est bien arrivée — Axion-IA"
    : "Your application has arrived — Axion-IA";

export function CandidatureRecueEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const t = COPY[locale];
  return (
    <EmailLayout preview={t.title} title={t.title} locale={locale}>
      <Text style={emailStyles.paragraphStyle}>{t.intro(p.contactName)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.body(p.offerTitle)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.lecture}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.reponse}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.contact}
      </Text>
    </EmailLayout>
  );
}
