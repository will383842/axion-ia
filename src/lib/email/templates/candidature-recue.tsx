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
    preview: "Une personne la lira — et vous aurez une réponse, positive ou non.",
    intro: (n?: string) => (n ? `Bonjour ${n},` : "Bonjour,"),
    // §12.2 question 2 : « La première phrase parle-t-elle de LUI plutôt que
    // de nous ? » « Nous avons bien reçu… » parlait de nous. La refonte du
    // 2026-08-31 avait corrigé l'ORDRE (l'info avant la politesse) sans
    // corriger la VOIX — deux choses distinctes.
    body: (offre?: string) =>
      offre
        ? `Votre candidature au poste de ${offre} est bien arrivée. Merci de l'intérêt que vous portez à Axion-IA.`
        : "Votre candidature est bien arrivée. Merci de l'intérêt que vous portez à Axion-IA.",
    lecture:
      "Chaque candidature est lue par une personne, pas par un filtre automatique. Nous prenons le temps de le faire sérieusement.",
    // Aucun délai annoncé : voir l'en-tête de ce fichier.
    reponse:
      "Nous vous répondrons, que la réponse soit positive ou non. Si vous n'avez pas de nouvelles rapidement, ce n'est pas un refus tacite — c'est que nous n'avons pas encore terminé.",
    contact: "Un élément à ajouter à votre dossier ? Répondez simplement à ce message.",
  },
  en: {
    title: "Your application has arrived",
    preview: "A person will read it — and you will get an answer, either way.",
    intro: (n?: string) => (n ? `Hello ${n},` : "Hello,"),
    body: (offre?: string) =>
      offre
        ? `Your application for the ${offre} position has arrived. Thank you for your interest in Axion-IA.`
        : "Your application has arrived. Thank you for your interest in Axion-IA.",
    lecture:
      "Every application is read by a person, not by an automated filter. We take the time to do it properly.",
    reponse:
      "We will reply to you, whether the answer is positive or not. If you do not hear from us quickly, it is not a silent rejection — it means we have not finished yet.",
    contact: "Anything to add to your file? Simply reply to this message.",
  },
} as const;

export const candidatureRecueSubject = (locale: Locale, _p: Record<string, unknown>): string =>
  locale === "fr" ? "Votre candidature est bien arrivée" : "Your application has arrived";

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
    <EmailLayout famille="B" preview={t.preview} title={t.title} locale={locale}>
      <Text style={emailStyles.paragraphStyle}>{t.body(p.offerTitle)}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {t.intro(p.contactName)}
        <br />
        {t.lecture}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{t.reponse}</Text>
    </EmailLayout>
  );
}
