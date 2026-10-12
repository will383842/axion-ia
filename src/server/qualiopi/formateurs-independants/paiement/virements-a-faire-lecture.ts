/**
 * Formateurs indépendants — l'état des virements de MISSION dans la vue
 * « Virements à faire » (lot D, M9 ; W-8).
 *
 * Pour chaque relevé de mission dû : l'IBAN AFFICHÉ (fin et empreinte, que la
 * vue renvoie au clic), les rubriques suspendues lues par la MÊME garde que
 * « Virement fait » (`contexteVirementMission`), et le supplément légal de
 * retard, calculé pour être affiché — jamais écrit ici (décision 87).
 *
 * 🔒 Aucun IBAN en clair ne sort d'ici.
 */

import { prisma } from "@/lib/prisma";

import type { Retard } from "../argent/calcul-mission";
import { contexteVirementMission, ibanAffichePourVirement } from "./virement-mission-base";
import type { MotifSuspensionVirement } from "./virement-mission";

export interface EtatVirementMission {
  readonly fin4: string | null;
  readonly empreinte: string | null;
  /** Vide : le virement peut partir (sous réserve des garanties relues au clic). */
  readonly motifs: ReadonlyArray<MotifSuspensionVirement>;
  readonly retard: Retard | null;
}

export async function etatsVirementsMission(
  pieceIds: ReadonlyArray<string>,
  maintenant: Date,
): Promise<Map<string, EtatVirementMission>> {
  const etats = new Map<string, EtatVirementMission>();
  if (pieceIds.length === 0) return etats;
  const releves = await prisma.trainerStatement.findMany({
    where: { id: { in: [...pieceIds] }, origine: "passage_mission" },
    select: { id: true, trainerId: true, echeanceAt: true, totalTtcCents: true },
  });
  for (const r of releves) {
    const iban = await ibanAffichePourVirement(prisma, r.trainerId).catch(() => null);
    if (r.echeanceAt === null) {
      etats.set(r.id, {
        fin4: iban?.fin4 ?? null,
        empreinte: iban?.empreinte ?? null,
        motifs: [],
        retard: null,
      });
      continue;
    }
    try {
      const c = await contexteVirementMission(
        prisma,
        { trainerId: r.trainerId, echeanceAt: r.echeanceAt, totalTtcCents: r.totalTtcCents },
        iban?.empreinte ?? null,
        maintenant,
      );
      etats.set(r.id, {
        fin4: iban?.fin4 ?? null,
        empreinte: iban?.empreinte ?? null,
        motifs: c.verdict.motifs,
        retard: c.verdict.retard,
      });
    } catch {
      // Clé absente, IBAN illisible : présenté comme suspendu, jamais comme payable.
      etats.set(r.id, { fin4: null, empreinte: null, motifs: ["iban_absent"], retard: null });
    }
  }
  return etats;
}
