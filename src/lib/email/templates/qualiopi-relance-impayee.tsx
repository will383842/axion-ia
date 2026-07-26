// Email — relance d'une facture impayée (audit certification 2026-07-26, F59).
//
// Passe par la CORBEILLE DE VALIDATION : il n'est jamais envoyé sans relecture
// (cf. `outbox-policy.ts`). Une relance mal calibrée coûte un client — c'est
// exactement le genre de message qu'on veut relire avant qu'il ne parte.
//
// Deux cas distincts, et la nuance compte :
//   - facture entière impayée ;
//   - SOLDE impayé après versement partiel — le cas du reste à charge, quand
//     l'OPCO a versé sa part et que l'entreprise n'a pas réglé la sienne.
// Confondre les deux revient à réclamer à un client une somme qu'il a déjà
// partiellement payée. C'est la première chose qu'il vérifiera.
//
// ⚠️ Aucune menace, aucune pénalité chiffrée dans le corps : les pénalités de
// retard figurent déjà sur la facture (art. L.441-10). Les répéter ici durcit
// inutilement une première relance.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  destinataireNom: string;
  numeroFacture: string;
  montantDu: string;
  dateEcheance: string;
  joursRetard: number;
  /** Vrai si un versement partiel a déjà eu lieu (reste à charge). */
  soldePartiel?: boolean;
  /** Bloc libre saisi par l'admin dans la corbeille de validation. Facultatif. */
  messagePersonnalise?: string;
  lienFacture?: string;
}

export const qualiopiRelanceImpayeeSubject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as unknown as Payload;
  const objet = p.soldePartiel === true ? "Solde de la facture" : "Facture";
  if (locale === "fr") {
    return `${objet} ${p.numeroFacture ?? ""} — échéance dépassée · Axion-IA`;
  }
  return `Invoice ${p.numeroFacture ?? ""} — payment overdue · Axion-IA`;
};

export function QualiopiRelanceImpayeeEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const estSolde = p.soldePartiel === true;
  const intitule = estSolde ? "le solde de la facture" : "la facture";

  return (
    <EmailLayout
      preview={`${estSolde ? "Solde" : "Facture"} ${p.numeroFacture ?? ""} — échéance dépassée`}
      title={estSolde ? "Solde de facture en attente" : "Facture en attente de règlement"}
      {...(p.lienFacture
        ? { cta: { label: "Consulter la facture", href: p.lienFacture } }
        : { cta: { label: "Nous contacter", href: `${baseUrl}/fr/contact` } })}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>Bonjour {p.destinataireNom},</Text>

      <Text style={emailStyles.paragraphStyle}>
        Sauf erreur de notre part, {intitule} <strong>{p.numeroFacture}</strong>, d&apos;un montant
        de <strong>{p.montantDu}</strong>, demeure en attente de règlement. Son échéance était fixée
        au {p.dateEcheance}, soit il y a {p.joursRetard} jours.
      </Text>

      {estSolde && (
        <Text style={emailStyles.paragraphStyle}>
          Un premier versement a bien été enregistré sur cette facture : le montant ci-dessus
          correspond au solde restant dû.
        </Text>
      )}

      {/* Bloc libre : c'est ce que Will ajoute depuis la corbeille de validation. */}
      {p.messagePersonnalise ? (
        <Text style={emailStyles.paragraphStyle}>{p.messagePersonnalise}</Text>
      ) : null}

      <Text style={emailStyles.paragraphStyle}>
        Si le règlement a été effectué entre-temps, merci de ne pas tenir compte de ce message. Si
        vous rencontrez une difficulté ou si un élément vous manque pour procéder au paiement,
        répondez simplement à cet email : nous trouverons une solution.
      </Text>
    </EmailLayout>
  );
}
