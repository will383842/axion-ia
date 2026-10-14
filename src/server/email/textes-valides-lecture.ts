/**
 * Lecture en base du registre « texte validé » (FAC-1).
 *
 * Lot 8A (#1510-1) — un texte FORMATEUR (`textes-formateurs-a-valider.ts`) n'est validé que
 * si sa ligne porte l'EMPREINTE du texte actuel. Texte changé depuis, ou validation ancienne
 * sans empreinte : « à revalider », et l'envoi refuse comme pour un texte jamais validé.
 * Les autres textes gardent leur règle (`{ valide: true }` suffit).
 *
 * 🔴 Ne lève JAMAIS : une lecture en échec vaut « rien n'est validé » — jamais
 * un texte non relu qui part par accident.
 */

import { prisma } from "@/lib/prisma";

import { empreinteAttendue } from "./textes-formateurs-a-valider";
import {
  PREFIXE_TEXTES_VALIDES,
  lireEmpreinte,
  textesValidesDepuisLignes,
  type RegistreTextesValides,
} from "./textes-valides";

export interface EtatsTextes {
  readonly valides: RegistreTextesValides;
  /** Validés sur un AUTRE texte que l'actuel (ou sans empreinte) : la validation est tombée. */
  readonly aRevalider: ReadonlySet<string>;
}

/** Pur : sépare les validations encore justes de celles que le texte a dépassées. */
export function etatsTextesDepuisLignes(
  lignes: ReadonlyArray<{ key: string; value: unknown }>,
): EtatsTextes {
  const parCle = new Map(lignes.map((l) => [l.key, l.value]));
  const valides = new Set<string>();
  const aRevalider = new Set<string>();
  for (const cle of textesValidesDepuisLignes(lignes)) {
    const attendue = empreinteAttendue(cle);
    if (attendue === null || lireEmpreinte(parCle.get(cle)) === attendue) valides.add(cle);
    else aRevalider.add(cle);
  }
  return { valides, aRevalider };
}

export async function lireEtatsTextes(): Promise<EtatsTextes> {
  try {
    const lignes = await prisma.setting.findMany({
      where: { key: { startsWith: PREFIXE_TEXTES_VALIDES } },
      select: { key: true, value: true },
    });
    return etatsTextesDepuisLignes(lignes);
  } catch {
    return { valides: new Set(), aRevalider: new Set() };
  }
}

export async function lireTextesValides(): Promise<RegistreTextesValides> {
  return (await lireEtatsTextes()).valides;
}
