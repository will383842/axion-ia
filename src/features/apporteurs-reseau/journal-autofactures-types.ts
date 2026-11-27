/**
 * Journal des autofactures (point 25) — la ligne commune au CSV, au FEC et à la page.
 * Aucune donnée personnelle de personne physique au-delà de la dénomination et du SIREN
 * déjà portés par la pièce.
 */
export interface LigneJournal {
  numero: string;
  genre: "facture" | "avoir";
  emiseAt: Date;
  /** Avoir : numéro de l'autofacture rectifiée. */
  factureRectifiee: string | null;
  denomination: string | null;
  siren: string | null;
  regimeTva: "franchise_293b" | "assujetti";
  numeroTva: string | null;
  /** `null` : totaux absents (pièce reprise de la migration). */
  totalHtCents: number | null;
  totalTvaCents: number | null;
  totalTtcCents: number | null;
  origine: string;
  /** Instants des « Virement fait » rattachés à la pièce. */
  viree: readonly Date[];
}

/** Une pièce dont un total manque : le CSV la marque, le FEC refuse. */
export function totauxAbsents(l: LigneJournal): boolean {
  return l.totalHtCents === null || l.totalTvaCents === null || l.totalTtcCents === null;
}

/** « AAAA-MM-JJ » : un jour de Paris saisi dans un filtre. */
export const JOUR = /^\d{4}-\d{2}-\d{2}$/;
