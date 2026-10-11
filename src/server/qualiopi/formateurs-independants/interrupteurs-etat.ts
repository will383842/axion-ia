/**
 * Lecture des interrupteurs formateurs pour les ENVOIS (lot L-ENV).
 *
 * Sans `server-only` : l'adaptateur d'envoi est aussi appelé par les passages du
 * worker. L'interprétation reste dans `interrupteurs.ts`.
 *
 * 🔴 Ne lève JAMAIS : une lecture en échec vaut « tout à la position sûre »
 * (envois arrêtés) — jamais un envoi neuf par accident.
 */

import { prisma } from "@/lib/prisma";

import {
  PREFIXE_CLES_FORMATEURS,
  etatsDepuisLignes,
  etatsParDefaut,
  type EtatsInterrupteurs,
} from "./interrupteurs";

export async function lireEtatsInterrupteurs(): Promise<EtatsInterrupteurs> {
  try {
    const lignes = await prisma.setting.findMany({
      where: { key: { startsWith: PREFIXE_CLES_FORMATEURS } },
      select: { key: true, value: true },
    });
    return etatsDepuisLignes(lignes);
  } catch {
    return etatsParDefaut();
  }
}
