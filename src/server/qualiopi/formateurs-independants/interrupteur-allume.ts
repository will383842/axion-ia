/**
 * Lecture d'UN interrupteur « livré éteint » (registre `INTERRUPTEURS_SIGNATURE`),
 * pour le code qui tourne aussi dans le worker.
 *
 * 🔑 Module NEUTRE : ni `server-only`, ni Next. `interrupteurs-lecture.ts` est
 * réservé à l'application ; le worker (`tsx`) ne peut pas l'importer.
 *
 * 🔴 Ne lève JAMAIS : une lecture en échec vaut « arrêté », c'est-à-dire le
 * comportement d'avant le lot qui a posé l'interrupteur.
 */

import { prisma } from "@/lib/prisma";

import {
  cleSettingSignature,
  lireValeurSignature,
  type CleInterrupteurSignature,
} from "./interrupteurs";

export async function interrupteurAllume(cle: CleInterrupteurSignature): Promise<boolean> {
  try {
    const ligne = await prisma.setting.findUnique({
      where: { key: cleSettingSignature(cle) },
      select: { value: true },
    });
    return lireValeurSignature(ligne?.value).valeur;
  } catch {
    return false;
  }
}
