/**
 * Lecture des interrupteurs de l'ENTRÉE des formateurs freelance (lot L0g),
 * pour les règles qui en dépendent.
 *
 * Module neutre (ni `server-only`, ni Next) : le worker l'atteint par la
 * réponse automatique aux candidatures. Aucune variable lue au chargement.
 */

import { prisma } from "@/lib/prisma";

import {
  CLES_INTERRUPTEURS_ENTREE,
  cleSettingEntree,
  etatsEntreeDepuisLignes,
  etatsEntreeParDefaut,
  type EtatsInterrupteursEntree,
} from "./interrupteurs";

/**
 * 🔴 Ne lève JAMAIS : une lecture en échec vaut « tout arrêté », c'est-à-dire
 * le comportement d'avant le lot.
 */
export async function lireEtatsEntree(): Promise<EtatsInterrupteursEntree> {
  try {
    const lignes = await prisma.setting.findMany({
      where: { key: { in: CLES_INTERRUPTEURS_ENTREE.map(cleSettingEntree) } },
      select: { key: true, value: true },
    });
    return etatsEntreeDepuisLignes(Array.isArray(lignes) ? lignes : []);
  } catch {
    return etatsEntreeParDefaut();
  }
}
