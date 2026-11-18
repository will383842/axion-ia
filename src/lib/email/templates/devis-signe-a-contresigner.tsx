// E-mail INTERNE — un devis vient d'être signé par le client, par lien (2026-11-04).
//
// Destinataire : l'équipe Axion-IA, jamais le client. Il dit QUEL devis (numéro)
// et mène à sa fiche dans la console.
//
// ⛔ AUCUNE donnée personnelle : ni nom, ni adresse du client. Le numéro suffit
// pour retrouver le devis derrière la connexion de la console.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { objetCompose } from "../objet-email";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  /** Numéro du devis (AXI-DEV-…). */
  numeroDevis?: string;
  /** `a_contresigner` (défaut) ou `complete` (signé des deux parties). */
  etape?: string;
  /** Lien vers la fiche du devis, dans la console. */
  consoleUrl?: string;
}

const texte = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export const devisSigneAContresignerSubject = (
  _locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const numero = texte(payload["numeroDevis"]);
  const complet = texte(payload["etape"]) === "complete";
  const prefixe = complet ? "Signé des deux parties :" : "À contresigner :";
  return objetCompose(prefixe, numero);
};

export function DevisSigneAContresignerEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const numero = texte(p.numeroDevis) || "(numéro non communiqué)";
  const complet = texte(p.etape) === "complete";
  const consoleUrl = texte(p.consoleUrl);
  return (
    <EmailLayout
      famille="C"
      preview={
        complet
          ? `Le devis ${numero} est signé des deux parties.`
          : `Le client a signé le devis ${numero} : il reste à le contresigner.`
      }
      title={complet ? "Devis signé des deux parties" : "Devis signé par le client"}
      /* L'URL mène à la console : on ne l'imprime pas en clair (préfixe secret). */
      {...(consoleUrl ? { cta: { label: "Ouvrir la fiche du devis", href: consoleUrl } } : {})}
      ctaSecret
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>
        <strong>Devis :</strong> {numero}
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        {complet
          ? "Le devis est désormais signé par le client et par l'organisme."
          : "Le client vient de signer ce devis. Il reste à le contresigner depuis la fiche du devis dans la console."}
      </Text>
    </EmailLayout>
  );
}
