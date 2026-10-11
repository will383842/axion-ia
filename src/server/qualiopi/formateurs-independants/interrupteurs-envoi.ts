/**
 * Lecture d'UN interrupteur d'envoi en base, pour un passage du worker
 * (lot L2c, ADR 0066 (f)).
 *
 * Sans `server-only` : appelé sous `tsx`, hors de Next. L'interprétation reste
 * dans `interrupteurs.ts` ; ici on lit la ligne, rien d'autre.
 *
 * 🔴 Ne lève JAMAIS : ligne absente, illisible ou base en panne = ARRÊTÉ.
 */

import { prisma } from "@/lib/prisma";

import { cleSetting, lireValeur, type CleEnvoi } from "./interrupteurs";

export async function envoiAllume(cle: CleEnvoi): Promise<boolean> {
  try {
    const ligne = await prisma.setting.findUnique({
      where: { key: cleSetting(cle) },
      select: { value: true },
    });
    return lireValeur(cle, ligne?.value).valeur === true;
  } catch {
    return false;
  }
}
