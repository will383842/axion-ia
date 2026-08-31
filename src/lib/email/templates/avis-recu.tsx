// Email — remerciement après le dépôt d'un avis client.
//
// ── Pourquoi ce gabarit remplace `contact-confirmed` ─────────────────────
// Un client qui laissait un avis recevait l'accusé générique : « Nous avons
// bien reçu votre message. Notre équipe revient vers vous sous 48 heures
// ouvrées. »
//
// 🔴 Absurde à deux titres. Un avis n'est pas une demande : personne n'a à
// « revenir vers » son auteur. Et annoncer un délai de réponse à quelqu'un
// qui vient de vous remercier donne l'impression que le message n'a pas été
// lu — exactement l'inverse de l'effet recherché.
//
// Ce gabarit remercie, explique la modération, et ne promet aucun rappel.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName?: string;
}

const COPY = {
  fr: {
    title: "Merci pour votre avis",
    preview: "Il est relu avant publication — quelques jours. Rien à faire de votre côté.",
    intro: (n?: string) => (n ? `Bonjour ${n},` : "Bonjour,"),
    body: "Merci d'avoir pris le temps de laisser votre avis. C'est court à écrire et long à mériter — nous y attachons de l'importance.",
    moderation:
      "Votre avis est relu avant publication, pour écarter les messages qui ne viennent pas d'un vrai client. Cette vérification prend quelques jours.",
    // Aucun rappel promis : ce n'est pas une demande.
    suite:
      "Vous n'avez rien d'autre à faire. Si vous souhaitez corriger ou retirer votre avis, répondez simplement à ce message.",
  },
  en: {
    title: "Thank you for your review",
    preview: "It is checked before publication — a few days. Nothing to do on your side.",
    intro: (n?: string) => (n ? `Hello ${n},` : "Hello,"),
    body: "Thank you for taking the time to leave a review. It is quick to write and slow to earn — we do not take it lightly.",
    moderation:
      "Your review is checked before publication, to filter out messages that do not come from a real customer. This takes a few days.",
    suite:
      "There is nothing else for you to do. If you would like to amend or withdraw your review, simply reply to this message.",
  },
} as const;

export const avisRecuSubject = (locale: Locale, _p: Record<string, unknown>): string =>
  locale === "fr" ? "Merci pour votre avis" : "Thank you for your review";

export function AvisRecuEmail({
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
      <Text style={emailStyles.paragraphStyle}>{t.body}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {t.intro(p.contactName)}
        <br />
        {t.moderation}
      </Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.suite}
      </Text>
    </EmailLayout>
  );
}
