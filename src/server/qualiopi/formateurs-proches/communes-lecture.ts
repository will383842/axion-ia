/**
 * Résolution d'un code postal en commune, lue dans `communes_geo` (lots L15a,
 * L15c). Aucune requête réseau : le référentiel est en base. Sans
 * `server-only` (appelé par la console et, plus tard, par le worker).
 */

import { prisma } from "@/lib/prisma";

import { choisirCommune, normaliserCodePostal, type CommuneCandidate } from "./lieu";

export interface CommuneResolue {
  readonly commune: CommuneCandidate;
  readonly codePostal: string;
  readonly approximatif: boolean;
}

export async function resoudreCodePostal(
  codePostal: string | null | undefined,
  ville: string | null | undefined,
): Promise<CommuneResolue | null> {
  const cp = normaliserCodePostal(codePostal);
  if (!cp) return null;
  const candidates = await prisma.communeGeo.findMany({
    where: { codesPostaux: { has: cp } },
    select: {
      codeInsee: true,
      nom: true,
      latitude: true,
      longitude: true,
      departement: true,
      population: true,
    },
  });
  const choix = choisirCommune(candidates, ville);
  return choix
    ? { commune: choix.commune, codePostal: cp, approximatif: choix.approximatif }
    : null;
}
