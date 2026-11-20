/**
 * Lectures SEULES du suivi d'horodatage (console) — aucune écriture, schéma inchangé.
 * Les écritures et les réessais restent dans `horodatage-signature.ts` (worker).
 */

import { prisma } from "@/lib/prisma";
import type { LigneHorodatage } from "@/server/qualiopi/devis/console-chaine-devis";

/** Au-delà de ce délai, un jeton encore attendu devient une ligne de « À traiter ». */
export const DELAI_ALERTE_HORODATAGE_MS = 24 * 60 * 60 * 1000;

/** Prisma : table (P2021) ou colonne (P2022) absente — migration pas encore passée. */
function tableAbsente(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return code === "P2021" || code === "P2022";
}

/** Une requête pour toutes les signatures d'une pièce. Table absente : liste vide. */
export async function lireHorodatagesDeSignatures(
  signatureIds: readonly string[],
): Promise<LigneHorodatage[]> {
  if (signatureIds.length === 0) return [];
  try {
    return await prisma.documentSignatureHorodatage.findMany({
      where: { signatureId: { in: [...signatureIds] } },
      select: { statut: true, horodateAt: true, creeAt: true, derniereErreur: true },
    });
  } catch (err) {
    if (tableAbsente(err)) return [];
    throw err;
  }
}

export interface HorodatageEnRetard {
  readonly id: string;
  readonly depuis: Date;
  readonly essais: number;
  readonly numero: string;
  readonly devisId: string | null;
}

/** `null` = lecture impossible (à dire) ; `[]` = rien en retard. */
export async function listerHorodatagesEnRetard(
  maintenant: Date = new Date(),
): Promise<HorodatageEnRetard[] | null> {
  try {
    const lignes = await prisma.documentSignatureHorodatage.findMany({
      where: {
        statut: "en_attente",
        creeAt: { lt: new Date(maintenant.getTime() - DELAI_ALERTE_HORODATAGE_MS) },
      },
      orderBy: { creeAt: "asc" },
      take: 50,
      select: {
        id: true,
        creeAt: true,
        essais: true,
        signature: {
          select: {
            documentGenere: {
              select: { numero: true, devisPortes: { select: { id: true }, take: 1 } },
            },
          },
        },
      },
    });
    return lignes.map((l) => ({
      id: l.id,
      depuis: l.creeAt,
      essais: l.essais,
      numero: l.signature.documentGenere.numero,
      devisId: l.signature.documentGenere.devisPortes[0]?.id ?? null,
    }));
  } catch (err) {
    if (tableAbsente(err)) return [];
    return null;
  }
}
