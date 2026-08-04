// Email — attestation de formation disponible (T15).
// Envoyé au stagiaire quand l'attestation (ou certificat) est généré.
// ⚠️ Aucune mention de financement public dans cet email (règle CONTRAT-T15).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  stagiairePrenomNom: string;
  titreFormation: string;
  typeDocument: string; // "attestation" | "attestation partielle" | "certificat de réalisation"
  lienPortail?: string;
  numeroSession: string;
  /** Vrai si un questionnaire du stagiaire attend encore sa réponse. */
  questionnaireEnAttente?: boolean;
}

export const qualiopiAttestationDisponibleSubject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as unknown as Payload;
  if (locale === "fr") {
    return `Votre ${p.typeDocument ?? "attestation"} est disponible — Axion-IA`;
  }
  return `Your ${p.typeDocument ?? "certificate"} is available — Axion-IA`;
};

export function QualiopiAttestationDisponibleEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const ctaHref = p.lienPortail ?? `${baseUrl}/fr/portail/mon-espace`;
  return (
    <EmailLayout
      preview={`Votre ${p.typeDocument ?? "attestation"} est prête`}
      title={`Votre ${p.typeDocument ?? "attestation"} est disponible`}
      cta={{ label: "Télécharger mon document", href: ctaHref }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>Bonjour {p.stagiairePrenomNom},</Text>
      <Text style={emailStyles.paragraphStyle}>
        Votre <strong>{p.typeDocument ?? "attestation"}</strong> pour la formation{" "}
        <strong>{p.titreFormation}</strong> est désormais disponible dans votre espace stagiaire.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Ce document officiel atteste de votre participation. Conservez-le précieusement.
      </Text>
      {/* 🔴 Le moment de l'attestation est celui où le stagiaire est le plus
          enclin à répondre — on glisse le rappel ICI. ⚠️ L'attestation part
          quoi qu'il arrive : c'est un droit (L.6353-1), jamais un levier. */}
      {p.questionnaireEnAttente === true && (
        <Text style={emailStyles.paragraphStyle}>
          Au passage : un questionnaire vous attend encore dans votre espace. Deux minutes
          suffisent, et votre retour nous aide réellement à améliorer nos formations.
        </Text>
      )}
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        Référence session : {p.numeroSession}
      </Text>
    </EmailLayout>
  );
}
