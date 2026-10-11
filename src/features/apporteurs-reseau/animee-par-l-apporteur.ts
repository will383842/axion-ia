// Réseau d'apporteurs — L12j (décision 74) : pas de commission d'apporteur sur une
// formation que l'apporteur anime LUI-MÊME (formateur principal ou co-formateur).
//
// Prédicat PUR, livré éteint : le calcul des commissions (`commissions.ts`) ne
// l'appelle pas encore. Branché, il mettra la ligne de commission à 0 avec le
// motif `animee_par_l_apporteur` (table `commissions_motif_nul`) — jamais de
// suppression, jamais d'absence : la trace dit pourquoi. Les honoraires du
// formateur restent dus.

/** Les 9 premiers chiffres d'un SIRET (ou un SIREN), sinon `null`. */
export function sirenDe(siretOuSiren: string | null | undefined): string | null {
  const c = (siretOuSiren ?? "").replace(/\s+/g, "");
  return /^\d{9}(\d{5})?$/.test(c) ? c.slice(0, 9) : null;
}

/**
 * Vrai si l'entreprise de l'apporteur est aussi celle d'un formateur de la
 * session (même SIREN). Un SIREN inconnu ne prouve rien : faux.
 */
export function animeeParLApporteur(
  siretsFormateursDeLaSession: ReadonlyArray<string | null | undefined>,
  sirenApporteur: string | null | undefined,
): boolean {
  const a = sirenDe(sirenApporteur);
  if (a === null) return false;
  return siretsFormateursDeLaSession.some((s) => sirenDe(s) === a);
}
