/**
 * Les conditions financières FIGÉES au choix du formateur (lot L11b, 08 §2.5,
 * §2.8, N8) — lues par la proposition, qui les recopie dans `MissionFormateur`.
 *
 * Interrupteur `formateurs.choix_cartes` coupé : `null`, sans rien lire — la
 * proposition se fait exactement comme avant (aucun tarif sur la mission).
 *
 * 🔑 Honoraires ET régime de TVA sont figés au choix : la proposition, la
 * lettre et le paiement par mission lisent cette MÊME valeur, recopiée sur la
 * mission — jamais une valeur recalculée, jamais une valeur du navigateur. Un
 * choix sans régime figé (écrit avant ce correctif) ne recopie rien.
 *
 * Module NEUTRE (Prisma seulement) : le worker le charge. Ne lève jamais.
 */

import { prisma } from "@/lib/prisma";
import type { TvaRegimeHonoraires } from "@/server/qualiopi/remuneration/calcul";

import { estRang } from "./choix-formateur";
import { interrupteurAllume } from "./interrupteur-allume";
import { lireDateBascule, premiereJourneeSession } from "./paiement/lecture-passage";

export interface ConditionsFigees {
  readonly tarifHtCents: number;
  /** 0 = déplacement compris. */
  readonly forfaitDeplacementParJourHtCents: number;
  readonly regimeTvaFige: TvaRegimeHonoraires;
}

export async function lireConditionsFigees(
  sessionId: string,
  trainerId: string,
): Promise<ConditionsFigees | null> {
  if (!(await interrupteurAllume("choix_cartes"))) return null;
  try {
    const c = await prisma.choixFormateurSession.findUnique({
      where: { sessionId_trainerId: { sessionId, trainerId } },
      select: {
        rang: true,
        sauteAt: true,
        tarifHtCents: true,
        forfaitDeplacementParJourHtCents: true,
        regimeTvaFige: true,
      },
    });
    if (
      c === null ||
      !estRang(c.rang) ||
      c.sauteAt !== null ||
      c.tarifHtCents === null ||
      c.regimeTvaFige === null
    ) {
      return null;
    }
    return {
      tarifHtCents: c.tarifHtCents,
      forfaitDeplacementParJourHtCents: c.forfaitDeplacementParJourHtCents ?? 0,
      regimeTvaFige: c.regimeTvaFige,
    };
  } catch {
    return null;
  }
}

/**
 * La session est-elle réglée par le PAIEMENT PAR MISSION (08 §2.7, règle 1) ?
 * Oui seulement si `formateurs.passage_paiement` porte une date `D` et que la
 * première journée de la session tombe à `D` ou après — le même calcul que le
 * passage et le run mensuel (`premiereJourneeSession`).
 *
 * Sinon, c'est le relevé mensuel qui paie, au tarif de la fiche : un montant
 * figé au choix n'y serait pas celui payé. Une lecture en échec vaut « non » :
 * le choix est refusé plutôt qu'annoncé à un prix qu'on ne paierait pas.
 */
export async function sessionPayeeParMission(sessionId: string): Promise<boolean> {
  try {
    const d = await lireDateBascule(prisma);
    if (d === null) return false;
    const s = await prisma.trainingSession.findUnique({
      where: { id: sessionId },
      select: { dateDebut: true, jours: { select: { date: true } } },
    });
    if (s === null) return false;
    return premiereJourneeSession(s) >= d;
  } catch {
    return false;
  }
}
