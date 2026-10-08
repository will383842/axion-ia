// Réseau d'apporteurs — PRESTATION HORS GRILLE, palier à choisir, activité à classer (contrat 2.3,
// annexe 1 A1.7 ; art. 5.4).
//
// Une commission « à qualifier » attend une décision de la Société. Trois cas, trois repères :
//   · « Activité à classer » : la facture ne portait pas d'activité ;
//   · « Palier à choisir » : une formation de la grille dont le palier n'est pas encore choisi ;
//   · « Prestation hors grille de commissions » (A1.7) : Williams a constaté que le produit n'est
//     PAS dans la grille (produit créé après la signature) — repère posé par son geste.
// Dans tous les cas, la situation est réglée dans les SOIXANTE jours de l'ENCAISSEMENT (A1.7 ;
// art. 5.4 : ni l'absence de palier ni un défaut de rattachement ne diffèrent un versement
// au-delà). Pour un produit hors grille : publier sa commission (choisir le palier), ou constater
// par écrit qu'il n'est pas commissionné, avec son motif, porté à la connaissance de l'apporteur.
// À défaut, la commission sera due au taux ou au forfait de la grille publiée à la date de la
// vente — une fois la prestation réalisée et payée (art. 4.2).
//
// Ce module ne décide rien à la place de Williams : il étiquette, calcule l'échéance, alerte une
// fois dix jours avant et une fois le jour du dépassement, et porte ses deux gestes.
// Aucun `server-only` : le passage quotidien (worker) l'appelle.

import { destinataireAlertesInternes } from "@/lib/destinataires-internes";
import { decryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/queue/queues";

import { annulerCommission } from "./ajustement";
import { dateFr } from "./autofacture-donnees";
import { dejaEnvoye } from "./commissions";
import { envoyer } from "./envois";
import { litigeDisponible } from "./litige";
import { ajouterJours, PALIERS_FORMATION } from "./regles";

export const DELAI_HORS_GRILLE_JOURS = 60;
export const ALERTE_AVANT_ECHEANCE_JOURS = 10;
const JOUR_MS = 86_400_000;

/** Repère posé par Williams sur une formation dont le produit n'est pas dans la grille. */
export const PALIER_HORS_GRILLE = "hors-grille";

export const LIBELLE_HORS_GRILLE = "Prestation hors grille de commissions";
export const LIBELLE_PALIER_A_CHOISIR = "Palier à choisir";
export const LIBELLE_ACTIVITE_A_CLASSER = "Activité à classer";

/** Le repère de la ligne « à qualifier ». */
export function libelleAQualifier(l: { activite: string | null; palier: string | null }): string {
  if (l.palier === PALIER_HORS_GRILLE) return LIBELLE_HORS_GRILLE;
  if (l.activite === "formation" && !PALIERS_FORMATION.some((p) => p.id === l.palier))
    return LIBELLE_PALIER_A_CHOISIR;
  return LIBELLE_ACTIVITE_A_CLASSER;
}

/** Échéance de la décision : soixante jours après l'ENCAISSEMENT (paiement de la facture). */
export function etatHorsGrille(
  encaisseLe: Date,
  maintenant: Date,
): { echeance: Date; joursRestants: number; depassee: boolean; bientot: boolean } {
  const echeance = ajouterJours(encaisseLe, DELAI_HORS_GRILLE_JOURS);
  const joursRestants = Math.ceil((echeance.getTime() - maintenant.getTime()) / JOUR_MS);
  return {
    echeance,
    joursRestants,
    depassee: joursRestants <= 0,
    bientot: joursRestants > 0 && joursRestants <= ALERTE_AVANT_ECHEANCE_JOURS,
  };
}

/** Date d'encaissement de chaque facture (paiement soldant), repli : création de la ligne. */
export async function encaissementsDes(
  lignes: ReadonlyArray<{ factureId: string; creeAt: Date }>,
): Promise<Map<string, Date>> {
  const factures = await prisma.factureFormation.findMany({
    where: { id: { in: [...new Set(lignes.map((l) => l.factureId))] } },
    select: { id: true, paidAt: true },
  });
  const paye = new Map(factures.map((f) => [f.id, f.paidAt] as const));
  return new Map(lignes.map((l) => [l.factureId, paye.get(l.factureId) ?? l.creeAt]));
}

/** Alerte interne, une fois à J-10, une fois à l'échéance dépassée. Rend le nombre d'alertes posées. */
export async function alerterHorsGrille(maintenant: Date = new Date()): Promise<number> {
  const lignes = await prisma.commissionApporteur.findMany({
    where: {
      statut: "a_qualifier",
      parrainage: false,
      // Une ligne suspendue (contestation écrite du client, art. 4.2 bis) attend l'issue.
      ...((await litigeDisponible()) ? { litigeDepuis: null } : {}),
    },
    select: {
      id: true,
      apporteurId: true,
      activite: true,
      palier: true,
      creeAt: true,
      factureId: true,
    },
    orderBy: { creeAt: "asc" },
  });
  if (lignes.length === 0) return 0;
  const encaisse = await encaissementsDes(lignes);
  let n = 0;
  for (const l of lignes) {
    const e = etatHorsGrille(encaisse.get(l.factureId) ?? l.creeAt, maintenant);
    if (!e.depassee && !e.bientot) continue;
    const jobId = `apporteur-hors-grille-${l.id}-${e.depassee ? "depassee" : "preavis"}`;
    if (await dejaEnvoye(jobId)) continue;
    const libelle = libelleAQualifier(l);
    const quand = dateFr(e.echeance);
    const message = e.depassee
      ? `${libelle} : le délai de soixante jours après l'encaissement est dépassé depuis le ${quand}. À défaut de décision, la commission est due au taux ou au forfait de la grille publiée à la date de la vente, une fois la prestation réalisée et payée (annexe 1, A1.7 ; art. 4.2). Réglez-la dans la console (Commissions apporteurs).`
      : `${libelle} : décision à prendre avant le ${quand} (soixante jours après l'encaissement, annexe 1, A1.7) — choisir le palier ou classer la ligne, ou, pour un produit hors grille, constater par écrit qu'il n'est pas commissionné, avec son motif.`;
    const r = await enqueueEmail(
      "qualiopi-alerte-interne",
      destinataireAlertesInternes(),
      "fr",
      {
        niveau: "important",
        code: "apporteur_commission_hors_grille",
        titre: e.depassee ? `${libelle} : délai dépassé` : `${libelle} : échéance le ${quand}`,
        message,
        cibleType: "ApporteurReseau",
        cibleId: l.apporteurId,
        createdAt: maintenant.toLocaleDateString("fr-FR"),
      },
      { jobId, entityType: "ApporteurReseau", entityId: l.apporteurId },
    );
    if (r.enqueued === true) n += 1;
  }
  return n;
}

async function tracer(
  action: string,
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

/** Geste de Williams : « Produit hors grille » (A1.7) sur une formation encore à qualifier. */
export async function marquerHorsGrille(
  id: string,
  acteurId: string | null = null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const r = await prisma.commissionApporteur.updateMany({
    where: { id, statut: "a_qualifier", activite: "formation", parrainage: false },
    data: { palier: PALIER_HORS_GRILLE },
  });
  if (r.count !== 1)
    return { ok: false, message: "Seule une formation encore à qualifier peut être hors grille." };
  await tracer("commission_apporteur.hors_grille", id, acteurId, {});
  return { ok: true };
}

/**
 * Geste de Williams : « Produit non commissionné » (A1.7). La commission est annulée (la ligne
 * reste, tracée) et la constatation est PORTÉE À LA CONNAISSANCE de l'apporteur, avec son motif.
 */
export async function constaterNonCommissionne(
  id: string,
  motif: string,
  acteurId: string | null = null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const m = motif.trim().slice(0, 500);
  if (m.length < 10)
    return { ok: false, message: "Indiquez le motif : il est communiqué à l'apporteur (A1.7)." };
  const l = await prisma.commissionApporteur.findUnique({
    where: { id },
    select: { apporteurId: true, palier: true, statut: true },
  });
  if (!l || l.statut !== "a_qualifier" || l.palier !== PALIER_HORS_GRILLE)
    return {
      ok: false,
      message: "Seul un produit marqué hors grille peut être constaté non commissionné.",
    };
  const r = await annulerCommission(id, `A1.7 : produit non commissionné — ${m}`, acteurId);
  if (!r.ok) return r;
  try {
    const a = await prisma.apporteurReseau.findUnique({
      where: { id: l.apporteurId },
      select: { prenom: true, email: true },
    });
    const destinataire = a ? (decryptPii(a.email) ?? "") : "";
    if (destinataire) {
      await envoyer({
        gabarit: "apporteur-non-commissionne",
        destinataire,
        payload: { contactName: decryptPii(a!.prenom) ?? "", motifNonCommissionne: m },
        entityType: "ApporteurReseau",
        entityId: l.apporteurId,
        jobId: `apporteur-non-commissionne-${id}`,
      });
    }
  } catch {
    // Prévenir ne doit jamais faire échouer le geste.
  }
  return { ok: true };
}
