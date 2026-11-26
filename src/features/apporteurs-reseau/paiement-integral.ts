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

export async function paiementIntegralLe(factureIds: readonly string[]): Promise<Date | null> {
  try {
    const ids = [...new Set(factureIds)];
    if (ids.length === 0) return null;
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
    const dates = [...parCommande.values()].map((t) => Math.max(...t));
    return dates.length ? new Date(Math.min(...dates)) : null;
  } catch {
    return null;
  }
}
