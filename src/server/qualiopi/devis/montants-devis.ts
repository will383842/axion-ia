/**
 * Montants d'un devis — point d'entrée UNIQUE, PUR.
 *   - offre NULL        : lignes et total actuels, INCHANGÉS ;
 *   - une formule       : lignes + total de la partie ponctuelle ;
 *   - deux formules     : lignes vides et total 0 tant que le client n'a pas choisi.
 *
 * Forme = celle du VRAI `Devis` (prisma `model Devis`) : `lignes` Json
 * `{ designation, quantite, prixUnitaireHtCents, tauxTvaPercent? }` (type
 * `LigneFacture`, lu par `devis-signature-queries`) et `montantTotalHtCents`.
 */
import type { LigneFacture } from "../documents/templates/facture";
import { selectionComplete } from "./dependances";
import { choixCanonique, totauxFormule, type ChoixCanonique } from "./offre-calculs";
import { CENTS_MAX, type Formule, type OffreDevisV1 } from "./offre-devis";

export interface ChoixDevis {
  readonly formule: Formule;
  readonly automatisationsRetenues: readonly string[];
}

export interface DevisPourMontants {
  readonly offre: OffreDevisV1 | null;
  readonly lignes: readonly LigneFacture[];
  readonly montantTotalHtCents: number;
  readonly choix?: ChoixDevis;
}

export interface MontantsDevis {
  readonly lignes: readonly LigneFacture[];
  readonly montantTotalHtCents: number;
}

/** Sélection d'automatisations incomplète ou inconnue : on ne devine pas à la place du client. */
export class SelectionIncompleteError extends Error {
  readonly inconnues: readonly string[];
  readonly manquantes: readonly string[];
  constructor(inconnues: readonly string[], manquantes: readonly string[]) {
    super(
      `Sélection d'automatisations incomplète (inconnues : ${inconnues.join(", ") || "aucune"} ; ` +
        `dépendances manquantes : ${manquantes.join(", ") || "aucune"}).`,
    );
    this.name = "SelectionIncompleteError";
    this.inconnues = inconnues;
    this.manquantes = manquantes;
  }
}

/** La formule choisie n'est pas proposée par l'offre, ou son bloc de prix manque. */
export class FormuleNonProposeeError extends Error {
  readonly formule: Formule;
  constructor(formule: Formule, raison: "non_proposee" | "bloc_absent") {
    super(
      raison === "non_proposee"
        ? `Formule « ${formule} » non proposée par l'offre.`
        : `Formule « ${formule} » proposée mais son bloc de prix est absent.`,
    );
    this.name = "FormuleNonProposeeError";
    this.formule = formule;
  }
}

/**
 * ⚠️ `offre` doit être valide : un appelant qui lit le Json en base DOIT le passer par
 * `offreDevisV1.parse` avant d'appeler (cette fonction ne revalide rien).
 */
export function montantsDevis(devis: DevisPourMontants): MontantsDevis {
  const { offre } = devis;
  if (offre === null) {
    return { lignes: devis.lignes, montantTotalHtCents: devis.montantTotalHtCents };
  }

  const formule =
    devis.choix?.formule ??
    (offre.formulesProposees.length === 1 ? offre.formulesProposees[0]! : null);
  if (formule === null) return { lignes: [], montantTotalHtCents: 0 };

  if (!offre.formulesProposees.includes(formule)) {
    throw new FormuleNonProposeeError(formule, "non_proposee");
  }
  if ((formule === "achat" ? offre.achat : offre.abonnement) == null) {
    throw new FormuleNonProposeeError(formule, "bloc_absent");
  }

  const sel = selectionComplete(devis.choix?.automatisationsRetenues ?? [], offre.automatisations);
  if (!sel.ok) throw new SelectionIncompleteError(sel.inconnues, sel.manquantes);
  const retenues = sel.retenues;

  const base =
    formule === "achat"
      ? (offre.achat?.lignes ?? [])
      : (offre.abonnement?.miseEnServiceLignes ?? []);
  const lignes: LigneFacture[] = [
    ...base.map((l) => ({
      designation: l.libelle,
      quantite: l.quantite,
      prixUnitaireHtCents: l.prixHtCents,
      tauxTvaPercent: l.tauxTvaBps / 100,
    })),
    ...offre.automatisations
      .filter((a) => retenues.includes(a.code))
      .map((a) => ({
        designation: a.libelle,
        quantite: 1,
        prixUnitaireHtCents: a.prixHtCents,
        tauxTvaPercent: a.tauxTvaBps / 100,
      })),
  ];
  const totalHtCents = totauxFormule(offre, formule, retenues).totalHtCents;
  // `Devis.montantTotalHtCents` est un Int 32 bits : le prix unitaire et la quantité sont
  // bornés chacun, pas leur produit ni leur somme.
  if (totalHtCents > CENTS_MAX) {
    throw new RangeError(`Total HT hors borne (${totalHtCents} > ${CENTS_MAX} centimes).`);
  }
  return { lignes, montantTotalHtCents: totalHtCents };
}

/**
 * Choix canonique empreinté sur la liste RÉELLEMENT FACTURÉE (`sel.retenues` : saisie
 * + automatisations non facultatives), jamais sur la saisie brute : deux saisies qui
 * facturent la même chose doivent sceller la même chose, et la preuve doit refléter la
 * facture. Même refus que `montantsDevis` sur une sélection inconnue ou incomplète.
 */
export function choixCanoniqueDepuisOffre(
  offre: OffreDevisV1,
  c: Omit<ChoixCanonique, "v">,
): ChoixCanonique {
  const sel = selectionComplete(c.automatisationsRetenues, offre.automatisations);
  if (!sel.ok) throw new SelectionIncompleteError(sel.inconnues, sel.manquantes);
  return choixCanonique({ ...c, automatisationsRetenues: sel.retenues });
}
