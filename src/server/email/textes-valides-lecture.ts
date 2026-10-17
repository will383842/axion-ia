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

import { etatsTextesDepuisLignes, type EtatsTextes } from "./textes-valides-etats";
import { PREFIXE_TEXTES_VALIDES, type RegistreTextesValides } from "./textes-valides";

// La partie pure vit dans `textes-valides-etats.ts` (importable sans Prisma) ; ré-exportée
// ici pour les appelants existants.
export { etatsTextesDepuisLignes, type EtatsTextes };

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
