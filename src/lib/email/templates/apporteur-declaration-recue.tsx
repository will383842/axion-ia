// E-mail INTERNE — un apporteur au contrat signé vient de déclarer une entreprise par
// le formulaire de son lien personnel (démarrage manuel, 2026-10-05).
//
// Destinataire : Williams (contact@axion-ia.com), jamais l'entreprise ni l'apporteur.
// Il dit QUELLE entreprise et QUEL apporteur, et mène à l'écran « Entreprises
// présentées », onglet « À traiter ».
//
// ⛔ AUCUNE donnée sur la personne rencontrée (nom, e-mail, téléphone) : ces valeurs sont
// chiffrées en base ; on les lit dans la console, pas dans une boîte de réception.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { objetCompose } from "../objet-email";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  /** Dénomination de l'entreprise déclarée. */
  entreprise?: string;
  /** Prénom et nom de l'apporteur. */
  apporteur?: string;
  /** Lien vers l'onglet « À traiter » de la console. */
  consoleUrl?: string;
}

const texte = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export const apporteurDeclarationRecueSubject = (
  _locale: Locale,
  payload: Record<string, unknown>,
): string => objetCompose("Entreprise déclarée :", texte(payload["entreprise"]) || "à traiter");

export function ApporteurDeclarationRecueEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const entreprise = texte(p.entreprise) || "Une entreprise";
  const apporteur = texte(p.apporteur) || "Un apporteur";
  const consoleUrl = texte(p.consoleUrl);
  return (
    <EmailLayout
      famille="C"
      preview={`${apporteur} a déclaré ${entreprise} : à traiter dans la console.`}
      title="Une entreprise est déclarée"
      {...(consoleUrl
        ? { cta: { label: "Ouvrir les entreprises à traiter", href: consoleUrl } }
        : {})}
      ctaSecret
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>
        <strong>Entreprise :</strong> {entreprise} · <strong>Apporteur :</strong> {apporteur}
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Rien n&apos;est parti vers l&apos;entreprise : la personne rencontrée et ses coordonnées se
        lisent dans la console, où vous répondez d&apos;un clic.
      </Text>
    </EmailLayout>
  );
}
