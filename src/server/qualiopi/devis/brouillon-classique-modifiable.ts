/**
 * Un brouillon de devis CLASSIQUE peut-il être corrigé dans l'écran `/corriger` ?
 *
 * Devis classique = `offre === null && offreSha256 === null`. Un brouillon classique peut porter
 * un mode de règlement par un tiers (`financementSuggere`) et son estimation
 * (`montantOpcoEstimeCents`), posés par l'assistant. Le formulaire de correction ne les envoie
 * pas, et l'action de modification remet ces champs à null : ils seraient effacés sans retour
 * possible (ils ne sont pas reconstructibles). Un tel brouillon n'est donc pas modifiable ici.
 */

interface ChampsBrouillon {
  statut: string;
  offre: unknown;
  offreSha256: string | null | undefined;
  financementSuggere: unknown;
  montantOpcoEstimeCents: number | null | undefined;
}

export const MSG_BROUILLON_REGLEMENT_TIERS =
  "Ce brouillon porte un règlement par un tiers et son estimation : il ne peut pas être modifié dans cet écran, car ces informations seraient effacées.";

export function porteUnReglementParUnTiers(d: {
  financementSuggere: unknown;
  montantOpcoEstimeCents: number | null | undefined;
}): boolean {
  return (
    (d.financementSuggere !== null && d.financementSuggere !== undefined) ||
    (d.montantOpcoEstimeCents !== null && d.montantOpcoEstimeCents !== undefined)
  );
}

/** Lien « Modifier le brouillon » (écran `/corriger`) : brouillon classique sans règlement tiers. */
export function peutCorrigerBrouillonClassique(d: ChampsBrouillon): boolean {
  return (
    d.statut === "brouillon" &&
    (d.offre === null || d.offre === undefined) &&
    (d.offreSha256 === null || d.offreSha256 === undefined) &&
    !porteUnReglementParUnTiers(d)
  );
}
