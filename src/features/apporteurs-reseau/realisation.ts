// Réseau d'apporteurs — PRESTATION RÉALISÉE (contrat 2.3, art. 4.2 ; règle ferme de Will, 07/10/2026).
//
// AUCUNE commission n'est facturée (autofacture) ni versée (« Virement fait ») avant que la
// prestation soit marquée réalisée. Le contrôle vit CÔTÉ SERVEUR, dans `facturation.ts`, sur tous
// les chemins : passage horaire, autofacture (y compris après une régularisation SIREN ou de
// vigilance, et en mode restreint), « Virement fait » avec ou sans numéro d'autofacture.
//
// Deux façons de marquer une prestation réalisée :
//   · automatiquement, quand une source fiable existe : la SESSION de formation de la facture est
//     passée au statut « réalisée » dans le module Qualiopi (date = fin de la session) ;
//   · à la main, dans la console Commissions : « Marquer la prestation réalisée » (avec la date),
//     et l'action inverse « Annuler » tant que la commission n'est pas facturée. Tout est tracé.
//
// ⚠️ Atteint par le WORKER, qui peut tourner AVANT la migration de la colonne (~50 min) : sans la
// colonne, on ne peut pas savoir si la prestation est réalisée, donc RIEN n'est facturé ni versé.
// Aucun `server-only`.

import { prisma } from "@/lib/prisma";

let disponible: number | null = null;
const RELIRE_MS = 10 * 60 * 1000;

/** La colonne est-elle en base ? Seule la présence est mémorisée ; absente, on reteste. */
export async function realisationDisponible(): Promise<boolean> {
  if (disponible !== null && Date.now() - disponible < RELIRE_MS) return true;
  try {
    await prisma.$queryRaw`SELECT prestation_realisee_at FROM commissions_apporteur LIMIT 0`;
    disponible = Date.now();
    return true;
  } catch {
    disponible = null;
    return false;
  }
}

/** Pour les tests. */
export function oublierRealisationDisponible(): void {
  disponible = null;
}

/** Le message unique du refus, sur tous les chemins. */
export const MESSAGE_EN_ATTENTE_DE_REALISATION =
  "En attente de réalisation : la prestation n'est pas encore marquée réalisée. Aucune commission n'est facturée ni versée avant (contrat, art. 4.2).";

async function tracer(
  action: "commission_apporteur.prestation_realisee" | "commission_apporteur.realisation_annulee",
  id: string,
  acteurId: string | null,
  changes: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: acteurId,
        action,
        targetType: "commission_apporteur",
        targetId: id,
        changes: changes as object,
      },
    });
  } catch {
    // La trace ne fait jamais échouer le geste.
  }
}

/** Statuts dont la prestation peut être marquée réalisée : tout ce qui n'est ni versé ni repris. */
const MARQUABLES = ["a_qualifier", "due", "en_attente_vigilance"] as const;

export async function marquerPrestationRealisee(
  id: string,
  realiseeLe: Date,
  maintenant: Date = new Date(),
  acteurId: string | null = null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (Number.isNaN(realiseeLe.getTime()) || realiseeLe.getTime() > maintenant.getTime() + 60_000) {
    return { ok: false, message: "Date de réalisation invalide (elle ne peut pas être future)." };
  }
  const r = await prisma.commissionApporteur.updateMany({
    where: { id, prestationRealiseeAt: null, statut: { in: [...MARQUABLES] } },
    data: { prestationRealiseeAt: realiseeLe, prestationRealiseePar: "console" },
  });
  if (r.count !== 1) {
    return {
      ok: false,
      message:
        "Cette prestation est déjà marquée réalisée, ou la commission est versée ou reprise.",
    };
  }
  await tracer("commission_apporteur.prestation_realisee", id, acteurId, {
    realiseeLe: realiseeLe.toISOString(),
    source: "console",
  });
  return { ok: true };
}

/** « Annuler » : seulement tant que la commission n'est pas facturée (sinon, c'est une reprise). */
export async function annulerRealisation(
  id: string,
  acteurId: string | null = null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const avant = await prisma.commissionApporteur.findUnique({
    where: { id },
    select: { prestationRealiseeAt: true, prestationRealiseePar: true },
  });
  if (!avant?.prestationRealiseeAt) {
    return { ok: false, message: "Cette prestation n'est pas marquée réalisée." };
  }
  const le = new Date(avant.prestationRealiseeAt.getTime());
  const par = avant.prestationRealiseePar;
  const r = await prisma.commissionApporteur.updateMany({
    where: {
      id,
      prestationRealiseeAt: le,
      autofactureNumero: null,
      statut: { in: [...MARQUABLES] },
    },
    data: { prestationRealiseeAt: null, prestationRealiseePar: null },
  });
  if (r.count !== 1) {
    return {
      ok: false,
      message:
        "Cette commission est déjà facturée : on n'annule plus la réalisation, on enregistre une reprise.",
    };
  }
  await tracer("commission_apporteur.realisation_annulee", id, acteurId, {
    realiseeLe: le.toISOString(),
    source: par,
  });
  return { ok: true };
}

/**
 * AUTOMATIQUE : une commission dont la facture est liée à une session de formation passée au
 * statut « réalisée » est marquée réalisée à la date de fin de la session. Idempotent.
 */
export async function marquerRealiseesDepuisSessions(): Promise<number> {
  if (!(await realisationDisponible())) return 0;
  const lignes = await prisma.commissionApporteur.findMany({
    where: { prestationRealiseeAt: null, statut: { in: [...MARQUABLES] } },
    select: { id: true, factureId: true },
    take: 200,
  });
  if (lignes.length === 0) return 0;
  const factures = await prisma.factureFormation.findMany({
    where: { id: { in: [...new Set(lignes.map((l) => l.factureId))] } },
    select: { id: true, session: { select: { statut: true, dateFin: true } } },
  });
  const finDe = new Map(
    factures
      .filter((f) => f.session?.statut === "realisee")
      .map((f) => [f.id, f.session!.dateFin] as const),
  );
  let n = 0;
  for (const l of lignes) {
    const fin = finDe.get(l.factureId);
    if (!fin) continue;
    const r = await prisma.commissionApporteur.updateMany({
      where: { id: l.id, prestationRealiseeAt: null },
      data: { prestationRealiseeAt: fin, prestationRealiseePar: "session-realisee" },
    });
    if (r.count === 1) {
      n += 1;
      await tracer("commission_apporteur.prestation_realisee", l.id, null, {
        realiseeLe: fin.toISOString(),
        source: "session-realisee",
      });
    }
  }
  return n;
}
