// La PRESTATION d'une entreprise présentée (contrat 2.3, art. 4.2), vue depuis la présentation :
// ses commissions, et si la prestation est marquée réalisée. Lecture seule ; les écritures
// passent par `realisation.ts` (marquerPrestationRealisee / annulerRealisation).

import { prisma } from "@/lib/prisma";

import { realisationDisponible } from "./realisation";

/** Une commission rattachée à une présentation, telle que la fiche la montre. */
export interface CommissionDeLaPresentation {
  id: string;
  montantCents: number | null;
  statut: string;
  prestationRealiseeAt: Date | null;
  /** Numéro d'autofacture : posé, la réalisation ne s'annule plus (on enregistre une reprise). */
  autofactureNumero: string | null;
  /** Palier choisi ; « hors-grille » : Williams a constaté un produit hors grille (A1.7). */
  palier: string | null;
}

/** Ce que l'apporteur lit : rien (pas encore de commande), en attente, ou réalisée. */
export type EtatPrestation = { etat: "en_attente" } | { etat: "realisee"; le: Date } | null;

/**
 * L'état de la prestation d'UNE présentation, d'après ses commissions. Une commission reprise
 * (remboursement, art. 4.5) ne compte pas. Aucune commission → `null` : il n'y a encore rien à
 * réaliser. Toutes marquées → réalisée, à la date la plus récente ; sinon en attente.
 */
export function etatPrestation(
  commissions: ReadonlyArray<Pick<CommissionDeLaPresentation, "statut" | "prestationRealiseeAt">>,
): EtatPrestation {
  const vivantes = commissions.filter((c) => c.statut !== "reprise");
  if (vivantes.length === 0) return null;
  let le: Date | null = null;
  for (const c of vivantes) {
    if (!c.prestationRealiseeAt) return { etat: "en_attente" };
    if (!le || c.prestationRealiseeAt > le) le = c.prestationRealiseeAt;
  }
  return le ? { etat: "realisee", le } : { etat: "en_attente" };
}

/**
 * Annexe 1, A1.7 : une commission « à qualifier » dont Williams a constaté que le produit est HORS
 * GRILLE. L'apporteur le voit : la Société publie sa commission, ou constate par écrit qu'elle
 * n'est pas commissionnée, dans les soixante jours de l'encaissement.
 */
/**
 * Le repère « hors grille » (miroir de `PALIER_HORS_GRILLE` de `hors-grille.ts`, recopié pour ne
 * pas tirer la file d'e-mails dans cette lecture ; l'égalité est verrouillée par un test).
 */
export const REPERE_HORS_GRILLE = "hors-grille";

export function horsGrilleEnCours(
  commissions: ReadonlyArray<Pick<CommissionDeLaPresentation, "statut" | "palier">>,
): boolean {
  return commissions.some((c) => c.statut === "a_qualifier" && c.palier === REPERE_HORS_GRILLE);
}

/**
 * Les commissions (hors parrainage) de chaque présentation citée. Colonne de réalisation pas
 * encore posée (fenêtre de déploiement) → carte vide : la fiche n'affiche rien plutôt que de
 * tomber.
 */
export async function lireCommissionsDesPresentations(
  ids: readonly string[],
): Promise<Map<string, CommissionDeLaPresentation[]>> {
  const out = new Map<string, CommissionDeLaPresentation[]>();
  if (ids.length === 0 || !(await realisationDisponible())) return out;
  const l = await prisma.commissionApporteur.findMany({
    where: { presentationId: { in: [...ids] }, parrainage: false },
    orderBy: { creeAt: "asc" },
    select: {
      id: true,
      presentationId: true,
      montantCents: true,
      statut: true,
      prestationRealiseeAt: true,
      autofactureNumero: true,
      palier: true,
    },
  });
  for (const c of l) {
    if (!c.presentationId) continue;
    const liste = out.get(c.presentationId) ?? [];
    liste.push({
      id: c.id,
      montantCents: c.montantCents,
      statut: c.statut,
      prestationRealiseeAt: c.prestationRealiseeAt,
      autofactureNumero: c.autofactureNumero,
      palier: c.palier,
    });
    out.set(c.presentationId, liste);
  }
  return out;
}
