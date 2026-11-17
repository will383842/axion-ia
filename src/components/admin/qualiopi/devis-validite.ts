/**
 * Aides d'affichage de la validité d'un devis (fiche devis admin).
 * Fonctions pures : testables sans rendre la page.
 */

/** Date au format JJ/MM/AAAA, toujours en heure de Paris (le serveur tourne en UTC). */
export function formatDateParis(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(date);
}

/**
 * Le champ de modification de la validité n'est pas proposé pour un ancien devis classique
 * qui porte une estimation de financement OPCO : l'action serveur le refuse.
 */
export function validiteBrouillonModifiable(devis: {
  statut: string;
  offreSha256: string | null;
  financementSuggere: string | null;
  montantOpcoEstimeCents: number | null;
}): boolean {
  if (devis.statut !== "brouillon") return false;
  const ancienClassiqueAvecEstimationOpco =
    devis.offreSha256 === null &&
    devis.financementSuggere === "opco" &&
    devis.montantOpcoEstimeCents != null;
  return !ancienClassiqueAvecEstimationOpco;
}
