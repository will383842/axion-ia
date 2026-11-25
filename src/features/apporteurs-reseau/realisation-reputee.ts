// Réseau d'apporteurs — PRESTATION RÉPUTÉE RÉALISÉE (lot L3b, décision D3 du dirigeant, 25/11/2026).
//
// Une prestation est réputée réalisée `REALISATION_REPUTEE_JOURS` jours calendaires après
// l'encaissement INTÉGRAL du client (facture « payée », `paidAt`), sauf OPPOSITION MOTIVÉE enregistrée
// par Axion AVANT l'échéance. Sans cela, Axion pourrait retenir indéfiniment une commission dont
// le client a tout payé.
//
// Garanties :
//   · n'agit que sur les commissions en attente de réalisation (ni réalisée, ni annulée à la main,
//     ni en litige, ni versée/reprise) ; ne touche JAMAIS un montant ni un statut ;
//   · idempotent et rejouable : la mise à jour est gardée par « pas encore marquée » ;
//   · la date posée est celle de l'échéance (encaissement + délai), jamais celle du passage ;
//   · le marquage et son journal sont dans UNE transaction : pas de marquage sans trace ;
//   · la reprise (impayé, remboursement, art. 4.5) reste possible : elle lit statut et montant ;
//   · une réalisation annulée à la main (`ANNULEE_A_LA_MAIN`) n'est jamais refaite d'office.
//
// OPPOSITION : enregistrée au journal seul (`commission_apporteur.realisation_opposition`), sans
// colonne neuve — le worker peut tourner avant toute migration (fenêtre app/worker) et le lot reste
// sans schéma. Pas de levée automatique : un marquage à la main reste possible dans la console.
// Aucun `server-only`.

import { prisma } from "@/lib/prisma";

import { MARQUABLES, realisationDisponible } from "./realisation";

/** Délai décidé en D3 : jours calendaires après l'encaissement intégral. */
export const REALISATION_REPUTEE_JOURS = 90;
/** Valeur de `prestationRealiseePar` posée par ce passage. */
export const REALISEE_D_OFFICE = "office";

const JOUR_MS = 24 * 60 * 60 * 1000;
const ACTION_OPPOSITION = "commission_apporteur.realisation_opposition";
const MOTIF_MAX = 500;

/** Échéance : encaissement intégral + délai. */
export function echeanceReputee(paidAt: Date): Date {
  return new Date(paidAt.getTime() + REALISATION_REPUTEE_JOURS * JOUR_MS);
}

/** Opposition motivée, avant l'échéance. Idempotente. Journal en échec → refusée. */
export async function sOpposerAuMarquageDOffice(
  id: string,
  motif: string,
  maintenant: Date = new Date(),
  acteurId: string | null = null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const m = motif.trim();
  if (!m) return { ok: false, message: "Le motif de l'opposition est obligatoire." };
  if (m.length > MOTIF_MAX) {
    return { ok: false, message: `Motif trop long (${MOTIF_MAX} caractères au plus).` };
  }
  const c = await prisma.commissionApporteur.findUnique({
    where: { id },
    select: {
      factureId: true,
      statut: true,
      prestationRealiseeAt: true,
      prestationRealiseePar: true,
    },
  });
  if (!c || c.prestationRealiseeAt || c.prestationRealiseePar) {
    return { ok: false, message: "Cette commission n'est pas en attente de réalisation." };
  }
  if (!(MARQUABLES as readonly string[]).includes(c.statut)) {
    return { ok: false, message: "Cette commission est versée, reprise ou annulée." };
  }
  const f = await prisma.factureFormation.findUnique({
    where: { id: c.factureId },
    select: { statut: true, paidAt: true },
  });
  if (!f || f.statut !== "payee" || !f.paidAt) {
    return {
      ok: false,
      message: "Le client n'a pas encore tout payé : rien à contester d'office.",
    };
  }
  if (maintenant.getTime() >= echeanceReputee(f.paidAt).getTime()) {
    return {
      ok: false,
      message: "L'échéance est atteinte : l'opposition doit précéder l'échéance.",
    };
  }
  const deja = await prisma.activityLog.findMany({
    where: {
      action: ACTION_OPPOSITION,
      targetType: "commission_apporteur",
      targetId: { in: [id] },
    },
    select: { targetId: true },
  });
  if (deja.length > 0) return { ok: true };
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: acteurId,
        action: ACTION_OPPOSITION,
        targetType: "commission_apporteur",
        targetId: id,
        changes: { motif: m, echeance: echeanceReputee(f.paidAt).toISOString() },
      },
    });
  } catch {
    return { ok: false, message: "Opposition non enregistrée (journal indisponible) : réessayez." };
  }
  return { ok: true };
}

/**
 * Passage quotidien. Retourne le nombre de commissions marquées. Une erreur de journal remonte
 * (le marquage est alors annulé) : l'étape est rejouée au passage suivant.
 */
export async function marquerRealiseesDOffice(maintenant: Date = new Date()): Promise<number> {
  if (!(await realisationDisponible())) return 0;
  const seuil = new Date(maintenant.getTime() - REALISATION_REPUTEE_JOURS * JOUR_MS);
  let n = 0;
  let apres: string | undefined;
  for (;;) {
    const lignes = await prisma.commissionApporteur.findMany({
      where: {
        prestationRealiseeAt: null,
        // `null` exclut aussi « annulee-console » : une annulation à la main n'est pas reprise.
        prestationRealiseePar: null,
        litigeDepuis: null,
        statut: { in: [...MARQUABLES] },
        ...(apres ? { id: { gt: apres } } : {}),
      },
      select: { id: true, factureId: true },
      orderBy: { id: "asc" },
      take: 200,
    });
    if (lignes.length === 0) break;
    apres = lignes[lignes.length - 1]!.id;
    const factures = await prisma.factureFormation.findMany({
      where: {
        id: { in: [...new Set(lignes.map((l) => l.factureId))] },
        statut: "payee",
        paidAt: { not: null, lte: seuil },
      },
      select: { id: true, paidAt: true },
    });
    const paye = new Map(factures.map((f) => [f.id, f.paidAt as Date] as const));
    const eligibles = lignes.filter((l) => paye.has(l.factureId));
    const opposees = eligibles.length
      ? new Set(
          (
            await prisma.activityLog.findMany({
              where: {
                action: ACTION_OPPOSITION,
                targetType: "commission_apporteur",
                targetId: { in: eligibles.map((l) => l.id) },
              },
              select: { targetId: true },
            })
          ).map((o) => o.targetId),
        )
      : new Set<string | null>();
    for (const l of eligibles) {
      if (opposees.has(l.id)) continue;
      const le = echeanceReputee(paye.get(l.factureId)!);
      const marquee = await prisma.$transaction(async (tx) => {
        const r = await tx.commissionApporteur.updateMany({
          where: {
            id: l.id,
            prestationRealiseeAt: null,
            prestationRealiseePar: null,
            litigeDepuis: null,
            statut: { in: [...MARQUABLES] },
          },
          data: { prestationRealiseeAt: le, prestationRealiseePar: REALISEE_D_OFFICE },
        });
        if (r.count !== 1) return false;
        await tx.activityLog.create({
          data: {
            adminUserId: null,
            action: "commission_apporteur.prestation_realisee",
            targetType: "commission_apporteur",
            targetId: l.id,
            changes: {
              realiseeLe: le.toISOString(),
              source: REALISEE_D_OFFICE,
              delaiJours: REALISATION_REPUTEE_JOURS,
            },
          },
        });
        return true;
      });
      if (marquee) n += 1;
    }
    if (lignes.length < 200) break;
  }
  return n;
}
