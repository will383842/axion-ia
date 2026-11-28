// Réseau d'apporteurs — la date du PAIEMENT INTÉGRAL du client (règle du 25/11).
//
// La commission est due dès que le client a payé 100 % de la commande ; le virement part au plus
// tard 30 jours après CE paiement (pas après l'émission de l'autofacture, qui peut attendre une
// donnée de l'apporteur). Le paiement intégral d'une commande est le paiement le plus TARDIF de ses
// factures (acompte + solde). Quand plusieurs commandes sont regroupées sur une pièce, on retient la
// plus ANCIENNE : c'est l'échéance la plus stricte.
//
// ⚠️ Atteint par le WORKER (tsx hors Next) : aucun `server-only`. Jamais bloquant : sans date, le
// délai part de l'émission (ancien calcul).

import { prisma } from "@/lib/prisma";

/**
 * Le paiement intégral de CHAQUE facture demandée : par facture, le paiement le plus tardif de sa
 * commande (un devis ; sinon la facture seule). Sert à dater la prestation sur l'autofacture
 * (contrat 2.8, art. 4.7 et annexe 2, 2.1 bis : la date de l'encaissement intégral). `null` : date
 * inconnue (jamais bloquant). Une requête échouée rend une carte vide.
 */
export async function paiementsIntegrauxParFacture(
  factureIds: readonly string[],
): Promise<Map<string, Date | null>> {
  try {
    return await lirePaiementsIntegrauxParFacture(factureIds);
  } catch {
    return new Map();
  }
}

/**
 * Même lecture, mais une requête échouée LÈVE : pour les appelants qui décident d'un fait à partir
 * de la carte (constat des challenges) et ne doivent jamais confondre « lecture échouée » avec
 * « pas de paiement ».
 */
export async function lirePaiementsIntegrauxParFacture(
  factureIds: readonly string[],
): Promise<Map<string, Date | null>> {
  const out = new Map<string, Date | null>();
  {
    const ids = [...new Set(factureIds)];
    if (ids.length === 0) return out;
    const cles = await prisma.factureFormation.findMany({
      where: { id: { in: ids } },
      select: { id: true, devisId: true, paidAt: true },
    });
    const devisIds = [...new Set(cles.map((f) => f.devisId).filter((d): d is string => !!d))];
    const membres = devisIds.length
      ? await prisma.factureFormation.findMany({
          where: {
            devisId: { in: devisIds },
            avoirDeId: null,
            statut: { notIn: ["brouillon", "annulee"] },
          },
          select: { id: true, devisId: true, paidAt: true },
        })
      : [];
    // Une commande = un devis (sinon la facture seule) ; son paiement intégral = le plus tardif.
    const parCommande = new Map<string, number[]>();
    const ajouter = (cle: string, d: Date | null | undefined) => {
      if (d) parCommande.set(cle, [...(parCommande.get(cle) ?? []), d.getTime()]);
    };
    for (const f of cles) if (!f.devisId) ajouter(`facture:${f.id}`, f.paidAt);
    for (const f of membres) ajouter(`devis:${f.devisId}`, f.paidAt);
    for (const f of cles) {
      const t = parCommande.get(f.devisId ? `devis:${f.devisId}` : `facture:${f.id}`);
      out.set(f.id, t ? new Date(Math.max(...t)) : null);
    }
    return out;
  }
}

/**
 * Le paiement intégral le plus ANCIEN parmi ces factures (échéance la plus stricte quand plusieurs
 * commandes sont regroupées sur une pièce) ; `null` sans date connue.
 */
export async function paiementIntegralLe(factureIds: readonly string[]): Promise<Date | null> {
  const dates = [...(await paiementsIntegrauxParFacture(factureIds)).values()].filter(
    (d): d is Date => d !== null,
  );
  return dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
}
