import { prisma } from "@/lib/prisma";

/**
 * Vrai si la facture, ou une facture sœur du même devis (acompte / solde), porte une commission
 * d'apporteur non annulée. Même périmètre que la reprise (avoir-client.ts) et que le garde-fou de
 * garanties-journee-ia.ts. Lecture seule.
 */
export async function factureCommissionneeParApporteur(factureId: string): Promise<boolean> {
  const facture = await prisma.factureFormation.findUnique({
    where: { id: factureId },
    select: { id: true, devisId: true },
  });
  if (!facture) return false;
  const soeurs = facture.devisId
    ? await prisma.factureFormation.findMany({
        where: { devisId: facture.devisId, avoirDeId: null },
        select: { id: true },
      })
    : [];
  const n = await prisma.commissionApporteur.count({
    where: {
      factureId: { in: [facture.id, ...soeurs.map((f) => f.id)] },
      statut: { not: "annulee" },
    },
  });
  return n > 0;
}

export const MESSAGE_AVOIR_COMMISSION =
  "Cette facture porte une commission d'apporteur : un avoir la reprend au prorata. S'il s'agit d'un bon d'achat offert, ne l'émettez pas comme avoir. Cochez la confirmation pour un vrai remboursement.";
