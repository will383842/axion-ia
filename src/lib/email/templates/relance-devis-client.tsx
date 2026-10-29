// Email — relance d'un devis envoyé, sans réponse (lot B9 de la refonte de la fiche client).
//
// ⚠️ Ce message n'est JAMAIS envoyé seul : il est garé « à valider » (`garerPourValidation`)
// et ne part qu'après relecture de Will dans la boîte « E-mails à valider ».
// Aucun montant, aucune promesse : le prix figurait dans le devis. Vouvoiement, ton courtois.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  destinataireNom: string;
  numero: string;
  /** Date d'envoi du devis, déjà formatée (JJ/MM/AAAA). */
  dateEnvoi?: string;
}

export const relanceDevisClientSubject = (
  _locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const numero = (payload as Partial<Payload>).numero ?? "";
  return `Devis ${numero} : un point ?`;
};

export function RelanceDevisClientEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as Partial<Payload>;
  const numero = p.numero ?? "";
  const depuis = p.dateEnvoi ? `, envoyé le ${p.dateEnvoi}` : "";

  return (
    <EmailLayout
      famille="B"
      locale={locale}
      title="Votre devis Axion-IA"
      preview={`Un mot au sujet du devis ${numero}.`}
    >
      <Text style={emailStyles.paragraphStyle}>
        {p.destinataireNom ? `Bonjour ${p.destinataireNom},` : "Bonjour,"}
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Nous vous avons adressé le devis <strong>{numero}</strong>
        {depuis}. Avez-vous pu en prendre connaissance ?
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Si une question reste en suspens sur son contenu ou ses modalités, répondez simplement à cet
        e-mail : nous sommes à votre écoute.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Bien cordialement,
        <br />
        L&apos;équipe Axion-IA
      </Text>
    </EmailLayout>
  );
}
