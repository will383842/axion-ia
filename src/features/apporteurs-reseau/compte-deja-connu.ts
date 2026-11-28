/**
 * Lot 6 : quelles AUTRES fiches portent déjà ce compte (parrain, filleul ou tout autre apporteur) ?
 * Comparaison par EMPREINTE, côté serveur : l'IBAN d'une fiche est déchiffré ici le temps du calcul
 * et ne sort jamais (on ne rend que l'identifiant de la fiche).
 */
import "server-only";

import { empreinteIban } from "@/lib/iban-empreinte";
import { prisma } from "@/lib/prisma";
import { lireIbanClair } from "./iban-purge";

export async function apporteursAyantCeCompte(empreinte: string, sauf: string): Promise<string[]> {
  const fiches = await prisma.apporteurReseau.findMany({
    where: { id: { not: sauf }, iban: { not: null } },
    select: { id: true, iban: true },
    take: 5000,
  });
  const trouves: string[] = [];
  for (const f of fiches) {
    const clair = lireIbanClair(f.iban);
    if (clair && empreinteIban(clair) === empreinte) trouves.push(f.id);
  }
  return trouves;
}
