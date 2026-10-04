/**
 * Qualiopi — transmission des pièces de remboursement OPCO à l'entreprise
 * (lot A8c, circuit « remboursement »).
 *
 * Hors subrogation, l'entreprise paie l'organisme puis se fait rembourser par
 * son OPCO, sur pièces. Une fois sa facture INTÉGRALEMENT réglée, on lui
 * prépare un e-mail joignant la facture (attestée acquittée dans le corps) et
 * le(s) certificat(s) de réalisation — « pour votre demande de remboursement
 * auprès de votre OPCO ». Rien n'est promis de la décision de l'OPCO.
 *
 * 🛑 Garé en « E-mails à valider » (`exigerValidation: true`), quelles que
 * soient les règles d'automatisation : ordre permanent de Will, rien ne part à
 * un client sans validation.
 *
 * ⚠️ La feuille d'émargement n'est PAS jointe : son tirage à jour n'est jamais
 * persisté (`emargement-tirage.ts`) et la pièce scellée du registre, émise
 * avant la session, ne porte pas les signatures. Elle reste téléchargeable
 * depuis la fiche facture (« Pièces pour le remboursement OPCO »).
 *
 * Service PUR de toute garde ou journal : appelé par l'encaissement.
 */

import { prisma } from "@/lib/prisma";
import { documentPdfKey } from "@/lib/r2-storage";
import { enqueueEmail } from "@/server/queue/queues";
import { factureOuvreLaTransmissionRemboursement } from "./circuit-paiement-opco";
import { libellesPiecesTransmises } from "./pieces-facturation-opco";
import { chargerPiecesFacturation } from "./pieces-facturation-opco-lecture";

export const TEMPLATE_TRANSMISSION_REMBOURSEMENT = "facture-pieces-remboursement-opco" as const;

export type ResultatTransmission =
  | { statut: "preparee"; to: string }
  | { statut: "sans_objet" }
  | { statut: "impossible"; motif: string };

const eur = (cents: number): string =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
const dateFr = (d: Date): string => d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });

export async function preparerTransmissionRemboursementOpco(
  factureId: string,
): Promise<ResultatTransmission> {
  const f = await chargerPiecesFacturation(factureId);
  if (f === null || f.statut !== "payee") return { statut: "sans_objet" };
  if (
    !factureOuvreLaTransmissionRemboursement({
      destinataire: f.destinataire,
      subrogation: f.subrogation,
      avoirDeId: f.avoirDeId,
      session: f.session,
    })
  ) {
    return { statut: "sans_objet" };
  }

  // Jamais deux fois : un e-mail déjà garé ou déjà parti pour cette facture.
  const [garees, parties] = await Promise.all([
    prisma.emailOutbox.count({
      where: { template: TEMPLATE_TRANSMISSION_REMBOURSEMENT, entityId: f.id },
    }),
    prisma.emailLog.count({
      where: { template: TEMPLATE_TRANSMISSION_REMBOURSEMENT, entityId: f.id },
    }),
  ]);
  if (garees + parties > 0) return { statut: "sans_objet" };

  if (f.document === null) {
    return { statut: "impossible", motif: "PDF de la facture absent" };
  }
  const to = f.client?.contactEmail?.trim();
  if (to === undefined || to === "") {
    return { statut: "impossible", motif: "aucun e-mail de contact sur le client" };
  }

  const { certificats, releves } = f.justificatifs;
  const attachments = [
    { filename: `${f.numero}.pdf`, r2Key: documentPdfKey(f.document) },
    ...[...certificats, ...releves].map((d) => ({
      filename: `${d.numero}.pdf`,
      r2Key: documentPdfKey(d),
    })),
  ];

  const { enqueued, garePourValidation = false } = await enqueueEmail(
    TEMPLATE_TRANSMISSION_REMBOURSEMENT,
    to,
    "fr",
    {
      clientNom: f.client?.contactNom ?? f.client?.raisonSociale ?? f.destinataireNom,
      numero: f.numero,
      montantLabel: `${eur(f.montantTtcCents ?? f.montantHtCents)} TTC`,
      ...(f.paidAt !== null ? { payeeLe: dateFr(f.paidAt) } : {}),
      opcoNom: f.opcoNom,
      ...(f.session?.titre ? { intituleFormation: f.session.titre } : {}),
      pieces: libellesPiecesTransmises({
        factureNumero: f.numero,
        certificats: certificats.length,
        releves: releves.length,
      }),
    },
    {
      attachments,
      ...(f.clientId !== null ? { clientId: f.clientId } : {}),
      entityType: "FactureFormation",
      entityId: f.id,
      sujet: `Facture ${f.numero} acquittée`,
      exigerValidation: true,
    },
  );
  if (!enqueued && !garePourValidation) {
    return { statut: "impossible", motif: "file d'envoi indisponible" };
  }
  return { statut: "preparee", to };
}
