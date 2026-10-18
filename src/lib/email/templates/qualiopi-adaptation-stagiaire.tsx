// Email — récapitulatif des AMÉNAGEMENTS retenus, au stagiaire, avant la
// formation (chantier QNC, L04).
//
// Ne porte que les MESURES (la réponse de l'organisme) : jamais le type de
// besoin déclaré. Le stagiaire peut répondre s'il souhaite un échange.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { objetCompose } from "../objet-email";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  stagiairePrenomNom?: string;
  titreFormation?: string;
  dateDebutFormation?: string;
  /** Les mesures, une par ligne. */
  mesures?: string[];
  /** Une mesure porte sur les supports : le formateur les transmet avant la formation. */
  supportsAvant?: boolean;
  numeroSession?: string;
}

export const qualiopiAdaptationStagiaireSubject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as Payload;
  if (locale === "fr") return objetCompose("Vos aménagements", p.titreFormation ?? "");
  return objetCompose("Your adjustments", p.titreFormation ?? "");
};

export function QualiopiAdaptationStagiaireEmail({
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
      preview="Les aménagements prévus pour votre formation."
      title="Vos aménagements"
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>
        Bonjour{p.stagiairePrenomNom ? ` ${p.stagiairePrenomNom}` : ""}, voici les aménagements
        prévus pour la formation <strong>{p.titreFormation}</strong>
        {p.dateDebutFormation ? ` (début le ${p.dateDebutFormation})` : ""} :
      </Text>
      {mesures.map((m) => (
        <Text key={m} style={emailStyles.paragraphStyle}>
          • {m}
        </Text>
      ))}
      {p.supportsAvant === true ? (
        <Text style={emailStyles.paragraphStyle}>
          Les supports adaptés vous seront transmis avant le début de la formation.
        </Text>
      ) : null}
      <Text style={emailStyles.paragraphStyle}>
        Votre formateur ne reçoit que cette liste d&apos;aménagements, jamais les précisions que
        vous avez données. Si un aménagement ne vous convient pas, répondez à ce courriel : le
        référent handicap vous répondra par écrit.
        {p.numeroSession ? ` Session ${p.numeroSession}.` : ""}
      </Text>
    </EmailLayout>
  );
}
