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
        decision: "remboursement",
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
