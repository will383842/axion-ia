/**
 * Règle des sections en échec du guide pilier (lot L8a). Une section vide n'est plus repérée
 * par le détecteur de la doctrine : la règle est donc explicite. Dès qu'une section a échoué,
 * le guide est plafonné sous le seuil de qualité et forcé en tier_3 (relecture), comme avant
 * quand le texte « indisponible » le bloquait. Fichier sans dépendance, testable seul.
 */
export function appliquerEchecsSections(
  qualityScore: number,
  sectionFailures: number,
  seuilQualite: number,
): { qualityScore: number; forcerRelecture: boolean } {
  const penalise = Math.max(0, qualityScore - Math.min(50, sectionFailures * 10));
  if (sectionFailures > 0) {
    return { qualityScore: Math.min(penalise, seuilQualite - 1), forcerRelecture: true };
  }
  return { qualityScore: penalise, forcerRelecture: false };
}
