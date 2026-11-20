/**
 * Pipeline d'une fiche alimenté par les devis ENVOYÉS (en attente de réponse). PUR, lecture seule :
 * les totaux viennent des fonctions du PDF (`montantsDevis` puis `computeTotauxFacture`), rien n'est
 * recalculé ici.
 */

import { montantsDevis } from "@/server/qualiopi/devis/montants-devis";
import { offreDevisV1, type Formule } from "@/server/qualiopi/devis/offre-devis";
import { computeTotauxFacture, type RegimeTva } from "@/server/qualiopi/legal/tva";

export interface DevisPourPipeline {
  readonly id: string;
  readonly statut: string;
  /** Json brut de la base : validé ici par `offreDevisV1`. */
  readonly offre: unknown;
  readonly lignes: unknown;
  readonly montantTotalHtCents: number;
  readonly sentAt: Date | null;
  readonly createdAt: Date;
}

export interface DevisEnAttente {
  readonly nb: number;
  readonly htCents: number;
  readonly ttcCents: number;
  /** Au moins un devis propose deux formules : son montant est celui de la plus basse. */
  readonly aPartirDe: boolean;
  /** Le dernier devis envoyé (cible du lien « Voir le devis »). */
  readonly dernierDevisId: string;
}

type Lignes = Parameters<typeof montantsDevis>[0]["lignes"];

function totauxDuDevis(
  d: DevisPourPipeline,
  regime: RegimeTva,
  taux: number,
): { ht: number; ttc: number; aPartirDe: boolean } {
  const lignesBrutes = (Array.isArray(d.lignes) ? d.lignes : []) as Lignes;
  const total = (lignes: Lignes) => {
    // Hors régime assujetti, le taux saisi sur les lignes est ignoré (même règle que `totauxFormule`).
    const lignesTaxees =
      regime === "assujetti" ? lignes : lignes.map(({ tauxTvaPercent: _t, ...l }) => l);
    const t = computeTotauxFacture(lignesTaxees, regime, taux);
    return { ht: t.totalHtCents, ttc: t.totalTtcCents };
  };
  if (d.offre === null || d.offre === undefined) {
    return {
      ...total(
        montantsDevis({
          offre: null,
          lignes: lignesBrutes,
          montantTotalHtCents: d.montantTotalHtCents,
        }).lignes,
      ),
      aPartirDe: false,
    };
  }
  const offre = offreDevisV1.parse(d.offre);
  const parFormule = offre.formulesProposees.map((formule: Formule) =>
    total(
      montantsDevis({
        offre,
        lignes: lignesBrutes,
        montantTotalHtCents: d.montantTotalHtCents,
        choix: { formule, automatisationsRetenues: [] },
      }).lignes,
    ),
  );
  const plusBasse = parFormule.reduce((m, x) => (x.ht < m.ht ? x : m));
  return { ...plusBasse, aPartirDe: parFormule.length > 1 };
}

/** `null` : aucun devis envoyé (la tuile garde son affichage d'avant). Lève si un devis est illisible. */
export function devisEnAttentePourPipeline(
  devis: ReadonlyArray<DevisPourPipeline>,
  regime: RegimeTva,
  taux: number,
): DevisEnAttente | null {
  const envoyes = devis.filter((d) => d.statut === "envoye");
  if (envoyes.length === 0) return null;
  let htCents = 0;
  let ttcCents = 0;
  let aPartirDe = false;
  for (const d of envoyes) {
    const t = totauxDuDevis(d, regime, taux);
    htCents += t.ht;
    ttcCents += t.ttc;
    aPartirDe = aPartirDe || t.aPartirDe;
  }
  const date = (d: DevisPourPipeline) => (d.sentAt ?? d.createdAt).getTime();
  const dernier = envoyes.reduce((m, d) => (date(d) > date(m) ? d : m));
  return { nb: envoyes.length, htCents, ttcCents, aPartirDe, dernierDevisId: dernier.id };
}
