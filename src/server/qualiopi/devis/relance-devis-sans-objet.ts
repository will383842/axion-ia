/**
 * Une relance de devis est-elle encore utile ? Module pur, en lecture seule.
 *
 * Rend `null` si la relance a un sens, sinon le PREMIER motif (texte écrit pour l'administrateur).
 * Réutilise `pasSigneParLeClient` et `devisRemisEnMainPropre` : aucune logique de signature ou de
 * canal n'est recopiée ici.
 */

import type { Prisma } from "../../../../prisma/generated/client";
import { devisRemisEnMainPropre } from "./canal-emission";
import { pasSigneParLeClient } from "./pas-signe-par-le-client";

export const MOTIF_RELANCE_DEVIS_INTROUVABLE = "Devis introuvable : cette relance est sans objet.";
export const MOTIF_RELANCE_DEVIS_ACCEPTE = "Le devis est accepté : cette relance est sans objet.";
export const MOTIF_RELANCE_DEVIS_REFUSE = "Le devis est refusé : cette relance est sans objet.";
export const MOTIF_RELANCE_DEVIS_REMPLACE =
  "Le devis a été remplacé par une version plus récente : relancez plutôt celle-ci.";
export const MOTIF_RELANCE_DEVIS_PERIME =
  "La validité du devis est dépassée : prolongez-la d'abord ou refusez cette relance.";
export const MOTIF_RELANCE_DEVIS_SIGNE =
  "Le client a déjà signé ce devis : il reste à le contresigner, aucune relance n'est utile.";
export const MOTIF_RELANCE_DEVIS_MAIN_PROPRE =
  "Ce devis a été remis en main propre : contactez le client directement.";

/** Lecteur minimal : `prisma` ou une transaction. */
export type LecteurRelanceDevis = Pick<Prisma.TransactionClient, "devis" | "activityLog">;

export async function motifRelanceDevisSansObjet(
  lecteur: LecteurRelanceDevis,
  devisId: string,
  maintenant: Date,
): Promise<string | null> {
  const devis = await lecteur.devis.findUnique({
    where: { id: devisId },
    select: { statut: true, dateValidite: true },
  });
  if (!devis) return MOTIF_RELANCE_DEVIS_INTROUVABLE;
  if (devis.statut === "accepte" || devis.statut === "transforme_convention") {
    return MOTIF_RELANCE_DEVIS_ACCEPTE;
  }
  if (devis.statut === "refuse") return MOTIF_RELANCE_DEVIS_REFUSE;
  if (devis.statut === "expire") {
    // Une version suivante émise (non brouillon) relie `replacesDevisId` à ce devis.
    const suivante = await lecteur.devis.count({
      where: { replacesDevisId: devisId, statut: { not: "brouillon" } },
    });
    return suivante > 0 ? MOTIF_RELANCE_DEVIS_REMPLACE : MOTIF_RELANCE_DEVIS_PERIME;
  }
  if (devis.dateValidite < maintenant) return MOTIF_RELANCE_DEVIS_PERIME;
  const nonSigne = await lecteur.devis.count({ where: { id: devisId, ...pasSigneParLeClient } });
  if (nonSigne === 0) return MOTIF_RELANCE_DEVIS_SIGNE;
  if (await devisRemisEnMainPropre(lecteur, devisId)) return MOTIF_RELANCE_DEVIS_MAIN_PROPRE;
  return null;
}
