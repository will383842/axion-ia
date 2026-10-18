/**
 * Chapitres d'une vidéo du site : règle unique partagée par le contrat de réception,
 * le JSON-LD (`Clip`) et le lecteur. Pure, sans dépendance (le lecteur est une île
 * cliente : il ne doit rien embarquer d'autre).
 */
export const SEUIL_CHAPITRES_SECONDES = 30;

export interface ChapitreVideo {
  readonly titre: string;
  readonly debutSecondes: number;
}

/** Les chapitres ne s'affichent (et ne s'annoncent à Google) qu'à partir de 30 s et de 2 chapitres. */
export function chapitresAffichables(
  dureeSecondes: number,
  chapitres: ReadonlyArray<ChapitreVideo> | undefined,
): ReadonlyArray<ChapitreVideo> {
  if (!chapitres || dureeSecondes < SEUIL_CHAPITRES_SECONDES || chapitres.length < 2) return [];
  return chapitres;
}

/** « 0:42 », « 12:05 ». */
export function horodatageLisible(secondes: number): string {
  return `${Math.floor(secondes / 60)}:${String(secondes % 60).padStart(2, "0")}`;
}
