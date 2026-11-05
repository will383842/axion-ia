/**
 * Interrupteur de la preuve d'acceptation des CGV : clé `settings` `signature.cgv_preuve`.
 *
 * Module SANS `server-only` (atteignable par le worker). Absent, illisible, arrêté ou lecture
 * en panne : `null` = comportement de `main` (aucun changement). Ne lève jamais.
 * Même lecture que `interrupteur-captation.ts` ; l'écriture de la clé se fera avec l'écran
 * des interrupteurs, dans une PR ultérieure du chantier.
 */
import { prisma } from "@/lib/prisma";
import { dateAllumageSignature } from "@/server/qualiopi/formateurs-independants/interrupteurs";

export const CLE_SETTING_CGV_PREUVE = "signature.cgv_preuve";

export async function allumagePreuveCgv(): Promise<Date | null> {
  try {
    const ligne = await prisma.setting.findUnique({
      where: { key: CLE_SETTING_CGV_PREUVE },
      select: { value: true, updatedAt: true },
    });
    return ligne === null ? null : dateAllumageSignature(ligne.value, ligne.updatedAt);
  } catch {
    return null;
  }
}
