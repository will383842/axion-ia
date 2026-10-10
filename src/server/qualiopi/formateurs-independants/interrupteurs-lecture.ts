import "server-only";

/**
 * Lecture des interrupteurs formateurs pour l'écran console (lot S0-ter).
 *
 * Seul lecteur en base des clés `formateurs.*` ; l'interprétation reste dans
 * `interrupteurs.ts`.
 */

import { prisma } from "@/lib/prisma";

import {
  CLES_INTERRUPTEURS,
  PREFIXE_CLES_FORMATEURS,
  cleSetting,
  etatsDepuisLignes,
  lireValeur,
  type CleInterrupteur,
  type EtatsInterrupteurs,
} from "./interrupteurs";

export interface LigneInterrupteur {
  readonly cle: CleInterrupteur;
  readonly valeur: boolean | string | null;
  /** Faux si la ligne manque ou ne se lit pas : la position sûre s'applique. */
  readonly lisible: boolean;
  readonly misAJourLe: Date | null;
  readonly misAJourPar: string | null;
}

export async function lireInterrupteurs(): Promise<{
  etats: EtatsInterrupteurs;
  lignes: ReadonlyArray<LigneInterrupteur>;
}> {
  const brutes = await prisma.setting.findMany({
    where: { key: { startsWith: PREFIXE_CLES_FORMATEURS } },
    select: { key: true, value: true, updatedAt: true, updatedBy: true },
  });
  const auteurs = [...new Set(brutes.map((b) => b.updatedBy).filter((x): x is string => !!x))];
  const noms = new Map(
    (auteurs.length
      ? await prisma.adminUser.findMany({
          where: { id: { in: auteurs } },
          select: { id: true, name: true },
        })
      : []
    ).map((u) => [u.id, u.name]),
  );
  const parCle = new Map(brutes.map((b) => [b.key, b]));
  const lignes = CLES_INTERRUPTEURS.map((cle): LigneInterrupteur => {
    const brute = parCle.get(cleSetting(cle));
    const lu = lireValeur(cle, brute?.value);
    return {
      cle,
      valeur: lu.valeur,
      lisible: lu.lisible,
      misAJourLe: brute?.updatedAt ?? null,
      misAJourPar: brute?.updatedBy ? (noms.get(brute.updatedBy) ?? null) : null,
    };
  });
  return { etats: etatsDepuisLignes(brutes), lignes };
}
