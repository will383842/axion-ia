// Email — relance d'un devis envoyé, sans réponse (lot B9 de la refonte de la fiche client).
//
// ⚠️ Ce message n'est JAMAIS envoyé seul : il est garé « à valider » (`garerPourValidation`)
// et ne part qu'après relecture de Will dans la boîte « E-mails à valider ».
// Aucun montant, aucune promesse : le prix figurait dans le devis. Vouvoiement, ton courtois.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { lienSignatureValide } from "../lien-signature";
import { CLOTURE_DEVIS_FR } from "./devis-envoi";
import { salutation, type IdentiteSalutation } from "../salutation";
import type { Locale } from "../../../../prisma/generated/client";

// Ré-exportée : les tests de la relance l'importent encore d'ici.
export { lienSignatureValide };

interface Payload {
  /** Conservé pour l'aperçu de la corbeille ; JAMAIS utilisé dans « Bonjour ». */
  destinataireNom: string;
  /** Identité structurée du destinataire : « Bonjour Monsieur Dupont, ». Absente : « Bonjour, ». */
  salutation?: IdentiteSalutation;
  /**
   * Lien de signature `https://<hôte du site>/fr/portail/signer/<jeton>`, posé à l'envoi (jeton
   * porteur : jamais journalisé). Ignoré s'il ne passe pas `lienSignatureValide` : alors ni
   * bouton ni phrase « signer ».
   */
  signatureUrl?: string;
  /** Vrai si le PDF du devis est joint à l'e-mail (posé à la préparation). */
  pieceJointe?: boolean;
  numero: string;
  /** Date d'envoi du devis, déjà formatée (JJ/MM/AAAA). */
  dateEnvoi?: string;
  /** Bloc libre ajouté par l'admin avant validation. */
  messagePersonnalise?: string;
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
  const lienSignature = lienSignatureValide(p.signatureUrl);
  const signatureValide = lienSignature !== null;
  if (!signatureValide && typeof p.signatureUrl === "string" && p.signatureUrl !== "") {
    // Une seule fois par rendu ; ni le jeton ni l'URL ne sont journalisés.
    console.warn("[relance-devis-client] lien de signature refusé : bouton masqué");
  }
  // Clé présente (même vide) : « Bonjour Monsieur Dupont, » ; absente : « Bonjour, ».
  const sal = p.salutation as unknown;
  const bonjour = salutation(
    typeof sal === "object" && sal !== null && !Array.isArray(sal)
      ? (sal as IdentiteSalutation)
      : {},
    // Le corps de ce gabarit n'existe qu'en français : la salutation aussi.
    "fr",
  );
  const depuis = p.dateEnvoi ? `, envoyé le ${p.dateEnvoi}` : "";

  return (
    <EmailLayout
      famille="B"
      locale={locale}
      title="Votre devis Axion-IA"
      preview={`Un mot au sujet du devis ${numero}.`}
      {...(signatureValide
        ? {
            cta: { label: "Signer le devis en ligne", href: lienSignature },
            ctaSecret: true,
          }
        : {})}
    >
      <Text style={emailStyles.paragraphStyle}>{bonjour}</Text>
      <Text style={emailStyles.paragraphStyle}>
        Nous vous avons adressé le devis <strong>{numero}</strong>
        {depuis}. Avez-vous pu en prendre connaissance ?
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Si une question reste en suspens sur son contenu ou ses modalités, nous sommes à votre
        écoute.
      </Text>
      {p.pieceJointe === true ? (
        <Text style={emailStyles.paragraphStyle}>
          Le devis est joint à cet e-mail au format PDF.
        </Text>
      ) : null}
      {signatureValide ? (
        <Text style={emailStyles.paragraphStyle}>
          Vous pouvez le signer en ligne avec le bouton ci-dessous.
        </Text>
      ) : null}
      {p.messagePersonnalise ? (
        <Text style={emailStyles.paragraphStyle}>{p.messagePersonnalise}</Text>
      ) : null}
      <Text style={emailStyles.paragraphStyle}>
        {CLOTURE_DEVIS_FR.split("\n").map((ligne, i) => (
          <span key={i}>
            {ligne}
            <br />
          </span>
        ))}
      </Text>
    </EmailLayout>
  );
}
