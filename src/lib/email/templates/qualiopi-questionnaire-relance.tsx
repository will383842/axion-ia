// Email — relance d'un questionnaire resté sans réponse (J+3 puis J+10).
//
// 🔴 Constaté sur le premier dossier réel : les questionnaires partaient, puis
// plus rien — aucune relance, et l'indicateur 30 restait à « 0 appréciation ».
// La relance est plafonnée à 2 par le cron : au-delà, on n'insiste pas par
// email — la relance téléphonique manuelle prend le relais (tracée en console).
//
// ⚠️ Aucune mention de financement public dans cet email (règle CONTRAT-T15).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { objetCompose } from "../objet-email";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  stagiairePrenomNom: string;
  titreFormation: string;
  /** « questionnaire de satisfaction » / « questionnaire de positionnement »… */
  libelleQuestionnaire: string;
  lienQuestionnaire: string;
  numeroSession: string;
}

export const qualiopiQuestionnaireRelanceSubject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as unknown as Payload;
  if (locale === "fr") {
    return objetCompose("Rappel — votre avis sur", p.titreFormation ?? "votre formation");
  }
  return objetCompose("Reminder — your feedback on", p.titreFormation ?? "your training");
};

export function QualiopiQuestionnaireRelanceEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const ctaHref = p.lienQuestionnaire ?? `${baseUrl}/fr/portail/mon-espace`;
  return (
    <EmailLayout
      famille="C"
      preview="Deux minutes suffisent — votre avis compte vraiment."
      title="Votre avis nous manque"
      cta={{ label: "Répondre au questionnaire", href: ctaHref }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>
        Vous avez suivi la formation <strong>{p.titreFormation}</strong> et votre{" "}
        {p.libelleQuestionnaire} attend toujours votre réponse.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Bonjour {p.stagiairePrenomNom} — deux minutes suffisent, et votre retour compte double : il
        nous aide à améliorer nos formations, et il alimente le suivi qualité que nous devons tenir
        pour chaque session.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Si vous avez déjà répondu entre-temps, merci — vous pouvez ignorer ce message.
      </Text>
    </EmailLayout>
  );
}
