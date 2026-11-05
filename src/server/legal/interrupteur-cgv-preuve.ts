/**
 * Interrupteur de la preuve d'acceptation des CGV : clé `settings` `signature.cgv_preuve`.
 *
 * Module SANS `server-only` (atteignable par le worker) et SANS import du domaine Qualiopi
 * (cloisonnement : `pnpm qualiopi:isolation-check`) : la valeur est lue ici, au même format
 * que les autres interrupteurs `signature.*` (`{ actif: boolean, allumeLe?: ISO }`).
 * Absent, illisible, arrêté ou lecture en panne : `null` = comportement de `main`.
 * Ne lève jamais. L'écriture de la clé viendra avec l'écran des interrupteurs (PR ultérieure).
 */
import { prisma } from "@/lib/prisma";

export const CLE_SETTING_CGV_PREUVE = "signature.cgv_preuve";

export async function allumagePreuveCgv(): Promise<Date | null> {
  try {
    const ligne = await prisma.setting.findUnique({
      where: { key: CLE_SETTING_CGV_PREUVE },
      select: { value: true, updatedAt: true },
    });
    if (ligne === null) return null;
    const v = ligne.value;
    if (v === null || typeof v !== "object" || Array.isArray(v)) return null;
    const { actif, allumeLe } = v as Record<string, unknown>;
    if (actif !== true) return null;
    if (typeof allumeLe === "string") {
      const d = new Date(allumeLe);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return ligne.updatedAt;
  } catch {
    return null;
  }
}
