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

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { instantane } from "@/server/qualiopi/documents/signature/instantane";
import {
  computeTotauxFacture,
  isRegimeTva,
  mentionTva,
  TAUX_TVA_STANDARD,
} from "@/server/qualiopi/legal/tva";

/**
 * La PHOTO du devis : ce qui a servi à rendre le PDF que le client signe
 * (`DocumentGenere.metadata.renderData.data`), telle que le gabarit `DevisPdf`
 * la consomme.
 */
const photoDevis = z.object({
  lignes: z.array(
    z.object({
      designation: z.string(),
      quantite: z.number(),
      prixUnitaireHtCents: z.number(),
      tauxTvaPercent: z.number().optional(),
    }),
  ),
  regimeTva: z.custom<"assujetti" | "exoneration_261" | "franchise_293b">(isRegimeTva),
  tauxTvaStandardPercent: z.number().optional(),
  client: z.object({ raisonSociale: z.string() }).optional(),
});

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
  /**
   * `true` quand la photo de la pièce est absente ou illisible. Aucun recalcul
   * de repli : les lignes sont vides et les totaux sont des chaînes vides.
   */
  chiffrageIndisponible: boolean;
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
 * 🔴 Lignes, régime et taux de TVA, totaux, mention et raison sociale viennent
 * de la PHOTO de la pièce (`DocumentGenere.metadata.renderData.data`), jamais de
 * la configuration courante ni de `Devis.lignes` : le client signe le PDF rendu
 * depuis cette photo, la page doit montrer les mêmes montants. Photo absente ou
 * illisible : `chiffrageIndisponible`, sans AUCUN recalcul de repli.
 */
export async function lireDevisASigner(documentGenereId: string): Promise<DevisASigner | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return null;

  const devis = await prisma.devis.findFirst({
    where: { documentGenereId },
    select: {
      id: true,
      numero: true,
      statut: true,
      dateValidite: true,
      montantTotalHtCents: true,
      client: { select: { raisonSociale: true } },
      documentGenere: { select: { metadata: true } },
    },
  });
  if (devis === null) return null;

  const brut = instantane(devis.documentGenere?.metadata)?.data;
  const lu = brut === undefined ? null : photoDevis.safeParse(brut);
  const snap = lu !== null && lu.success ? lu.data : null;

  let lignes: LigneDevisAffichee[] = [];
  let totalHtLisible = "";
  let totalTtcLisible = "";
  let mention: string | null = null;
  let clientRaisonSociale = devis.client.raisonSociale;

  if (snap !== null) {
    // `exactOptionalPropertyTypes` : on retire explicitement un taux absent.
    const lignesFacturables = snap.lignes.map((l) => ({
      designation: l.designation,
      quantite: l.quantite,
      prixUnitaireHtCents: l.prixUnitaireHtCents,
      ...(l.tauxTvaPercent !== undefined ? { tauxTvaPercent: l.tauxTvaPercent } : {}),
    }));
    const totaux = computeTotauxFacture(
      lignesFacturables,
      snap.regimeTva,
      snap.tauxTvaStandardPercent ?? TAUX_TVA_STANDARD,
    );
    lignes = snap.lignes.map((l) => ({
      designation: l.designation,
      quantite: l.quantite,
      prixUnitaireHtLisible: eur(l.prixUnitaireHtCents),
      totalHtLisible: eur(Math.round(l.quantite * l.prixUnitaireHtCents)),
    }));
    totalHtLisible = eur(totaux.totalHtCents);
    totalTtcLisible = eur(totaux.totalTtcCents);
    mention = mentionTva(snap.regimeTva);
    clientRaisonSociale = snap.client?.raisonSociale ?? clientRaisonSociale;
    // Contrôle de cohérence : on affiche la photo quoi qu'il arrive, on signale l'écart.
    if (totaux.totalHtCents !== devis.montantTotalHtCents) {
      Sentry.captureMessage("devis-signature: HT de la photo ≠ Devis.montantTotalHtCents", {
        level: "warning",
        tags: { module: "devis-signature" },
      });
    }
  }

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
    clientRaisonSociale,
    lignes,
    totalHtLisible,
    totalTtcLisible,
    mentionTva: mention,
    chiffrageIndisponible: snap === null,
    statutBloquant,
  };
}
