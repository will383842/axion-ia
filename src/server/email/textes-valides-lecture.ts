/**
 * Lecture en base du registre « texte validé » (FAC-1).
 *
 * 🔴 Ne lève JAMAIS : une lecture en échec vaut « rien n'est validé » — jamais
 * un texte non relu qui part par accident.
 */

import { prisma } from "@/lib/prisma";

import {
  PREFIXE_TEXTES_VALIDES,
  textesValidesDepuisLignes,
  type RegistreTextesValides,
} from "./textes-valides";

export async function lireTextesValides(): Promise<RegistreTextesValides> {
  try {
    const lignes = await prisma.setting.findMany({
      where: { key: { startsWith: PREFIXE_TEXTES_VALIDES } },
      select: { key: true, value: true },
    });
    return textesValidesDepuisLignes(lignes);
  } catch {
    return new Set();
  }
}
