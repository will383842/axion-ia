/**
 * Pipeline d'une fiche alimenté par les devis ENVOYÉS (en attente de réponse). PUR, lecture seule :
 * les totaux viennent des fonctions du PDF (`montantsDevis` puis `computeTotauxFacture`), rien n'est
 * recalculé ici.
 */

import { montantsDevis } from "@/server/qualiopi/devis/montants-devis";
import { offreDevisV1, type Formule } from "@/server/qualiopi/devis/offre-devis";
import { normaliserLignesPourActivite } from "@/server/qualiopi/financements/facture-libre-pur";
import { computeTotauxFacture, type RegimeTva } from "@/server/qualiopi/legal/tva";

export interface DevisPourPipeline {
  readonly id: string;
  readonly statut: string;
  /** Json brut de la base : validé ici par `offreDevisV1`. */
  readonly offre: unknown;
  readonly lignes: unknown;
  readonly montantTotalHtCents: number;
  /** Activité facturée : le PDF normalise les lignes quand elle est posée. */
  readonly activite?: Parameters<typeof normaliserLignesPourActivite>[1] | null;
  readonly sentAt: Date | null;
  readonly createdAt: Date;
}

export interface DevisEnAttente {
  readonly nb: number;
  readonly htCents: number;
  readonly ttcCents: number;
  /** Au moins un devis propose deux formules : son montant est celui de la plus basse. */
  readonly aPartirDe: boolean;
  /** Le dernier devis envoyé lisible (cible du lien « Voir le devis ») ; `null` si aucun n'est lisible. */
  readonly dernierDevisId: string | null;
  /** Devis envoyés dont l'offre est illisible : ignorés du total, signalés à l'écran. */
  readonly illisibles: number;
}

type Lignes = Parameters<typeof montantsDevis>[0]["lignes"];

function totauxDuDevis(
  d: DevisPourPipeline,
  regime: RegimeTva,
  taux: number,
  formulesActives: boolean,
): { ht: number; ttc: number; aPartirDe: boolean } {
  const brutes = (Array.isArray(d.lignes) ? d.lignes : []) as Lignes;
  // Comme le PDF : normalisation par activité avant tout calcul.
  const lignesBrutes: Lignes =
    d.activite !== null && d.activite !== undefined
      ? normaliserLignesPourActivite([...brutes], d.activite, regime, taux)
      : brutes;
  const total = (lignes: Lignes, retirerTauxLigne: boolean) => {
    // Branche à formules seulement : hors régime assujetti, le taux saisi est ignoré (`totauxFormule`).
    // Un devis classique suit `tauxTvaLigne`, comme le PDF.
    const lignesTaxees =
      retirerTauxLigne && regime !== "assujetti"
        ? lignes.map(({ tauxTvaPercent: _t, ...l }) => l)
        : lignes;
    const t = computeTotauxFacture(lignesTaxees, regime, taux);
    return { ht: t.totalHtCents, ttc: t.totalTtcCents };
  };
  // Interrupteur éteint : le PDF ne montre pas les formules, le devis se lit comme un classique.
  if (d.offre === null || d.offre === undefined || !formulesActives) {
    return {
      ...total(
        montantsDevis({
          offre: null,
          lignes: lignesBrutes,
          montantTotalHtCents: d.montantTotalHtCents,
        }).lignes,
        false,
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
      true,
    ),
  );
  const plusBasse = parFormule.reduce((m, x) => (x.ht < m.ht ? x : m));
  return { ...plusBasse, aPartirDe: parFormule.length > 1 };
}

/**
 * `null` : aucun devis envoyé (la tuile garde son affichage d'avant). Un devis à l'offre illisible
 * est ignoré du total, compté dans `illisibles` et journalisé sans donnée personnelle.
 */
export function devisEnAttentePourPipeline(
  devis: ReadonlyArray<DevisPourPipeline>,
  regime: RegimeTva,
  taux: number,
  formulesActives: boolean = false,
): DevisEnAttente | null {
  const envoyes = devis.filter((d) => d.statut === "envoye");
  if (envoyes.length === 0) return null;
  let htCents = 0;
  let ttcCents = 0;
  let aPartirDe = false;
  let illisibles = 0;
  const lisibles: DevisPourPipeline[] = [];
  for (const d of envoyes) {
    try {
      const t = totauxDuDevis(d, regime, taux, formulesActives);
      htCents += t.ht;
      ttcCents += t.ttc;
      aPartirDe = aPartirDe || t.aPartirDe;
      lisibles.push(d);
    } catch (e) {
      illisibles += 1;
      // Aucune donnée personnelle : ni identifiant, ni montant, ni message d'erreur.
      console.warn("[fiche-client] devis à l'offre illisible, ignoré du pipeline", {
        type: e instanceof Error ? e.name : "inconnu",
      });
    }
  }
  const date = (d: DevisPourPipeline) => (d.sentAt ?? d.createdAt).getTime();
  const dernier =
    lisibles.length === 0 ? null : lisibles.reduce((m, d) => (date(d) > date(m) ? d : m));
  return {
    nb: lisibles.length,
    htCents,
    ttcCents,
    aPartirDe,
    dernierDevisId: dernier === null ? null : dernier.id,
    illisibles,
  };
}
