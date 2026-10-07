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
  // Seule la PRÉSENCE est mémorisée : tant que la colonne manque, on reteste à chaque appel,
  // pour qu'une commission suspendue juste après la migration ne soit jamais facturée.
  if (disponible && Date.now() - disponible.lu < RELIRE_MS) return true;
  try {
    await prisma.$queryRaw`SELECT litige_depuis FROM commissions_apporteur LIMIT 0`;
    disponible = { valeur: true, lu: Date.now() };
    return true;
  } catch {
    disponible = null;
    return false;
  }
}

/** Pour les tests : oublie la lecture de la colonne. */
export function oublierLitigeDisponible(): void {
  disponible = null;
}

/** Le filtre « hors litige » à ajouter aux requêtes de facturation et de versement. */
export async function horsLitige(): Promise<{ litigeDepuis: null } | Record<string, never>> {
  return (await litigeDisponible()) ? { litigeDepuis: null } : {};
}

/** E-mail à l'apporteur (suspension, puis issue) : une fois par événement, jamais bloquant. */
async function prevenir(
  apporteurId: string,
  commissionId: string,
  etat: "suspendue" | "levee",
): Promise<void> {
  try {
    const [{ decryptPii }, { envoyer }] = await Promise.all([
      import("@/lib/pii-crypto"),
      import("./envois"),
    ]);
    const a = await prisma.apporteurReseau.findUnique({
      where: { id: apporteurId },
      select: { prenom: true, email: true },
    });
    const destinataire = a ? (decryptPii(a.email) ?? "") : "";
    if (!destinataire) return;
    await envoyer({
      gabarit: "apporteur-commission-suspension",
      destinataire,
      payload: { contactName: decryptPii(a!.prenom) ?? "", etat },
      entityType: "ApporteurReseau",
      entityId: apporteurId,
      jobId: `apporteur-commission-suspension-${commissionId}-${etat}-${Date.now()}`,
    });
  } catch {
    // Prévenir ne doit jamais faire échouer le geste.
  }
}

/** Statuts qu'une contestation peut suspendre : tout ce qui n'est pas encore versé ni repris. */
const SUSPENDABLES = ["a_qualifier", "due", "en_attente_vigilance"] as const;

/** Journal d'audit (qui, quand, quoi) ; jamais bloquant. */
async function tracer(
  action: "commission_apporteur.suspendue" | "commission_apporteur.suspension_levee",
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
    // La trace ne doit jamais faire échouer le geste.
  }
}

export async function suspendreCommission(
  id: string,
  motif: string,
  maintenant: Date = new Date(),
  acteurId: string | null = null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const m = motif.trim().slice(0, 300);
  if (!m) return { ok: false, message: "Indiquez la contestation du client (date, objet)." };
  const ligne = await prisma.commissionApporteur.findUnique({
    where: { id },
    select: { factureId: true, parrainage: true, apporteurId: true },
  });
  const r = await prisma.commissionApporteur.updateMany({
    where: { id, litigeDepuis: null, statut: { in: [...SUSPENDABLES] } },
    data: { litigeDepuis: maintenant, litigeMotif: m },
  });
  if (r.count === 1 && ligne && !ligne.parrainage) {
    // La part du parrain naît de la MÊME facture : elle est suspendue avec elle (art. 4.6).
    await prisma.commissionApporteur.updateMany({
      where: {
        factureId: ligne.factureId,
        parrainage: true,
        litigeDepuis: null,
        statut: { in: [...SUSPENDABLES] },
      },
      data: { litigeDepuis: maintenant, litigeMotif: m },
    });
  }
  if (r.count !== 1) {
    return {
      ok: false,
      message: "Cette commission ne peut pas être suspendue (déjà suspendue, versée ou reprise).",
    };
  }
  await tracer("commission_apporteur.suspendue", id, acteurId, {
    depuis: maintenant.toISOString(),
    motif: m,
  });
  // (a) L'apporteur est PRÉVENU de la suspension (art. 4.2 bis) ; jamais bloquant.
  if (ligne) await prevenir(ligne.apporteurId, id, "suspendue");
  return { ok: true };
}

export async function leverSuspension(
  id: string,
  acteurId: string | null = null,
  maintenant: Date = new Date(),
): Promise<{ ok: true } | { ok: false; message: string }> {
  // La suspension levée est d'abord TRACÉE (date, motif d'origine), puis la ligne est remise
  // dans le circuit : rien ne disparaît sans trace.
  const avant = await prisma.commissionApporteur.findUnique({
    where: { id },
    select: {
      litigeDepuis: true,
      litigeMotif: true,
      factureId: true,
      parrainage: true,
      apporteurId: true,
    },
  });
  if (!avant?.litigeDepuis) return { ok: false, message: "Cette commission n'est pas suspendue." };
  const depuis = new Date(avant.litigeDepuis.getTime());
  const motif = avant.litigeMotif;
  const r = await prisma.commissionApporteur.updateMany({
    where: { id, litigeDepuis: depuis },
    data: { litigeDepuis: null, litigeMotif: null },
  });
  if (r.count !== 1) return { ok: false, message: "Cette commission n'est pas suspendue." };
  if (!avant.parrainage) {
    // La part du parrain suspendue avec elle reprend aussi son cours.
    await prisma.commissionApporteur.updateMany({
      where: { factureId: avant.factureId, parrainage: true, litigeDepuis: depuis },
      data: { litigeDepuis: null, litigeMotif: null },
    });
  }
  await prevenir(avant.apporteurId, id, "levee");
  await tracer("commission_apporteur.suspension_levee", id, acteurId, {
    suspendueDepuis: depuis.toISOString(),
    leveeLe: maintenant.toISOString(),
    motif,
  });
  return { ok: true };
}
