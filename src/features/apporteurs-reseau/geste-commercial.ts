// #2464 point 18 : un avoir émis à titre de GESTE COMMERCIAL (bon d'achat offert, hors délai) ne fait
// jamais reprendre la commission de l'apporteur (contrat 2.8, art. 4.5). Le marqueur est posé sur la
// pièce d'avoir (`factures_formation.geste_commercial`) par la console d'émission de l'avoir.
//
// ⚠️ Atteint par le WORKER, qui peut tourner AVANT que la migration de la colonne ne soit passée :
// sa présence est vérifiée, et sans elle le filtre ne s'applique pas (aucun avoir ne peut alors porter
// le marqueur). Même patron que `litige.ts`. Aucun `server-only`.
import { prisma } from "@/lib/prisma";

let disponible: { lu: number } | null = null;
const RELIRE_MS = 10 * 60 * 1000;

export async function gesteCommercialDisponible(): Promise<boolean> {
  if (disponible && Date.now() - disponible.lu < RELIRE_MS) return true;
  try {
    await prisma.$queryRaw`SELECT geste_commercial FROM factures_formation LIMIT 0`;
    disponible = { lu: Date.now() };
    return true;
  } catch {
    disponible = null;
    return false;
  }
}

/** Pour les tests : oublie la lecture de la colonne. */
export function oublierGesteCommercialDisponible(): void {
  disponible = null;
}

/**
 * Le filtre « avoirs qui ont un effet sur la commission » à ajouter aux requêtes d'avoirs d'une commande :
 * les avoirs de geste commercial en sont écartés (ils ne réduisent ni le net ni la commission).
 */
export async function horsGesteCommercial(): Promise<
  { gesteCommercial: false } | Record<string, never>
> {
  return (await gesteCommercialDisponible()) ? { gesteCommercial: false } : {};
}
