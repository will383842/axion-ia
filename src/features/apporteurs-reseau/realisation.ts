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

import { jourParis } from "./autofacture-donnees";

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

/** Réalisation annulée à la main : l'automatisme ne la refait jamais. */
export const ANNULEE_A_LA_MAIN = "annulee-console";

/** Statuts dont la prestation peut être marquée réalisée : tout ce qui n'est ni versé ni repris. */
/** Les statuts où la réalisation se marque ou s'annule (lus aussi par la fiche de l'entreprise). */
export const MARQUABLES = ["a_qualifier", "due", "en_attente_vigilance"] as const;

export async function marquerPrestationRealisee(
  id: string,
  realiseeLe: Date,
  maintenant: Date = new Date(),
  acteurId: string | null = null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  // Des JOURS de Paris : la date du jour, saisie dans la console, est toujours admise.
  if (Number.isNaN(realiseeLe.getTime()) || jourParis(realiseeLe) > jourParis(maintenant)) {
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
    // Marqueur : l'automatisme ne la refera plus ; seul le bouton peut la reposer.
    data: { prestationRealiseeAt: null, prestationRealiseePar: ANNULEE_A_LA_MAIN },
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

/** Facture lue pour décider : sa session, ou l'inscription du participant du client présenté. */
interface FactureLue {
  id: string;
  devisId: string | null;
  session: { statut: string; dateFin: Date } | null;
  enrollment: { statut: string; session: { statut: string; dateFin: Date } } | null;
}

/**
 * Date de fin si la facture est RÉALISÉE de façon sûre, sinon `null` (dans le doute, on attend) :
 * en inter-entreprises, l'inscription du participant doit être « présente » et SA session
 * réalisée ; sinon la session de la facture réalisée. Toujours une fin passée.
 */
function finSure(f: FactureLue, maintenant: Date): Date | null {
  const s = f.enrollment
    ? f.enrollment.statut === "presente"
      ? f.enrollment.session
      : null
    : f.session;
  if (!s || s.statut !== "realisee") return null;
  return s.dateFin.getTime() <= maintenant.getTime() ? s.dateFin : null;
}

const SELECT_FACTURE = {
  id: true,
  devisId: true,
  session: { select: { statut: true, dateFin: true } },
  enrollment: { select: { statut: true, session: { select: { statut: true, dateFin: true } } } },
} as const;

/**
 * AUTOMATIQUE : la commission est marquée réalisée quand TOUTE la commande l'est — toutes les
 * factures du même devis (plusieurs sessions possibles), chacune réalisée de façon sûre — à la
 * dernière date de fin. Une réalisation ANNULÉE à la main (`prestationRealiseePar =
 * "annulee-console"`) n'est plus jamais refaite ici : seul le bouton peut la reposer.
 * Parcourt TOUTES les commissions en attente par lots triés (pas de famine). Idempotent.
 */
export async function marquerRealiseesDepuisSessions(
  maintenant: Date = new Date(),
): Promise<number> {
  if (!(await realisationDisponible())) return 0;
  let n = 0;
  let apres: string | undefined;
  for (;;) {
    const lignes = await prisma.commissionApporteur.findMany({
      where: {
        prestationRealiseeAt: null,
        prestationRealiseePar: null,
        statut: { in: [...MARQUABLES] },
        ...(apres ? { id: { gt: apres } } : {}),
      },
      select: { id: true, factureId: true },
      orderBy: { id: "asc" },
      take: 200,
    });
    if (lignes.length === 0) break;
    apres = lignes[lignes.length - 1]!.id;
    const cles: FactureLue[] = await prisma.factureFormation.findMany({
      where: { id: { in: [...new Set(lignes.map((l) => l.factureId))] } },
      select: SELECT_FACTURE,
    });
    const devis = [...new Set(cles.map((f) => f.devisId).filter((d): d is string => !!d))];
    const soeurs: FactureLue[] = devis.length
      ? await prisma.factureFormation.findMany({
          where: { devisId: { in: devis } },
          select: SELECT_FACTURE,
        })
      : [];
    const parId = new Map(cles.map((f) => [f.id, f] as const));
    for (const l of lignes) {
      const f = parId.get(l.factureId);
      if (!f) continue;
      const commande = f.devisId ? soeurs.filter((x) => x.devisId === f.devisId) : [f];
      const fins = (commande.length ? commande : [f]).map((x) => finSure(x, maintenant));
      if (fins.some((x) => x === null)) continue;
      const fin = new Date(Math.max(...fins.map((x) => x!.getTime())));
      const r = await prisma.commissionApporteur.updateMany({
        where: { id: l.id, prestationRealiseeAt: null, prestationRealiseePar: null },
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
    if (lignes.length < 200) break;
  }
  return n;
}
