// Email — FICHE D'ADAPTATION transmise au formateur avant la formation
// (chantier QNC, L04).
//
// 🔴 Ne porte que les MESURES à mettre en œuvre. Le type de besoin, les
// précisions et le commentaire du stagiaire sont des données de santé : ils
// restent chez le référent handicap.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { objetCompose } from "../objet-email";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  formateurPrenomNom?: string;
  stagiairePrenomNom?: string;
  titreFormation?: string;
  dateDebutFormation?: string;
  /** Les mesures, une par ligne. */
  mesures?: string[];
  /** Une mesure porte sur les supports : à transmettre au stagiaire avant la formation. */
  supportsAvant?: boolean;
  numeroSession?: string;
}

export const qualiopiAdaptationFormateurSubject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as Payload;
  if (locale === "fr") return objetCompose("Fiche d'adaptation", p.titreFormation ?? "");
  return objetCompose("Adjustment sheet", p.titreFormation ?? "");
};

export function QualiopiAdaptationFormateurEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as Payload;
  const mesures = Array.isArray(p.mesures) ? p.mesures : [];
  return (
    <EmailLayout
      famille="B"
      preview="Les aménagements à mettre en place pour un participant."
      title="Fiche d'adaptation"
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>
        Bonjour{p.formateurPrenomNom ? ` ${p.formateurPrenomNom}` : ""}, pour la formation{" "}
        <strong>{p.titreFormation}</strong>
        {p.dateDebutFormation ? ` (début le ${p.dateDebutFormation})` : ""}, les aménagements
        suivants sont prévus pour <strong>{p.stagiairePrenomNom}</strong> :
      </Text>
      {mesures.map((m) => (
        <Text key={m} style={emailStyles.paragraphStyle}>
          • {m}
        </Text>
      ))}
      {p.supportsAvant === true ? (
        <Text style={emailStyles.paragraphStyle}>
          Merci de transmettre les <strong>supports adaptés</strong> au participant avant le début
          de la formation.
        </Text>
      ) : null}
      <Text style={emailStyles.paragraphStyle}>
        Cette fiche ne contient que les mesures à appliquer : la situation du participant reste
        confidentielle et ne vous est pas communiquée. Pour toute question, répondez à ce courriel.
        {p.numeroSession ? ` Session ${p.numeroSession}.` : ""}
      </Text>
    </EmailLayout>
  );
}
