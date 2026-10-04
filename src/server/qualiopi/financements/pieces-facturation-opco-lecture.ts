/**
 * Qualiopi — lecture en base des pièces de facturation OPCO d'une facture
 * (lot A8c). Partagée par le paquet téléchargeable (subrogation) et l'e-mail
 * de remboursement (entreprise) : les deux annoncent les MÊMES pièces.
 *
 * Stub-aware : au build, `null`.
 */

import { prisma } from "@/lib/prisma";
import type {
  DocumentType,
  FactureFormationDestinataire,
} from "../../../../prisma/generated/client";
import { circuitPaiementSession, type CircuitPaiementOpco } from "./circuit-paiement-opco";
import { nomOpcoDuClient } from "./opco-referentiel";
import {
  TYPES_JUSTIFICATIFS,
  selectionnerJustificatifs,
  type Justificatifs,
} from "./pieces-facturation-opco";

export interface FacturePourPieces {
  id: string;
  numero: string;
  statut: string;
  destinataire: FactureFormationDestinataire;
  destinataireNom: string;
  subrogation: boolean;
  avoirDeId: string | null;
  numeroDossierOpco: string | null;
  montantTtcCents: number | null;
  montantHtCents: number;
  paidAt: Date | null;
  clientId: string | null;
  /** Document PDF de la facture, `null` tant qu'il n'est pas généré. */
  document: { type: DocumentType; numero: string; createdAt: Date } | null;
  session: {
    id: string;
    numero: string;
    titre: string;
    financementType: string | null;
    opcoSubrogation: boolean;
  } | null;
  circuit: CircuitPaiementOpco;
  client: {
    raisonSociale: string | null;
    contactNom: string | null;
    contactEmail: string | null;
  } | null;
  /** Nom lisible de l'OPCO du client, par la règle unique. */
  opcoNom: string;
  justificatifs: Justificatifs;
}

export async function chargerPiecesFacturation(
  factureId: string,
): Promise<FacturePourPieces | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return null;
  const f = await prisma.factureFormation.findUnique({
    where: { id: factureId },
    select: {
      id: true,
      numero: true,
      statut: true,
      destinataire: true,
      destinataireNom: true,
      subrogation: true,
      avoirDeId: true,
      numeroDossierOpco: true,
      montantTtcCents: true,
      montantHtCents: true,
      paidAt: true,
      clientId: true,
      documentId: true,
      client: {
        select: {
          raisonSociale: true,
          contactNom: true,
          contactEmail: true,
          opco: true,
          opcoIdentifie: true,
        },
      },
      session: {
        select: {
          id: true,
          numero: true,
          titreSession: true,
          financementType: true,
          opcoSubrogation: true,
          documents: {
            where: { type: { in: [...TYPES_JUSTIFICATIFS] } },
            orderBy: { createdAt: "desc" },
            take: 100,
            select: {
              id: true,
              type: true,
              numero: true,
              createdAt: true,
              annuleeAt: true,
              traineeId: true,
            },
          },
        },
      },
    },
  });
  if (!f) return null;

  const document =
    f.documentId === null
      ? null
      : await prisma.documentGenere.findUnique({
          where: { id: f.documentId },
          select: { type: true, numero: true, createdAt: true },
        });

  const session =
    f.session === null
      ? null
      : {
          id: f.session.id,
          numero: f.session.numero,
          titre: f.session.titreSession,
          financementType: f.session.financementType,
          opcoSubrogation: f.session.opcoSubrogation,
        };

  return {
    id: f.id,
    numero: f.numero,
    statut: f.statut,
    destinataire: f.destinataire,
    destinataireNom: f.destinataireNom,
    subrogation: f.subrogation,
    avoirDeId: f.avoirDeId,
    numeroDossierOpco: f.numeroDossierOpco,
    montantTtcCents: f.montantTtcCents,
    montantHtCents: f.montantHtCents,
    paidAt: f.paidAt,
    clientId: f.clientId,
    document,
    session,
    circuit: session === null ? "hors_opco" : circuitPaiementSession(session),
    client: f.client
      ? {
          raisonSociale: f.client.raisonSociale,
          contactNom: f.client.contactNom,
          contactEmail: f.client.contactEmail,
        }
      : null,
    opcoNom: nomOpcoDuClient(f.client),
    justificatifs: selectionnerJustificatifs(f.session?.documents ?? []),
  };
}
