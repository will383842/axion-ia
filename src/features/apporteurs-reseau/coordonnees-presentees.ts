/**
 * Coordonnées d'une personne PRÉSENTÉE (un tiers) pour la console : e-mail et téléphone ne sont
 * montrés qu'aux rôles qui ouvrent le dossier d'un apporteur (`peutOuvrirDossierApporteur`),
 * comme sur la fiche ; un compte de consultation voit un libellé neutre.
 */

export const COORDONNEES_MASQUEES = "Réservé aux rôles autorisés";

export function coordonneesAffichables(
  p: { personneEmail: string; personneTelephone: string | null },
  voitPii: boolean,
): string {
  if (!voitPii) return COORDONNEES_MASQUEES;
  return `${p.personneEmail}${p.personneTelephone ? ` · ${p.personneTelephone}` : ""}`;
}
