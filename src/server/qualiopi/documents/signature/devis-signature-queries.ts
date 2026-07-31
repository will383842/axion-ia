/**
 * Lecture du devis présenté au signataire sur le canal A.
 *
 * 🔴 Ce module existe pour que l'écran de signature montre CE QUI EST SIGNÉ.
 * C'est le défaut exact que la bascule du 2026-07-30 corrige : le circuit
 * précédent affichait au signataire un formulaire à trois champs pendant que le
 * détail dormait dans une pièce jointe.
 *
 * ⚠️ Lecture SEULE, et volontairement pauvre : elle ne rend que ce qui doit être
 * affiché. Pas de contact, pas d'adresse, pas d'historique commercial — un lien
 * public ne doit exposer que la pièce qu'il sert à signer.
 *
 * Node runtime (Prisma). Stub-aware pour le build SSG.
 */

import { prisma } from "@/lib/prisma";
import type { LigneFacture } from "@/server/qualiopi/documents/templates/facture";
import {
  computeTotauxFacture,
  mentionTva,
  TAUX_TVA_STANDARD,
  type RegimeTva,
} from "@/server/qualiopi/legal/tva";

export interface LigneDevisAffichee {
  designation: string;
  quantite: number;
  prixUnitaireHtLisible: string;
  totalHtLisible: string;
}

export interface DevisASigner {
  devisId: string;
  numero: string;
  dateValiditeLisible: string;
  clientRaisonSociale: string;
  lignes: LigneDevisAffichee[];
  totalHtLisible: string;
  totalTtcLisible: string;
  mentionTva: string | null;
  /** `true` si le devis n'est plus dans un état où une signature a du sens. */
  statutBloquant: "deja_accepte" | "expire" | "brouillon" | null;
}

function eur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Charge le devis rattaché à une pièce, tel qu'il doit être présenté au client.
 *
 * `null` si aucun devis ne porte cette pièce — cas anormal qui doit se traduire
 * par un 404, jamais par un écran de signature vide.
 *
 * ⚠️ Le régime de TVA est relu de la MENTION SNAPSHOTÉE sur le devis, pas de la
 * configuration courante : `Devis.mentionTva` a été figée à la création
 * précisément pour qu'un changement de régime ne réécrive pas rétroactivement
 * une pièce déjà émise. Les totaux, eux, se recalculent depuis les lignes, qui
 * portent leur propre `tauxTvaPercent`.
 */
export async function lireDevisASigner(
  documentGenereId: string,
  regimeTva: RegimeTva,
  tauxStandard: number = TAUX_TVA_STANDARD,
): Promise<DevisASigner | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return null;

  const devis = await prisma.devis.findFirst({
    where: { documentGenereId },
    select: {
      id: true,
      numero: true,
      statut: true,
      lignes: true,
      dateValidite: true,
      mentionTva: true,
      client: { select: { raisonSociale: true } },
    },
  });
  if (devis === null) return null;

  const lignesBrutes = (Array.isArray(devis.lignes)
    ? devis.lignes
    : []) as unknown as LigneFacture[];
  const totaux = computeTotauxFacture(lignesBrutes, regimeTva, tauxStandard);

  const lignes: LigneDevisAffichee[] = lignesBrutes.map((l) => {
    const qte = typeof l.quantite === "number" ? l.quantite : 0;
    const pu = typeof l.prixUnitaireHtCents === "number" ? l.prixUnitaireHtCents : 0;
    return {
      designation: l.designation,
      quantite: qte,
      prixUnitaireHtLisible: eur(pu),
      totalHtLisible: eur(Math.round(qte * pu)),
    };
  });

  // 🔴 Un devis qui n'est pas `envoye` ne doit pas se signer, et le dire est
  // plus utile que de laisser `signerDocument` refuser plus loin sur un motif
  // que le client ne comprendrait pas.
  //
  // ⚠️ `expire` est calculé sur le STATUT, pas sur la date : la date de validité
  // borne déjà le jeton (`calculerExpirationDocument`), et recalculer ici une
  // seconde règle d'expiration ferait diverger les deux.
  const statutBloquant: DevisASigner["statutBloquant"] =
    devis.statut === "accepte" || devis.statut === "transforme_convention"
      ? "deja_accepte"
      : devis.statut === "expire" || devis.statut === "refuse"
        ? "expire"
        : devis.statut === "brouillon"
          ? "brouillon"
          : null;

  return {
    devisId: devis.id,
    numero: devis.numero,
    dateValiditeLisible: devis.dateValidite.toLocaleDateString("fr-FR"),
    clientRaisonSociale: devis.client.raisonSociale,
    lignes,
    totalHtLisible: eur(totaux.totalHtCents),
    totalTtcLisible: eur(totaux.totalTtcCents),
    mentionTva: mentionTva(regimeTva) ?? devis.mentionTva ?? null,
    statutBloquant,
  };
}
