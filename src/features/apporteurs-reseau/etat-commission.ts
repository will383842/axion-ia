/**
 * Réseau d'apporteurs — l'ÉTAT d'une commission tel que l'apporteur le lit (page « Mes
 * commissions », lecture seule). Module PUR : aucune importation serveur, aucune base.
 *
 * Il ne calcule JAMAIS un montant ni une règle : il classe une ligne déjà écrite en base
 * (`commissions_apporteur`) dans un état à afficher. Aucune condition « prestation réalisée »
 * n'y figure : la commission est due dès que le client a payé 100 % (règle de la direction) ; le
 * champ `prestationRealiseeAt` n'est donc volontairement pas lu.
 *
 * Ordre de l'état principal (le premier qui s'applique) : voir `etatPrincipal`.
 */

export type StatutLigne =
  "a_qualifier" | "due" | "en_attente_vigilance" | "versee" | "reprise" | "annulee" | "retenue";

/** Les colonnes — et seulement elles — dont l'état dépend. */
export interface LigneEtat {
  statut: StatutLigne;
  montantCents: number | null;
  releveMois: string | null;
  autofactureNumero: string | null;
  autofactureAttenteMotif: string | null;
  litigeDepuis: Date | null;
  activite: string;
}

/** Préfixe du motif d'attente « une reprise reste à déduire » (copie de celui de `facturation.ts`, verrouillée par un test : ce module reste pur). */
export const PREFIXE_MOTIF_SOLDE_NEGATIF = "solde négatif :";

export interface FacettesCommission {
  statut: StatutLigne;
  /** Contestation écrite du client en cours, sur un statut suspendable. */
  suspendue: boolean;
  facturee: boolean;
  attenteFiche: null | "solde_negatif" | "donnee_manquante";
  neutralisation: boolean;
  reprise: null | "a_deduire" | "deduite";
}

const SUSPENDABLES: ReadonlySet<StatutLigne> = new Set([
  "a_qualifier",
  "due",
  "en_attente_vigilance",
]);

export function facettesCommission(l: LigneEtat): FacettesCommission {
  return {
    statut: l.statut,
    suspendue: l.litigeDepuis !== null && SUSPENDABLES.has(l.statut),
    facturee: l.autofactureNumero !== null,
    attenteFiche:
      l.statut === "due" && l.autofactureAttenteMotif
        ? l.autofactureAttenteMotif.startsWith(PREFIXE_MOTIF_SOLDE_NEGATIF)
          ? "solde_negatif"
          : "donnee_manquante"
        : null,
    neutralisation: l.statut === "reprise" && l.activite === "neutralisation",
    reprise: l.statut === "reprise" ? (l.releveMois ? "deduite" : "a_deduire") : null,
  };
}

export type EtatPrincipal =
  | "masquee"
  | "annulee"
  | "retenue"
  | "reprise_a_deduire"
  | "reprise_deduite"
  | "sans_commission"
  | "versee"
  | "suspendue"
  | "facturee"
  | "a_preciser"
  | "en_attente_pieces"
  | "en_attente_fiche_solde_negatif"
  | "en_attente_fiche"
  | "due";

/** Un seul état par ligne, dans l'ordre du plan (§1.3), sans le rang « prestation réalisée ». */
export function etatPrincipal(f: FacettesCommission, montantCents: number | null): EtatPrincipal {
  if (f.neutralisation) return "masquee";
  if (f.statut === "annulee") return "annulee";
  if (f.statut === "retenue") return "retenue";
  if (f.reprise === "a_deduire") return "reprise_a_deduire";
  if (f.reprise === "deduite") return "reprise_deduite";
  if (f.statut === "versee") return montantCents === 0 ? "sans_commission" : "versee";
  if (f.suspendue) return "suspendue";
  if (f.statut === "due" && f.facturee) return "facturee";
  if (f.statut === "a_qualifier") return "a_preciser";
  if (f.statut === "en_attente_vigilance") return "en_attente_pieces";
  if (f.attenteFiche === "solde_negatif") return "en_attente_fiche_solde_negatif";
  if (f.attenteFiche === "donnee_manquante") return "en_attente_fiche";
  return "due";
}
