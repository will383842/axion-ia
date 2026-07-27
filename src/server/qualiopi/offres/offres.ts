/**
 * Qualiopi — Lecture du référentiel offres_site.
 *
 * Stub-aware (build `stub.invalid` → findMany/findUnique renvoient []/null, on
 * dégrade proprement, jamais de `*OrThrow`). Le libellé prix est résolu à la
 * volée depuis pricing.ts (SSOT) via le résolveur.
 */

import { prisma } from "@/lib/prisma";
import {
  resolveOffreDevisNoteFr,
  resolveOffrePrice,
  resolveOffrePriceEur,
} from "@/server/qualiopi/offres/pricing-resolver";
import type { OffreSite } from "@/server/qualiopi/offres/types";

export interface OffreWithPrice {
  offre: OffreSite;
  /** Libellé prix FR résolu : legacy (tierId → pricing.ts) ou V2 (gamme+durée → matrice). */
  prixLabelFr: string;
  /**
   * Le même prix, en EUROS et FERME — `null` dès qu'aucun montant ne peut être
   * inscrit sur une pièce (sur devis, fourchette, « à partir de », paliers).
   *
   * Résolu ICI, à côté du libellé, et pas chez l'appelant : c'est ce qui empêche
   * qu'un écran affiche « Sur devis » tout en pré-remplissant un montant. Deux
   * résolutions séparées finiraient par diverger.
   */
  prixHtEur: number | null;
  /** Rappel effectif + frais à afficher sous le PU HT d'un devis. */
  noteDevisFr: string;
}

function withPrice(offre: OffreSite): OffreWithPrice {
  return {
    offre,
    prixLabelFr: resolveOffrePrice(offre, "fr"),
    prixHtEur: resolveOffrePriceEur(offre),
    noteDevisFr: resolveOffreDevisNoteFr(offre),
  };
}

/** Toutes les offres (admin), triées par code. Stub-safe → [] au build. */
export async function listOffres(opts?: { actifOnly?: boolean }): Promise<OffreWithPrice[]> {
  try {
    const rows = await prisma.offreSite.findMany({
      ...(opts?.actifOnly ? { where: { actif: true } } : {}),
      orderBy: { code: "asc" },
    });
    return rows.map(withPrice);
  } catch {
    return [];
  }
}

/** Offre par slug (fiche publique). Stub-safe → null au build. */
export async function getOffreBySlug(slug: string): Promise<OffreWithPrice | null> {
  try {
    const row = await prisma.offreSite.findUnique({ where: { slug } });
    return row ? withPrice(row) : null;
  } catch {
    return null;
  }
}

/** Offre par tierId. */
export async function getOffreByTierId(tierId: string): Promise<OffreWithPrice | null> {
  try {
    const row = await prisma.offreSite.findUnique({ where: { tierId } });
    return row ? withPrice(row) : null;
  } catch {
    return null;
  }
}

/** Slugs des offres actives (generateStaticParams Phase B). */
export async function listActiveOffreSlugs(): Promise<string[]> {
  try {
    const rows = await prisma.offreSite.findMany({
      where: { actif: true },
      select: { slug: true },
    });
    return rows.map((r) => r.slug);
  } catch {
    return [];
  }
}
