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
    const ttcAvoirs = siens.reduce(
      (n, a) => n + Math.abs(a.montantTtcCents ?? a.montantHtCents + a.montantTvaCents),
      0,
    );
    return {
      id: f.id,
      numero: f.numero,
      restantHtCents: f.montantHtCents - htAvoirs,
      restantTtcCents: (f.montantTtcCents ?? f.montantHtCents + f.montantTvaCents) - ttcAvoirs,
    };
  });
}

/** La facture à rectifier : celle du dossier, sinon la saisie (parmi les candidates), sinon l'unique. */
export async function resoudreFactureGarantie(
  d: Pick<DossierGarantie, "clientId" | "auditMissionId" | "devisId" | "factureId">,
  saisie: string | null,
): Promise<{ ok: true; facture: FactureGarantie } | { ok: false; message: string }> {
  const candidates = await facturesCandidates(d);
  const choisie = d.factureId ?? saisie;
  let facture: FactureGarantie | undefined;
  if (choisie) {
    facture = candidates.find((f) => f.id === choisie);
    if (!facture) return { ok: false, message: "Facture invalide pour ce dossier." };
  } else if (candidates.length === 1) {
    facture = candidates[0];
  } else if (candidates.length === 0) {
    return {
      ok: false,
      message:
        "Aucune facture émise n'est rattachée à cette Journée IA (mission ou devis) : émettre la facture avant de décider un remboursement.",
    };
  } else {
    return {
      ok: false,
      message:
        "Plusieurs factures correspondent (acompte et solde ?) : choisir la facture à rectifier.",
    };
  }
  if (!facture || facture.restantHtCents <= 0 || facture.restantTtcCents <= 0)
    return { ok: false, message: "Cette facture est déjà entièrement couverte par des avoirs." };
  return { ok: true, facture };
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
