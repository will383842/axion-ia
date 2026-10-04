/**
 * Qualiopi — Estimation au barème OPCO d'une SESSION (lot OPCO A7b, manque n°9).
 *
 * Ce que l'OPCO du client donnerait, en LECTURE SEULE, à afficher sur la page
 * Financement en regard du barème saisi à la main. Réutilise
 * `estimateOpcoCoverage` (celle des devis) : même barème, même avertissement
 * quand le chiffre n'est pas adossé à un barème relevé. Rien n'est écrit.
 *
 * Barème résolu à la DATE DE DÉBUT de la session (pas au jour) ; OPCO lu par la
 * règle unique (`opcoDuClient`). Stub-aware : au build, `null`.
 */

import { prisma } from "@/lib/prisma";
import {
  estimateOpcoCoverage,
  type OpcoCoverageInput,
  type OpcoCoverageResult,
} from "@/server/qualiopi/crm/devis";
import { effectifDuClient, idccValide } from "./bareme-opco-branche";
import { opcoDuClient } from "./opco-referentiel";

interface SessionLue {
  dateDebut: Date;
  modalite: "presentiel" | "distanciel" | "hybride";
  interEntreprises: boolean;
  dureeReelleHeures: number | null;
  formation: { dureeHeures: number } | null;
  nbParticipantsPrevus: number;
  nbParticipantsReels: number | null;
  montantHtCents: number;
  client: {
    opco: string | null;
    opcoIdentifie: string | null;
    idcc: string | null;
    effectif: number | null;
    opcoEnveloppeAnnuelleCents: number | null;
  } | null;
}

/** Projection PURE de la session vers l'entrée de l'estimation ; `null` sans OPCO. */
export function entreeEstimationDeSession(s: SessionLue): OpcoCoverageInput | null {
  const opco = opcoDuClient(s.client);
  if (s.client === null || opco === null) return null;
  const idcc = idccValide(s.client.idcc);
  const effectif = effectifDuClient(s.client);
  const enveloppe = s.client.opcoEnveloppeAnnuelleCents;
  return {
    nbParticipants: s.nbParticipantsReels ?? s.nbParticipantsPrevus,
    dureeHeures: s.dureeReelleHeures ?? s.formation?.dureeHeures ?? 0,
    modalite: !s.interEntreprises
      ? "intra"
      : s.modalite === "distanciel"
        ? "inter_distanciel"
        : "inter_presentiel",
    montantHtCents: s.montantHtCents,
    ...(enveloppe !== null ? { enveloppeRestanteCents: enveloppe } : {}),
    opco,
    ...(idcc !== null ? { idcc } : {}),
    ...(effectif !== undefined ? { effectif } : {}),
    asOf: s.dateDebut,
  };
}

/** Estimation de la session, ou `null` (pas d'OPCO, build, lecture impossible). */
export async function estimationOpcoDeSession(
  sessionId: string,
): Promise<OpcoCoverageResult | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return null;
  try {
    const s = await prisma.trainingSession.findUnique({
      where: { id: sessionId },
      select: {
        dateDebut: true,
        modalite: true,
        interEntreprises: true,
        dureeReelleHeures: true,
        formation: { select: { dureeHeures: true } },
        nbParticipantsPrevus: true,
        nbParticipantsReels: true,
        montantHtCents: true,
        client: {
          select: {
            opco: true,
            opcoIdentifie: true,
            idcc: true,
            effectif: true,
            opcoEnveloppeAnnuelleCents: true,
          },
        },
      },
    });
    const entree = s ? entreeEstimationDeSession(s) : null;
    return entree ? await estimateOpcoCoverage(entree) : null;
  } catch {
    return null;
  }
}
