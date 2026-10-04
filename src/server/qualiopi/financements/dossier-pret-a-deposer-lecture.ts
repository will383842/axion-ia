/**
 * Qualiopi — Dossier prêt à déposer (chantier OPCO A6) : lecture en base.
 *
 * Rassemble, pour UNE session, l'état réel des pièces de la demande (registre
 * des documents + devis rattaché) et l'encart de dépôt (référentiel OPCO,
 * régime de paiement, état des fonds). Requêtes bornées ; stub-aware : au
 * build, `null`.
 */

import { prisma } from "@/lib/prisma";
import { existsInR2, isR2Configured } from "@/lib/r2-storage";
import { opcoDuClient } from "./opco-referentiel";
import { regimePaiementDeSession } from "./regime-paiement-session";
import { etatFondsDuClient } from "./etat-fonds-opco-lecture";
import { bandeauEtatFonds } from "./etat-fonds-opco";
import {
  PIECES_DEMANDE_OPCO,
  confirmerExemplairesSignes,
  encartDepot,
  etatPiecesDemande,
  type DocumentLu,
  type EncartDepot,
  type EtatPiece,
} from "./dossier-pret-a-deposer";

export interface DossierPretADeposer {
  numeroSession: string;
  intituleFormation: string;
  raisonSociale: string | null;
  pieces: EtatPiece[];
  encart: EncartDepot;
}

const TYPES_PIECES = [...new Set(PIECES_DEMANDE_OPCO.flatMap((p) => p.types))];
const SELECT_DOC = {
  id: true,
  type: true,
  numero: true,
  createdAt: true,
  annuleeAt: true,
  statutSignature: true,
  exemplaireSigneKey: true,
} as const;

export async function chargerDossierPretADeposer(
  sessionId: string,
): Promise<DossierPretADeposer | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return null;
  const s = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      numero: true,
      titreSession: true,
      dateDebut: true,
      client: {
        select: {
          raisonSociale: true,
          opco: true,
          opcoIdentifie: true,
          idcc: true,
          effectif: true,
        },
      },
      devis: { select: { documentGenere: { select: SELECT_DOC } } },
      documents: {
        where: { type: { in: TYPES_PIECES } },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: SELECT_DOC,
      },
    },
  });
  if (!s) return null;

  // OPCO typé (A1) d'abord ; à défaut, l'ancien texte libre s'il est un identifiant connu.
  const opco = opcoDuClient(s.client);
  const documents: DocumentLu[] = [...s.documents];
  if (s.devis?.documentGenere) documents.push(s.devis.documentGenere);

  const [regime, fonds, pieces] = await Promise.all([
    regimePaiementDeSession(sessionId),
    s.client
      ? etatFondsDuClient({ opco, idcc: s.client.idcc, effectif: s.client.effectif })
      : Promise.resolve(null),
    // L'exemplaire signé est constaté au stockage : sans R2, rien n'est constatable.
    confirmerExemplairesSignes(etatPiecesDemande(documents), (cle) =>
      isR2Configured() ? existsInR2(cle) : Promise.resolve(false),
    ),
  ]);
  const bandeau = bandeauEtatFonds(fonds);

  return {
    numeroSession: s.numero,
    intituleFormation: s.titreSession,
    raisonSociale: s.client?.raisonSociale ?? null,
    pieces,
    encart: encartDepot({
      opco,
      dateDebut: s.dateDebut,
      regime: regime.regime,
      etatFonds: bandeau?.texte ?? null,
    }),
  };
}
