// Email — attestation de formation disponible (T15).
// Envoyé au stagiaire quand l'attestation (ou certificat) est généré.
// ⚠️ Aucune mention de financement public dans cet email (règle CONTRAT-T15).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { objetCompose } from "../objet-email";
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
    return objetCompose("Votre", `${p.typeDocument ?? "attestation"} est disponible`);
  }
  return objetCompose("Your", `${p.typeDocument ?? "certificate"} is available`);
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
      famille="B"
      /* « est prête » figeait un accord féminin alors que `typeDocument` est
         libre : la console rendait « Votre Audit IA est prête ». Le pré-en-tête
         ne répète plus le titre et n'accorde plus rien. */
      preview="À télécharger dans votre espace stagiaire. Conservez-le : il atteste votre participation."
      title={`Votre ${p.typeDocument ?? "attestation"} est disponible`}
      cta={{ label: "Télécharger mon document", href: ctaHref }}
      locale={locale}
      /* Attestation en main = pic de bonne volonté : preuve Qualiopi + demande
         d'avis. Le CTA principal (télécharger) reste seul en haut.

         🔴 PAS de bloc parrainage ici (c'était « snowball="both" » jusqu'au
         2026-08-31). Ce bloc dit « ce message peut servir à quelqu'un d'autre,
         transférez-lui cet e-mail » — or ce message porte l'attestation
         NOMINATIVE du stagiaire. On ne transfère pas son propre titre à un
         collègue : la phrase invitait à un geste sans objet. Elle coûtait en
         outre les deux liens qui faisaient passer ce gabarit de 8 à 9, seul
         dépassement du budget de la famille B (§5.4). La demande d'avis, elle,
         est exactement à sa place (§7.6). */
      trust
      snowball="review"
    >
      <Text style={emailStyles.paragraphStyle}>
        Votre <strong>{p.typeDocument ?? "attestation"}</strong> pour la formation{" "}
        <strong>{p.titreFormation}</strong> est désormais disponible dans votre espace stagiaire.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Bonjour {p.stagiairePrenomNom} — ce document officiel atteste de votre participation.
        Conservez-le précieusement.
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
