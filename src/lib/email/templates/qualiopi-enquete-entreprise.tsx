// Email — enquête de satisfaction ENTREPRISE (contact client, J+30).
//
// 🔴 L'indicateur 30 exige des appréciations d'AU MOINS DEUX sources distinctes
// (stagiaire / entreprise / financeur / formateur). Le retour stagiaire est
// automatisé ; celui de l'ENTREPRISE cliente n'avait aucun canal — il se tapait
// à la main dans la console. Cet email donne au contact client une page publique
// à jeton : il clique, note, commente, et l'appréciation « entreprise » se verse
// toute seule au registre.
//
// ⚠️ Destinataire = le CONTACT CLIENT, jamais le stagiaire.
// ⚠️ Aucune mention de financement public (règle CONTRAT-T15).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { objetCompose } from "../objet-email";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactNom: string;
  raisonSociale: string;
  titreFormation: string;
  dateFinFormation: string;
  lienEnquete: string;
  numeroSession: string;
}

export const qualiopiEnqueteEntrepriseSubject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as unknown as Payload;
  if (locale === "fr") {
    return objetCompose("Votre avis sur la formation", p.titreFormation ?? "");
  }
  return objetCompose("Your feedback on the training", p.titreFormation ?? "");
};

export function QualiopiEnqueteEntrepriseEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  return (
    <EmailLayout
      famille="B"
      preview="Deux minutes pour nous dire ce que votre entreprise a pensé de la formation."
      title="Votre avis d'entreprise cliente"
      cta={{ label: "Donner notre avis", href: p.lienEnquete }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>
        Il y a un mois, <strong>{p.raisonSociale}</strong> nous confiait la formation{" "}
        <strong>{p.titreFormation}</strong> (achevée le {p.dateFinFormation}).
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Bonjour {p.contactNom} — au-delà du ressenti des participants — que nous recueillons par
        ailleurs — c&apos;est l&apos;avis de votre <strong>entreprise</strong> qui nous intéresse
        ici : la formation a-t-elle produit les effets attendus dans votre activité ?
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Deux minutes suffisent : une note et, si vous le souhaitez, un commentaire.
      </Text>
    </EmailLayout>
  );
}
