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
  decision?: "remboursement" | "refus" | "avoir" | null;
  decisionLe?: string | null;
  virementLe?: string | null;
}

export interface Echeance {
  type: TypeEcheance;
  date: string;
  faite: boolean;
  libelle: string;
  /** Porté par l'échéance « fin_demande » : demande reçue après la fin du délai (affichage seulement). */
  demandeHorsDelai?: boolean;
  /**
   * Porté par l'échéance « reponse » d'une demande hors délai : ce n'est pas une obligation
   * datée (pas d'acceptation tacite), le dirigeant tranche au cas par cas ; `date` n'est qu'indicative.
   */
  aTrancher?: boolean;
}

/**
 * Demande reçue après la fin du délai de demande (remise du rapport + 30 jours). Décision du
 * dirigeant (25/11/2026) : elle se traite au cas par cas (rembourser, refuser ou offrir un avoir),
 * sans acceptation tacite ni virement automatique.
 */
export function demandeHorsDelai(d: DonneesGarantie): boolean {
  if (!d.rapportRemisLe || !d.demandeRecueLe) return false;
  return d.demandeRecueLe > ajouterJours(d.rapportRemisLe, DELAI_DEMANDE_JOURS);
}

/** Date limite de réponse d'Axion-IA, ou null sans demande reçue. */
function echeanceReponse(d: DonneesGarantie): string | null {
  return d.demandeRecueLe ? ajouterJours(d.demandeRecueLe, DELAI_REPONSE_JOURS) : null;
}

/**
 * Demande réputée acceptée (art. 47.10 f) : demande reçue et aucune réponse dans le délai.
 * Sans décision datée, l'échéance de réponse doit être dépassée (strictement) à `aujourdhui` ;
 * avec une décision datée, elle doit être postérieure à l'échéance (réponse tardive).
 * Toujours faux pour une demande hors délai (cas par cas). État CALCULÉ, jamais écrit en base.
 */
export function estReputeeAcceptee(d: DonneesGarantie, aujourdhui: string): boolean {
  if (demandeHorsDelai(d)) return false;
  const limite = echeanceReponse(d);
  return limite !== null && (d.decisionLe ? d.decisionLe > limite : aujourdhui > limite);
}

/**
 * Échéances triées par date. `aujourdhui` (optionnel, « AAAA-MM-JJ ») ne sert qu'au virement
 * d'une demande réputée acceptée sans réponse : sans lui, ce virement n'est pas annoncé.
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
      demandeHorsDelai: demandeHorsDelai(d),
    });
  }
  const reponse = echeanceReponse(d);
  const horsDelai = demandeHorsDelai(d);
  if (reponse) {
    r.push(
      horsDelai
        ? {
            type: "reponse",
            date: reponse,
            faite: Boolean(d.decisionLe),
            libelle: "Réponse d'Axion-IA : à trancher (demande hors délai, cas par cas)",
            aTrancher: true,
          }
        : {
            type: "reponse",
            date: reponse,
            faite: Boolean(d.decisionLe && d.decisionLe <= reponse),
            libelle: "Réponse écrite d'Axion-IA",
          },
    );
  }
  let virement: string | null = null;
  // Réponse absente ou tardive : acceptation tacite, virement = échéance de réponse + 30 j,
  // quelle que soit la décision. Une réponse tardive suffit, même sans `aujourdhui`.
  // Hors délai : jamais d'acceptation tacite (estReputeeAcceptee rend faux), virement seulement
  // si le dirigeant a décidé de rembourser.
  if (reponse && estReputeeAcceptee(d, aujourdhui ?? reponse)) {
    virement = ajouterJours(reponse, DELAI_VIREMENT_JOURS);
  } else if (d.decision === "remboursement" && d.decisionLe) {
    virement = ajouterJours(d.decisionLe, DELAI_VIREMENT_JOURS);
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
