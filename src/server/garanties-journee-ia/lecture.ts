/**
 * Garantie Journée IA — lectures de la console. Tolère l'absence de la table (P2021) : tant que la
 * migration n'est pas jouée, l'écran se dégrade en liste vide avec un avertissement, il ne plante pas.
 */
import { prisma } from "@/lib/prisma";
import { jourIso, type DossierPourListe } from "@/lib/garantie-journee-ia/presentation";
import type { Decision } from "@/server/garanties-journee-ia/regles";

export interface DossierGarantie extends DossierPourListe {
  clientId: string;
  sirenSnapshot: string | null;
  prixHtCents: number;
  seuilHtCents: number;
  totalGainsCents: number | null;
  montantRembourseCents: number | null;
  montantAvoirHtCents: number | null;
  avoirEmisLe: string | null;
  motifDecision: string | null;
  notes: string | null;
  archiveLe: string | null;
  devisId: string | null;
  auditMissionId: string | null;
  factureId: string | null;
  avoirId: string | null;
}

export function estTableAbsente(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2021";
}

type Ligne = Awaited<ReturnType<typeof chargerBrut>>[number];

function chargerBrut(archives: boolean) {
  return prisma.garantieJourneeIa.findMany({
    where: archives ? {} : { archiveLe: null },
    orderBy: [{ dateJournee: "asc" }],
    include: { client: { select: { raisonSociale: true } } },
    take: 500,
  });
}

export function versDossier(r: Ligne): DossierGarantie {
  return {
    id: r.id,
    clientId: r.clientId,
    clientNom: r.client.raisonSociale,
    sirenSnapshot: r.sirenSnapshot,
    prixHtCents: r.prixHtCents,
    seuilHtCents: r.seuilHtCents,
    totalGainsCents: r.totalGainsCents,
    montantRembourseCents: r.montantRembourseCents,
    montantAvoirHtCents: r.montantAvoirHtCents,
    dateJournee: jourIso(r.dateJournee) as string,
    rapportRemisLe: jourIso(r.rapportRemisLe),
    demandeRecueLe: jourIso(r.demandeRecueLe),
    decisionLe: jourIso(r.decisionLe),
    avoirEmisLe: jourIso(r.avoirEmisLe),
    virementLe: jourIso(r.virementLe),
    decision: (r.decision as Decision | null) ?? null,
    motifDecision: r.motifDecision,
    notes: r.notes,
    archiveLe: r.archiveLe ? r.archiveLe.toISOString() : null,
    devisId: r.devisId,
    auditMissionId: r.auditMissionId,
    factureId: r.factureId,
    avoirId: r.avoirId,
  };
}

export async function listerGaranties(
  archives = false,
): Promise<{ dossiers: DossierGarantie[]; tableAbsente: boolean }> {
  try {
    return { dossiers: (await chargerBrut(archives)).map(versDossier), tableAbsente: false };
  } catch (e) {
    if (estTableAbsente(e)) return { dossiers: [], tableAbsente: true };
    throw e;
  }
}

export async function lireGarantie(id: string): Promise<DossierGarantie | null> {
  try {
    const r = await prisma.garantieJourneeIa.findUnique({
      where: { id },
      include: { client: { select: { raisonSociale: true } } },
    });
    return r ? versDossier(r) : null;
  } catch (e) {
    if (estTableAbsente(e)) return null;
    throw e;
  }
}

/** Autres dossiers du même SIREN déjà remboursés (« une seule fois », 47.10 e) : simple avertissement. */
export async function dossiersDejaRembourses(
  siren: string | null,
  sauf?: string,
): Promise<{ id: string; dateJournee: string }[]> {
  if (!siren) return [];
  try {
    const l = await prisma.garantieJourneeIa.findMany({
      where: {
        sirenSnapshot: siren,
        OR: [{ decision: "remboursement" }, { virementLe: { not: null } }],
        ...(sauf ? { id: { not: sauf } } : {}),
      },
      select: { id: true, dateJournee: true },
    });
    return l.map((x) => ({ id: x.id, dateJournee: jourIso(x.dateJournee) as string }));
  } catch (e) {
    if (estTableAbsente(e)) return [];
    throw e;
  }
}

/** Facture émise rectifiable par le remboursement d'une garantie (montants en centimes). */
export interface FactureGarantie {
  id: string;
  numero: string;
  restantHtCents: number;
  restantTtcCents: number;
  /** Encaissé (paiements réussis) moins les avoirs déjà émis, plafonné au reste TTC : le rendable. */
  rendableTtcCents: number;
  destinataire: string;
}

/**
 * Factures du client rattachées à la Journée IA (même mission d'audit ou même devis), émises (ni
 * brouillon ni annulée), hors avoirs, avec le reste rectifiable HT/TTC (avoirs non annulés déduits).
 */
export async function facturesCandidates(
  d: Pick<DossierGarantie, "clientId" | "auditMissionId" | "devisId">,
): Promise<FactureGarantie[]> {
  const liens = [
    ...(d.auditMissionId ? [{ auditMissionId: d.auditMissionId }] : []),
    ...(d.devisId ? [{ devisId: d.devisId }] : []),
  ];
  if (liens.length === 0) return [];
  const factures = await prisma.factureFormation.findMany({
    where: {
      clientId: d.clientId,
      avoirDeId: null,
      statut: { notIn: ["brouillon", "annulee"] },
      OR: liens,
    },
    select: {
      id: true,
      numero: true,
      montantHtCents: true,
      montantTvaCents: true,
      montantTtcCents: true,
      destinataire: true,
      payments: { where: { status: "succeeded" }, select: { amountCents: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  if (factures.length === 0) return [];
  const avoirs = await prisma.factureFormation.findMany({
    where: { avoirDeId: { in: factures.map((f) => f.id) }, statut: { not: "annulee" } },
    select: { avoirDeId: true, montantHtCents: true, montantTvaCents: true, montantTtcCents: true },
  });
  return factures.map((f) => {
    const siens = avoirs.filter((a) => a.avoirDeId === f.id);
    const htAvoirs = siens.reduce((n, a) => n + Math.abs(a.montantHtCents), 0);
    // HT + TVA, comme `genererAvoirFacture` : un seul calcul du reste, pas deux qui divergent.
    const ttcAvoirs = Math.abs(siens.reduce((n, a) => n + a.montantHtCents + a.montantTvaCents, 0));
    const restantTtcCents = (f.montantTtcCents ?? f.montantHtCents + f.montantTvaCents) - ttcAvoirs;
    const encaisse = f.payments.reduce((n, p) => n + p.amountCents, 0);
    return {
      id: f.id,
      numero: f.numero,
      restantHtCents: f.montantHtCents - htAvoirs,
      restantTtcCents,
      rendableTtcCents: Math.max(0, Math.min(restantTtcCents, encaisse - ttcAvoirs)),
      destinataire: f.destinataire,
    };
  });
}

/**
 * Les factures à rectifier pour un remboursement : toutes celles du devis/de la mission (acompte +
 * solde), dans l'ordre d'émission, avec ce qu'on peut encore rendre sur chacune. Le montant décidé
 * est réparti ensuite par `repartirRemboursement`. Refus : aucune facture, facture adressée à un
 * financeur (OPCO, France Travail : le remboursement passe par lui, à traiter à la main), facture
 * choisie hors du dossier, ou plus rien à rendre.
 */
export async function resoudreFacturesGarantie(
  d: Pick<DossierGarantie, "clientId" | "auditMissionId" | "devisId" | "factureId">,
): Promise<{ ok: true; factures: FactureGarantie[] } | { ok: false; message: string }> {
  const candidates = await facturesCandidates(d);
  if (candidates.length === 0) {
    return {
      ok: false,
      message:
        "Aucune facture émise n'est rattachée à cette Journée IA (mission ou devis) : émettre la facture avant de décider un remboursement.",
    };
  }
  if (candidates.some((f) => f.destinataire === "opco" || f.destinataire === "france_travail")) {
    return {
      ok: false,
      message:
        "Une facture de cette Journée IA est adressée à un financeur (OPCO ou France Travail) : à traiter à la main par le dirigeant, aucun avoir n'est émis ici.",
    };
  }
  if (!candidates.some((f) => f.rendableTtcCents > 0))
    return {
      ok: false,
      message:
        "Plus rien à rembourser : les factures sont couvertes par des avoirs ou non encaissées.",
    };
  return { ok: true, factures: candidates };
}

/** Numéro de l'avoir et de la facture liés au dossier (affichage de la fiche). */
export async function numerosPiecesGarantie(
  d: Pick<DossierGarantie, "avoirId" | "factureId">,
): Promise<{ avoirNumero: string | null; factureNumero: string | null }> {
  const ids = [d.avoirId, d.factureId].filter((x): x is string => !!x);
  if (ids.length === 0) return { avoirNumero: null, factureNumero: null };
  const l = await prisma.factureFormation.findMany({
    where: { id: { in: ids } },
    select: { id: true, numero: true },
  });
  const n = (id: string | null) => l.find((x) => x.id === id)?.numero ?? null;
  return { avoirNumero: n(d.avoirId), factureNumero: n(d.factureId) };
}
