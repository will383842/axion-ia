// Email — enquête de satisfaction J+1 après la fin de la session (T15).
// Envoyé le lendemain de dateFin pour chaque enrollment présent/planifié.
// ⚠️ Aucune mention de financement public dans cet email (règle CONTRAT-T15).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  stagiairePrenomNom: string;
  titreFormation: string;
  dateFinFormation: string;
  lienQuestionnaire: string;
  numeroSession: string;
}

export const qualiopiSatisfactionJ1Subject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as unknown as Payload;
  if (locale === "fr") {
    return `Votre avis compte — ${p.titreFormation ?? "Formation"} — Axion-IA`;
  }
  return `Your feedback matters — ${p.titreFormation ?? "Training"} — Axion-IA`;
};

export function QualiopiSatisfactionJ1Email({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  return (
    <EmailLayout
      preview="Donnez votre avis sur votre formation"
      title="Comment s'est passée votre formation ?"
      cta={{ label: "Répondre au questionnaire", href: p.lienQuestionnaire }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>Bonjour {p.stagiairePrenomNom},</Text>
      <Text style={emailStyles.paragraphStyle}>
        Votre formation <strong>{p.titreFormation}</strong> s&apos;est terminée le{" "}
        {p.dateFinFormation}. Votre retour nous est précieux pour améliorer nos programmes.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Cela prend moins de 3 minutes. Merci de compléter le questionnaire avant 15 jours.
      </Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        Référence session : {p.numeroSession}
      </Text>
    </EmailLayout>
  );
}
