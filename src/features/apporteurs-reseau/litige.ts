// Réseau d'apporteurs — commission SUSPENDUE pendant une contestation écrite du client
// (contrat 2.3, art. 4.2 bis ; décision de Will, 07/10/2026).
//
// Tant que le client conteste PAR ÉCRIT la prestation ou sa facture, la commission n'est ni
// facturée ni versée. À l'issue, Williams lève la suspension : la commission suit son cours
// (autofacture, virement), ou une reprise est enregistrée selon le prix finalement conservé.
// Aucun délai n'est promis, rien n'est effacé.
//
// ⚠️ Atteint par le WORKER (job horaire de facturation), qui peut tourner AVANT que la migration
// des colonnes ne soit passée (le worker atterrit ~50 min avant l'app) : la présence des
// colonnes est vérifiée, et sans elles le filtre ne s'applique pas (aucune commission ne peut
// alors être suspendue). Aucun `server-only`.

import { prisma } from "@/lib/prisma";

/** La colonne est-elle en base ? Relu au plus toutes les dix minutes. */
let disponible: { valeur: boolean; lu: number } | null = null;
const RELIRE_MS = 10 * 60 * 1000;

export async function litigeDisponible(): Promise<boolean> {
  if (disponible && Date.now() - disponible.lu < RELIRE_MS) return disponible.valeur;
  let valeur = false;
  try {
    await prisma.$queryRaw`SELECT litige_depuis FROM commissions_apporteur LIMIT 0`;
    valeur = true;
  } catch {
    valeur = false;
  }
  disponible = { valeur, lu: Date.now() };
  return valeur;
}

/** Pour les tests : oublie la lecture de la colonne. */
export function oublierLitigeDisponible(): void {
  disponible = null;
}

/** Le filtre « hors litige » à ajouter aux requêtes de facturation et de versement. */
export async function horsLitige(): Promise<{ litigeDepuis: null } | Record<string, never>> {
  return (await litigeDisponible()) ? { litigeDepuis: null } : {};
}

/** Statuts qu'une contestation peut suspendre : tout ce qui n'est pas encore versé ni repris. */
const SUSPENDABLES = ["a_qualifier", "due", "en_attente_vigilance"] as const;

export async function suspendreCommission(
  id: string,
  motif: string,
  maintenant: Date = new Date(),
): Promise<{ ok: true } | { ok: false; message: string }> {
  const m = motif.trim().slice(0, 300);
  if (!m) return { ok: false, message: "Indiquez la contestation du client (date, objet)." };
  const r = await prisma.commissionApporteur.updateMany({
    where: { id, litigeDepuis: null, statut: { in: [...SUSPENDABLES] } },
    data: { litigeDepuis: maintenant, litigeMotif: m },
  });
  return r.count === 1
    ? { ok: true }
    : {
        ok: false,
        message: "Cette commission ne peut pas être suspendue (déjà suspendue, versée ou reprise).",
      };
}

export async function leverSuspension(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const r = await prisma.commissionApporteur.updateMany({
    where: { id, litigeDepuis: { not: null } },
    data: { litigeDepuis: null, litigeMotif: null },
  });
  return r.count === 1
    ? { ok: true }
    : { ok: false, message: "Cette commission n'est pas suspendue." };
}
