/**
 * Pièces à renouveler — lecture pour la console (lot L13). Une requête pour
 * les fiches, une pour leurs pièces suivies ; l'état vient du module pur.
 *
 * Indépendants seulement (ADR 0066 (a)) : actifs, sans fin de collaboration.
 */

import { prisma } from "@/lib/prisma";

import {
  PIECES_SUIVIES,
  demandeUnGeste,
  etatPiece,
  type EtatPiece,
  type PieceLue,
} from "./pieces-a-renouveler";

export interface LignePieces {
  readonly trainerId: string;
  readonly nom: string;
  readonly pieces: ReadonlyArray<{
    readonly type: string;
    readonly bloquante: boolean;
    readonly etat: EtatPiece;
  }>;
}

/** Borne de lecture : bien au-delà du nombre de formateurs indépendants attendu. */
const PLAFOND_FICHES = 500;

/** Les indépendants dont au moins une pièce suivie demande un geste ou est en vérification. */
export async function lirePiecesARenouveler(maintenant: Date): Promise<LignePieces[]> {
  const fiches = await prisma.trainer.findMany({
    where: { statut: "sous_traitant", actif: true, finCollaborationAt: null },
    select: { id: true, prenom: true, nom: true },
    orderBy: [{ nom: "asc" }, { prenom: "asc" }],
    take: PLAFOND_FICHES,
  });
  if (fiches.length === 0) return [];
  const docs = await prisma.trainerDocument.findMany({
    where: {
      trainerId: { in: fiches.map((f) => f.id) },
      type: { in: PIECES_SUIVIES.map((p) => p.type) },
    },
    select: {
      id: true,
      trainerId: true,
      type: true,
      statutValidation: true,
      fichierUrl: true,
      dateEmission: true,
      dateExpiration: true,
      createdAt: true,
      archiveAt: true,
      rejetMotif: true,
      valideAt: true,
    },
  });
  const parFiche = new Map<string, PieceLue[]>();
  for (const d of docs) {
    const l = parFiche.get(d.trainerId) ?? [];
    l.push(d as PieceLue);
    parFiche.set(d.trainerId, l);
  }
  return fiches.flatMap((f): LignePieces[] => {
    const pieces = PIECES_SUIVIES.map((p) => ({
      type: p.type,
      bloquante: p.bloquante,
      etat: etatPiece(parFiche.get(f.id) ?? [], p.type, maintenant),
    }));
    const aSuivre = pieces.some((p) => demandeUnGeste(p.etat) || p.etat.etat === "en_verification");
    return aSuivre ? [{ trainerId: f.id, nom: `${f.prenom} ${f.nom}`.trim(), pieces }] : [];
  });
}
