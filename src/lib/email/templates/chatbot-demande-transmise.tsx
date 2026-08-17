// Email — confirmation qu'une demande laissée dans l'assistant a été transmise.
//
// ── Pourquoi ce gabarit existe ────────────────────────────────────────────
// Deux moments de l'assistant conduisent un visiteur à laisser son adresse :
// il demande à être recontacté, ou il pose une question que l'assistant
// transmet à un humain. Dans les deux cas, rien ne lui revenait.
//
// C'est le pire endroit pour un silence : la personne vient d'écrire dans une
// fenêtre de discussion qu'elle va fermer. Sans e-mail, il ne lui reste
// AUCUNE trace de son geste — ni preuve, ni rappel, ni moyen de relancer.
//
// Un seul gabarit pour les deux cas, distingués par `contexte` : le message
// utile est le même — « c'est transmis, on vous répond » — et deux gabarits
// quasi identiques auraient divergé à la première retouche.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  /** `rappel` (demande de contact) ou `question` (escalade vers un humain). */
  contexte: string;
  /** Reprise de ce que la personne a écrit, pour qu'elle se souvienne. */
  extrait?: string;
}

const COPY = {
  fr: {
    title: "Votre demande est bien transmise",
    intro: "Bonjour,",
    rappel:
      "Vous avez demandé à être recontacté depuis notre assistant. Votre demande est arrivée et une personne de l'équipe vous répondra.",
    question:
      "Votre question a été transmise à un membre de l'équipe : l'assistant n'avait pas de réponse fiable à vous donner, et nous préférons vous répondre juste plutôt que vite.",
    delai: "Nous répondons en général sous deux jours ouvrés.",
    rappelExtrait: "Votre message :",
    contact: "Pour ajouter quelque chose, répondez simplement à ce message.",
  },
  en: {
    title: "Your request has been passed on",
    intro: "Hello,",
    rappel:
      "You asked to be contacted through our assistant. Your request has arrived and someone from the team will reply.",
    question:
      "Your question has been passed to a member of the team: the assistant had no reliable answer, and we would rather answer you correctly than quickly.",
    delai: "We usually reply within two working days.",
    rappelExtrait: "Your message:",
    contact: "To add anything, simply reply to this message.",
  },
} as const;

export const chatbotDemandeTransmiseSubject = (
  locale: Locale,
  _p: Record<string, unknown>,
): string =>
  locale === "fr"
    ? "Votre demande est transmise — Axion-IA"
    : "Your request is on its way — Axion-IA";

export function ChatbotDemandeTransmiseEmail({
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
      <Text style={emailStyles.paragraphStyle}>{t.intro}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {p.contexte === "question" ? t.question : t.rappel}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{t.delai}</Text>
      {p.extrait ? (
        <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
          {t.rappelExtrait} « {p.extrait} »
        </Text>
      ) : null}
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.contact}
      </Text>
    </EmailLayout>
  );
}
