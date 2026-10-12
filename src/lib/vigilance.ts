/**
 * Attestation de vigilance URSSAF — valeurs COMMUNES à tous les tiers payés par Axion-IA
 * qui doivent la fournir (apporteurs d'affaires, formateurs indépendants) ; FAC-5. Module pur.
 *
 * Seuil légal (art. L.8222-1, D.8222-5) : 5 000 € de cumul. L'APPROCHE est le moment où on la
 * DEMANDE ; le SEUIL est celui où on l'EXIGE (ce qui doit être payé attend tant qu'elle manque).
 * Les deux nombres vivent ICI et nulle part ailleurs (lot G1, décision du 12/10).
 */

export const VIGILANCE_VALIDITE_MOIS = 6;

/** Seuil de vigilance : 5 000 €, en centimes. */
export const SEUIL_VIGILANCE_CENTS = 500_000;
/** Approche du seuil : 4 000 €, en centimes. On demande l'attestation dès ce cumul. */
export const APPROCHE_VIGILANCE_CENTS = 400_000;

/**
 * À partir du cumul déjà dû et d'une nouvelle somme : faut-il DEMANDER l'attestation, et la
 * nouvelle somme doit-elle ATTENDRE ? Bornes incluses. Pièces valides : rien à faire.
 */
export function etatSeuilVigilance(e: {
  cumulCents: number;
  nouvelleCents: number;
  piecesValides: boolean;
}): { demander: boolean; attendre: boolean } {
  const apres = e.cumulCents + e.nouvelleCents;
  if (e.piecesValides) return { demander: false, attendre: false };
  return {
    demander: apres >= APPROCHE_VIGILANCE_CENTS,
    attendre: apres >= SEUIL_VIGILANCE_CENTS,
  };
}

/** « 5 000 € » — pour les textes, depuis la constante, jamais recopié. */
export const SEUIL_VIGILANCE_LIBELLE = `${(SEUIL_VIGILANCE_CENTS / 100).toLocaleString("fr-FR")} €`;

/** Ce que disent les écrans d'une attestation des formateurs qui n'est pas (encore) exigée. */
export const LIBELLE_ATTESTATION_PLUS_TARD = `demandée plus tard, à partir de ${SEUIL_VIGILANCE_LIBELLE} d'honoraires`;
