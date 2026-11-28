/**
 * Journal des autofactures (point 25) — lecture seule de `PieceAutofactureApporteur`, avec
 * l'apporteur (dénomination, SIREN) et les dates de virement. Aucune écriture.
 */
import { prisma } from "@/lib/prisma";

import { jourParis } from "./autofacture-donnees";
import type { LigneJournal } from "./journal-autofactures-types";

const NUMERO = /^AXI-APP-(\d{4})-(\d{4,})$/;

/**
 * Numéros manquants à l'intérieur de la série, année par année (entre le plus petit et le plus
 * grand numéro présents). Pour AFFICHAGE seulement : rien n'est corrigé.
 */
export function trousDeNumerotation(numeros: readonly string[]): string[] {
  const parAnnee = new Map<string, { largeur: number; vus: Set<number> }>();
  for (const n of numeros) {
    const m = NUMERO.exec(n);
    if (!m) continue;
    const e = parAnnee.get(m[1]!) ?? { largeur: 4, vus: new Set<number>() };
    e.largeur = Math.max(e.largeur, m[2]!.length);
    e.vus.add(Number(m[2]));
    parAnnee.set(m[1]!, e);
  }
  const trous: string[] = [];
  for (const annee of [...parAnnee.keys()].sort()) {
    const { largeur, vus } = parAnnee.get(annee)!;
    const tous = [...vus];
    const min = Math.min(...tous);
    const max = Math.max(...tous);
    for (let i = min + 1; i < max; i++)
      if (!vus.has(i)) trous.push(`AXI-APP-${annee}-${String(i).padStart(largeur, "0")}`);
  }
  return trous;
}

/** Jours de Paris « AAAA-MM-JJ », bornes INCLUSES, sur `emiseAt`, triés par numéro. */
export async function lireJournal(p: {
  du: string;
  au: string;
}): Promise<{ lignes: LigneJournal[]; trous: string[] }> {
  const jour = 86_400_000;
  // Marge d'un jour de chaque côté ; le filtre exact se fait sur le jour de Paris.
  const pieces = await prisma.pieceAutofactureApporteur.findMany({
    where: {
      emiseAt: {
        gte: new Date(Date.parse(`${p.du}T00:00:00Z`) - jour),
        lt: new Date(Date.parse(`${p.au}T00:00:00Z`) + 2 * jour),
      },
    },
    orderBy: { numero: "asc" },
  });
  const dansLaPlage = pieces.filter((x) => {
    const j = jourParis(x.emiseAt);
    return j >= p.du && j <= p.au;
  });
  const numeros = dansLaPlage.map((x) => x.numero);
  const [apporteurs, virements] = await Promise.all([
    prisma.apporteurReseau.findMany({
      where: { id: { in: [...new Set(dansLaPlage.map((x) => x.apporteurId))] } },
      select: { id: true, denomination: true, siren: true },
    }),
    prisma.apporteurVirementCompte.findMany({
      where: { autofactureNumero: { in: numeros } },
      select: { autofactureNumero: true, verseAt: true },
      orderBy: { verseAt: "asc" },
    }),
  ]);
  const parApporteur = new Map(apporteurs.map((a) => [a.id, a]));
  const lignes: LigneJournal[] = dansLaPlage.map((x) => {
    const a = parApporteur.get(x.apporteurId);
    return {
      numero: x.numero,
      genre: x.genre === "avoir" ? "avoir" : "facture",
      emiseAt: x.emiseAt,
      factureRectifiee: x.factureRectifiee,
      denomination: a?.denomination ?? null,
      siren: a?.siren ?? null,
      regimeTva: x.regimeTva,
      numeroTva: x.numeroTva,
      totalHtCents: x.totalHtCents,
      totalTvaCents: x.totalTvaCents,
      totalTtcCents: x.totalTtcCents,
      origine: x.origine,
      viree: virements.filter((v) => v.autofactureNumero === x.numero).map((v) => v.verseAt),
    };
  });
  return { lignes, trous: trousDeNumerotation(numeros) };
}
