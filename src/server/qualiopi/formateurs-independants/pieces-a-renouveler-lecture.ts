/**
 * Pièces à renouveler — lecture pour la console (lot L13). Une requête pour
 * les fiches, une pour leurs pièces suivies ; l'état vient du module pur.
 *
 * Indépendants seulement (ADR 0066 (a)) : actifs, sans fin de collaboration.
 *
 * ⚠️ Ne juge ni le rôle ni l'interrupteur : l'appelant (la page) le fait AVANT.
 * Ne jamais l'appeler depuis une Server Action sans cette garde.
 */

import { prisma } from "@/lib/prisma";

import {
  PIECES_SUIVIES,
  demandeUnGeste,
  etatPiece,
  type EtatPiece,
  type PieceLue,
} from "./pieces-a-renouveler";
import { phaseVigilanceFormateur } from "./vigilance-seuil";
import { lireCumulsHonorairesHtCents } from "./vigilance-seuil-lecture";

export interface LignePieces {
  readonly trainerId: string;
  readonly nom: string;
  readonly pieces: ReadonlyArray<{
    readonly type: string;
    readonly bloquante: boolean;
    readonly etat: EtatPiece;
  }>;
}

/** Bornes de lecture : bien au-delà du nombre de formateurs indépendants attendu. */
const PLAFOND_FICHES = 500;
const PLAFOND_PIECES = 10_000;

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
      archiveAt: null,
    },
    take: PLAFOND_PIECES,
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
  // Lot G1 : l'attestation URSSAF ne bloque qu'au seuil de vigilance, et n'est
  // attendue qu'à partir de son approche (`vigilance-seuil.ts`).
  const cumuls = await lireCumulsHonorairesHtCents(fiches.map((f) => f.id));
  const parFiche = new Map<string, PieceLue[]>();
  for (const d of docs) {
    const l = parFiche.get(d.trainerId) ?? [];
    l.push(d as PieceLue);
    parFiche.set(d.trainerId, l);
  }
  return fiches.flatMap((f): LignePieces[] => {
    const phase = phaseVigilanceFormateur(cumuls.get(f.id) ?? null);
    const pieces = PIECES_SUIVIES.map((p) => {
      const attestation = p.type === "attestation_vigilance_urssaf";
      return {
        type: p.type,
        bloquante: attestation ? p.bloquante && phase === "seuil_atteint" : p.bloquante,
        etat: etatPiece(parFiche.get(f.id) ?? [], p.type, maintenant),
        pasEncore: attestation && phase === "sous_le_seuil",
      };
    });
    const aSuivre = pieces.some(
      (p) =>
        (demandeUnGeste(p.etat) && !(p.pasEncore && p.etat.etat === "absente")) ||
        p.etat.etat === "en_verification",
    );
    return aSuivre
      ? [
          {
            trainerId: f.id,
            nom: `${f.prenom} ${f.nom}`.trim(),
            pieces: pieces.map(({ pasEncore: _pasEncore, ...p }) => p),
          },
        ]
      : [];
  });
}
