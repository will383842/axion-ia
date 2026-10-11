/**
 * Les conditions financières FIGÉES au choix du formateur (lot L11b, 08 §2.5,
 * §2.8, N8) — lues par la proposition, qui les recopie dans `MissionFormateur`.
 *
 * Interrupteur `formateurs.choix_cartes` coupé : `null`, sans rien lire — la
 * proposition se fait exactement comme avant (aucun tarif sur la mission).
 *
 * Module NEUTRE (Prisma seulement) : le worker le charge. Ne lève jamais.
 */

import { prisma } from "@/lib/prisma";

import { estRang } from "./choix-formateur";
import { interrupteurAllume } from "./interrupteur-allume";

export interface ConditionsFigees {
  readonly tarifHtCents: number;
  /** 0 = déplacement compris. */
  readonly forfaitDeplacementParJourHtCents: number;
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
      },
    });
    if (c === null || !estRang(c.rang) || c.sauteAt !== null || c.tarifHtCents === null) {
      return null;
    }
    return {
      tarifHtCents: c.tarifHtCents,
      forfaitDeplacementParJourHtCents: c.forfaitDeplacementParJourHtCents ?? 0,
    };
  } catch {
    return null;
  }
}
