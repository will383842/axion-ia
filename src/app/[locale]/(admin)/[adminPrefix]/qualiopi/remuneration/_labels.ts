/**
 * Libellés et formatage de la surface « rémunération ».
 *
 * Séparé des pages pour être TESTABLE : un motif d'anomalie ajouté au moteur et
 * oublié ici afficherait sa clé technique (`assiette_ca_absente`) à un
 * comptable. Le test d'exhaustivité rend cet oubli impossible.
 */

import type {
  MotifAnomalie,
  FeeLineStatut,
  StatementStatut,
} from "@/server/qualiopi/remuneration/run";
import type { CompensationModel, FeeLineNature } from "@/server/qualiopi/remuneration/calcul";

/** Montant en centimes → « 1 234,56 € ». Toujours 2 décimales : c'est de l'argent dû. */
export function euros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export const MOIS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
] as const;

/** Ce qu'un motif d'anomalie veut dire pour l'opérateur, et ce qu'il doit faire. */
export const LIBELLE_ANOMALIE: Record<MotifAnomalie, string> = {
  reference_prestation_invalide: "Prestation mal référencée",
  formateur_inconnu: "Formateur introuvable",
  bareme_absent: "Aucun barème ni tarif de repli",
  heures_absentes: "Heures animées non renseignées",
  assiette_ca_absente: "Commission sur un CA nul",
  regime_tva_absent: "Régime de TVA non renseigné",
};

/**
 * Le `motif` d'une ligne est une colonne texte : la base peut contenir un motif
 * écrit par une version antérieure du moteur. On retombe sur la clé brute plutôt
 * que d'afficher un vide — un opérateur préfère un mot technique à rien.
 */
export function libelleAnomalie(motif: string): string {
  return LIBELLE_ANOMALIE[motif as MotifAnomalie] ?? motif;
}

export const LIBELLE_STATUT_RELEVE: Record<StatementStatut, string> = {
  brouillon: "Brouillon",
  a_valider: "À valider",
  valide: "Validé",
  facture_recue: "Facture reçue",
  paye: "Payé",
  annule: "Annulé",
};

type Ton = "neutral" | "info" | "success" | "warning" | "destructive" | "outline";

export const TON_STATUT_RELEVE: Record<StatementStatut, Ton> = {
  brouillon: "neutral",
  a_valider: "warning",
  valide: "info",
  facture_recue: "info",
  paye: "success",
  annule: "destructive",
};

export const LIBELLE_STATUT_LIGNE: Record<FeeLineStatut, string> = {
  previsionnel: "Prévisionnel",
  calcule: "Calculé",
  valide: "Figé",
  annule: "Annulé",
};

export const TON_STATUT_LIGNE: Record<FeeLineStatut, Ton> = {
  previsionnel: "outline",
  calcule: "info",
  valide: "success",
  annule: "neutral",
};

export const LIBELLE_MODELE: Record<CompensationModel, string> = {
  taux_journalier: "Taux journalier",
  taux_horaire: "Taux horaire",
  commission_ca_pct: "Commission sur CA",
  forfait_prestation: "Forfait",
};

export const LIBELLE_NATURE: Record<FeeLineNature, string> = {
  analytique: "Analytique (coût salarié)",
  honoraire_du: "Honoraires dus",
};
