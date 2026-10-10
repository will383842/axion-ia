// Banc @formateurs — SEMIS DES INTERRUPTEURS (lignes de la table `settings`).
//
// Les lots du chantier pilotent leurs bascules par des lignes `settings`
// (clé → valeur JSON), comme le coupe-circuit du guide IA. Le banc les pose
// avant un test et RESTAURE l'état d'avant après : valeur précédente remise,
// ou ligne effacée si elle n'existait pas. Jamais d'état laissé à la suite.

import type { Prisma } from "../../../../prisma/generated/client/index.js";

import { prisma } from "./base";

export type ValeurInterrupteur = Prisma.InputJsonValue;

/** Pose les interrupteurs ; rend la fonction qui remet l'état d'avant. */
export async function semerInterrupteurs(
  interrupteurs: Readonly<Record<string, ValeurInterrupteur>>,
): Promise<() => Promise<void>> {
  const cles = Object.keys(interrupteurs);
  const avant = await prisma.setting.findMany({
    where: { key: { in: cles } },
    select: { key: true, value: true, description: true },
  });
  for (const [key, value] of Object.entries(interrupteurs)) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value, description: "banc @formateurs — posé par un test" },
      update: { value },
    });
  }
  return async () => {
    for (const key of cles) {
      const precedent = avant.find((a) => a.key === key);
      if (precedent === undefined) {
        await prisma.setting.deleteMany({ where: { key } });
      } else {
        await prisma.setting.update({
          where: { key },
          data: {
            value: precedent.value as ValeurInterrupteur,
            description: precedent.description,
          },
        });
      }
    }
  };
}

/** Lit un interrupteur tel qu'il est en base (`undefined` = ligne absente). */
export async function lireInterrupteur(key: string): Promise<unknown> {
  const ligne = await prisma.setting.findUnique({ where: { key }, select: { value: true } });
  return ligne === null ? undefined : ligne.value;
}
