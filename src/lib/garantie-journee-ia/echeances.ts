/**
 * Échéances de la garantie de la Journée IA (art. 47.10 des CGV). Fonctions pures,
 * dates en jours civils « AAAA-MM-JJ » (Paris). Rien n'est écrit en base : tout se recalcule.
 */
import { ajouterJours, ajouterJoursOuvres } from "@/lib/jours-ouvres";

// À remplacer par l'import de journee-ia-commun.ts quand la PR #2252 sera fusionnée.
export const DELAI_RAPPORT_JOURS_OUVRES = 10;
/** Le client demande le remboursement par écrit dans les 30 jours suivant la remise du rapport. */
export const DELAI_DEMANDE_JOURS = 30;
/** Axion-IA répond par écrit dans les 15 jours, sinon la demande est réputée acceptée. */
export const DELAI_REPONSE_JOURS = 15;
/** Virement dans les 30 jours suivant l'acceptation. */
export const DELAI_VIREMENT_JOURS = 30;

export type TypeEcheance = "rapport" | "fin_demande" | "reponse" | "virement";

export interface DonneesGarantie {
  dateJournee: string;
  rapportRemisLe?: string | null;
  demandeRecueLe?: string | null;
  decision?: "remboursement" | "refus" | "non_applicable" | null;
  decisionLe?: string | null;
  virementLe?: string | null;
}

export interface Echeance {
  type: TypeEcheance;
  date: string;
  faite: boolean;
  libelle: string;
}

/** Date limite de réponse d'Axion-IA, ou null sans demande reçue. */
function echeanceReponse(d: DonneesGarantie): string | null {
  return d.demandeRecueLe ? ajouterJours(d.demandeRecueLe, DELAI_REPONSE_JOURS) : null;
}

/**
 * Demande réputée acceptée : demande reçue, aucune décision datée, échéance de réponse
 * dépassée (strictement). État CALCULÉ, jamais écrit en base.
 */
export function estReputeeAcceptee(d: DonneesGarantie, aujourdhui: string): boolean {
  const limite = echeanceReponse(d);
  return limite !== null && !d.decisionLe && aujourdhui > limite;
}

/**
 * Échéances triées par date. `aujourdhui` (optionnel, « AAAA-MM-JJ ») ne sert qu'au virement
 * d'une demande réputée acceptée : sans lui, ce virement n'est pas annoncé.
 */
export function calculerEcheances(d: DonneesGarantie, aujourdhui?: string): Echeance[] {
  const r: Echeance[] = [
    {
      type: "rapport",
      date: ajouterJoursOuvres(d.dateJournee, DELAI_RAPPORT_JOURS_OUVRES),
      faite: Boolean(d.rapportRemisLe),
      libelle: "Remise du rapport",
    },
  ];
  if (d.rapportRemisLe) {
    r.push({
      type: "fin_demande",
      date: ajouterJours(d.rapportRemisLe, DELAI_DEMANDE_JOURS),
      faite: Boolean(d.demandeRecueLe || d.decision),
      libelle: "Fin du délai de demande de remboursement",
    });
  }
  const reponse = echeanceReponse(d);
  if (reponse) {
    r.push({
      type: "reponse",
      date: reponse,
      faite: Boolean(d.decisionLe),
      libelle: "Réponse écrite d'Axion-IA",
    });
  }
  let virement: string | null = null;
  if (d.decision === "remboursement" && d.decisionLe) {
    virement = ajouterJours(d.decisionLe, DELAI_VIREMENT_JOURS);
  } else if (reponse && !d.decisionLe && aujourdhui && estReputeeAcceptee(d, aujourdhui)) {
    virement = ajouterJours(reponse, DELAI_VIREMENT_JOURS);
  }
  if (virement) {
    r.push({
      type: "virement",
      date: virement,
      faite: Boolean(d.virementLe),
      libelle: "Virement du remboursement",
    });
  }
  return r.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
