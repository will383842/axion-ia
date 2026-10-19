// Email — INFORMATION DE L'ENTREPRISE (QNC NC6, P-12 étape 4).
//
// Part seul, automatiquement, à J-1 entre 12 h et 19 h (Paris), quand le
// stagiaire n'a pas confirmé sa présence (décision de Will, 19/10).
//
// 🔴 CONTENU LIMITÉ, ET C'EST VOLONTAIRE : le nom du contact, la raison sociale,
// le prénom et le nom du stagiaire, le titre de la formation, la date, et UNE
// phrase. Jamais de motif, jamais de donnée de santé, jamais d'aménagement :
// l'entreprise n'a pas à connaître la raison d'une absence ou d'un silence.
// Le payload ne porte d'ailleurs aucun champ qui permettrait de l'y glisser.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { objetCompose } from "../objet-email";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactNom?: string;
  raisonSociale?: string;
  stagiairePrenomNom?: string;
  titreFormation?: string;
  /** Date de J, déjà formatée en toutes lettres. */
  dateDebutFormation?: string;
}

export const qualiopiPresenceEntrepriseSubject = (
  _locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as Payload;
  return objetCompose("Présence à confirmer —", p.titreFormation ?? "votre formation");
};

export function QualiopiPresenceEntrepriseEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as Payload;
  return (
    <EmailLayout
      famille="B"
      preview="Un participant n'a pas encore confirmé sa présence."
      title="Une présence reste à confirmer"
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>
        Bonjour{p.contactNom ? ` ${p.contactNom}` : ""}, la formation{" "}
        <strong>{p.titreFormation}</strong>
        {p.raisonSociale ? ` pour ${p.raisonSociale}` : ""} débute le {p.dateDebutFormation}.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        {p.stagiairePrenomNom ?? "Le participant"} n&apos;a pas confirmé sa présence à ce jour.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Si vous le pouvez, un mot à votre collaborateur nous aidera à préparer la session.
      </Text>
    </EmailLayout>
  );
}
