/**
 * Formateurs indépendants — LA GARDE DU VIREMENT D'UN RELEVÉ DE MISSION (lot L12d), pure.
 *
 * S'ajoute aux gardes existantes de « Virement fait » (`transitionStatementAction` :
 * facture conforme, pièce non contestée) pour les seuls relevés du paiement par
 * mission (ADR 0066 v2 (e), décisions 72 et 87) :
 *
 *   - **attestation de vigilance échue À LA DATE DE LA MISSION**, quand le cumul
 *     des honoraires HT du formateur a atteint le seuil (lot G1, `vigilance-seuil.ts`) :
 *     le virement attend (l'autofacture, elle, est émise) — rubrique « en attente
 *     d'attestation URSSAF ». Sous le seuil, AUCUNE suspension pour ce motif ;
 *   - **demande de changement d'IBAN en attente** : aucun virement — rubrique
 *     « compte bancaire à valider » (l'ancien compte n'est plus proposé) ;
 *   - **nouvel IBAN validé il y a moins de 48 h** (depuis la demande) : attendre ;
 *   - **IBAN absent** : impossible ;
 *   - **empreinte de l'IBAN relue au clic ≠ celle affichée** : refus (le compte a
 *     changé entre l'affichage et le clic) ;
 *   - **fin de collaboration pour décès** : règlement à la main, hors liste.
 *
 * Retard (décision 87, recommandation ÉTEINTE) : si le virement part après
 * l'échéance, la garde CALCULE le supplément légal (pénalités + 40 €) pour qu'il
 * soit affiché avant le clic. Elle n'écrit rien : l'écriture comptable des
 * pénalités attend la confirmation du juriste.
 *
 * Aucune donnée d'IBAN en clair n'entre ni ne sort d'ici : des empreintes et des
 * dates seulement.
 */

import { nouvelIbanUtilisableDes, retardDePaiement, type Retard } from "../argent/calcul-mission";
import type { JourCivil } from "../argent/dates";
import {
  PARAMETRES_ARGENT_FORMATEURS,
  type ParametresArgentFormateurs,
} from "../argent/parametres";
import { SEUIL_VIGILANCE_LIBELLE } from "../vigilance-seuil";

export type MotifSuspensionVirement =
  | "attestation_urssaf_echue_a_la_mission"
  | "compte_bancaire_a_valider"
  | "nouvel_iban_moins_de_48h"
  | "iban_absent"
  | "iban_change_depuis_l_affichage"
  | "reglement_a_la_main";

export const LIBELLE_SUSPENSION_VIREMENT: Record<MotifSuspensionVirement, string> = {
  attestation_urssaf_echue_a_la_mission: `En attente d'attestation URSSAF : les honoraires de ce formateur atteignent ${SEUIL_VIGILANCE_LIBELLE} HT, et aucune attestation vérifiée n'était valable à la date de la mission.`,
  compte_bancaire_a_valider:
    "Compte bancaire à valider : une demande de changement d'IBAN attend votre accord.",
  nouvel_iban_moins_de_48h:
    "Nouveau compte bancaire : le virement est possible 48 heures après la demande.",
  iban_absent: "Aucun IBAN enregistré pour ce formateur.",
  iban_change_depuis_l_affichage:
    "Le compte bancaire a changé depuis l'ouverture de cette page : rechargez-la et vérifiez l'IBAN.",
  reglement_a_la_main: "Règlement à la main (fin de collaboration) : hors « Virements à faire ».",
};

export interface ContexteVirementMission {
  /** Dernière journée du mois facturé (la mission) : la vigilance s'y juge. */
  readonly derniereJournee: JourCivil;
  /** Échéance légale du relevé. */
  readonly echeance: JourCivil;
  /** Jour du virement (clic). */
  readonly aujourdhui: JourCivil;
  readonly maintenant: Date;
  readonly totalTtcCents: number;
  /** Fins de validité des attestations URSSAF VALIDÉES et non archivées (jours civils). */
  readonly attestationsValidesJusquau: ReadonlyArray<JourCivil>;
  /**
   * Lot G1 : le cumul des honoraires HT a-t-il atteint le seuil de vigilance
   * (`vigilanceExigible`) ? Absent : OUI — la garde reste celle d'avant le lot.
   */
  readonly vigilanceExigible?: boolean;
  readonly demandeIbanEnAttente: boolean;
  /** Dernière demande d'IBAN ACCEPTÉE : demandée le…, validée le… */
  readonly dernierChangementIban: { readonly demandeA: Date; readonly valideA: Date } | null;
  /** Empreinte de l'IBAN lue en base AU MOMENT DU CLIC. */
  readonly ibanEmpreinteActuelle: string | null;
  /** Empreinte affichée à l'opérateur (envoyée par le formulaire). */
  readonly ibanEmpreinteAffichee: string | null;
  readonly finPourDeces: boolean;
}

export interface VerdictVirementMission {
  readonly autorise: boolean;
  readonly motifs: ReadonlyArray<MotifSuspensionVirement>;
  /** Supplément légal si le virement part après l'échéance (affiché, jamais écrit ici). */
  readonly retard: Retard;
}

/**
 * Le virement attend-il l'attestation URSSAF ? Seulement au seuil (lot G1), et tant
 * qu'aucune attestation vérifiée n'est valable à la date de la mission. La console
 * (« Virements à faire ») et l'espace du formateur lisent CETTE fonction.
 */
export function attenteAttestationALaMission(
  c: Pick<
    ContexteVirementMission,
    "vigilanceExigible" | "attestationsValidesJusquau" | "derniereJournee"
  >,
): boolean {
  return (
    c.vigilanceExigible !== false &&
    !c.attestationsValidesJusquau.some((fin) => fin >= c.derniereJournee)
  );
}

export function gardeVirementMission(
  c: ContexteVirementMission,
  p: ParametresArgentFormateurs = PARAMETRES_ARGENT_FORMATEURS,
): VerdictVirementMission {
  const motifs: MotifSuspensionVirement[] = [];
  if (c.finPourDeces) motifs.push("reglement_a_la_main");
  if (attenteAttestationALaMission(c)) motifs.push("attestation_urssaf_echue_a_la_mission");
  if (c.demandeIbanEnAttente) motifs.push("compte_bancaire_a_valider");
  if (c.dernierChangementIban) {
    const des = nouvelIbanUtilisableDes(c.dernierChangementIban, p);
    if (des !== null && c.maintenant.getTime() < des.getTime())
      motifs.push("nouvel_iban_moins_de_48h");
  }
  if (c.ibanEmpreinteActuelle === null) motifs.push("iban_absent");
  else if (c.ibanEmpreinteAffichee !== c.ibanEmpreinteActuelle)
    motifs.push("iban_change_depuis_l_affichage");
  return {
    autorise: motifs.length === 0,
    motifs,
    retard: retardDePaiement(
      { totalTtcCents: c.totalTtcCents, echeance: c.echeance, payeLe: c.aujourdhui },
      p,
    ),
  };
}

/** Les quatre derniers caractères d'un IBAN, sans espace, en majuscules (jamais plus). */
export function ibanFin4(ibanClair: string): string {
  const n = ibanClair.replace(/\s+/g, "").toUpperCase();
  if (n.length < 4) throw new Error("IBAN trop court");
  return n.slice(-4);
}
