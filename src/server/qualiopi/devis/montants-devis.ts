/**
 * Montants d'un devis — point d'entrée UNIQUE, PUR.
 *   - offre NULL        : lignes et total actuels, INCHANGÉS ;
 *   - une formule       : lignes + total de la partie ponctuelle ;
 *   - deux formules     : lignes vides et total 0 tant que le client n'a pas choisi.
 */
import { selectionComplete } from "./dependances";
import type { Formule, LigneOffre, OffreDevisV1 } from "./offre-devis";
import { totauxFormule } from "./offre-calculs";

export interface ChoixDevis {
  readonly formule: Formule;
  readonly automatisationsRetenues: readonly string[];
}

export interface DevisPourMontants {
  readonly offre: OffreDevisV1 | null;
  readonly lignes: readonly LigneOffre[];
  readonly totalHtCents: number;
  readonly choix?: ChoixDevis;
}

export interface MontantsDevis {
  readonly lignes: readonly LigneOffre[];
  readonly totalHtCents: number;
}

export function montantsDevis(devis: DevisPourMontants): MontantsDevis {
  const { offre } = devis;
  if (offre === null) return { lignes: devis.lignes, totalHtCents: devis.totalHtCents };

  const formule =
    devis.choix?.formule ??
    (offre.formulesProposees.length === 1 ? offre.formulesProposees[0]! : null);
  if (formule === null) return { lignes: [], totalHtCents: 0 };

  const sel = selectionComplete(devis.choix?.automatisationsRetenues ?? [], offre.automatisations);
  const retenues = sel.ok
    ? sel.retenues
    : offre.automatisations.filter((a) => !a.facultative).map((a) => a.code);

  const base =
    formule === "achat"
      ? (offre.achat?.lignes ?? [])
      : (offre.abonnement?.miseEnServiceLignes ?? []);
  const autos = offre.automatisations
    .filter((a) => retenues.includes(a.code))
    .map((a) => ({
      libelle: a.libelle,
      quantite: 1,
      prixHtCents: a.prixHtCents,
      tauxTvaBps: a.tauxTvaBps,
    }));
  return {
    lignes: [...base, ...autos],
    totalHtCents: totauxFormule(offre, formule, retenues).totalHtCents,
  };
}
