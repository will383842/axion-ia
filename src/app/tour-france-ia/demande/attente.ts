// Tour France IA : la durée minimale de chaque réponse (réussite, champs invalides, limite atteinte) (anti-oracle).
//
// Une adresse déjà connue prend un autre chemin en base qu'une adresse neuve, donc un autre temps.
// L'action attend jusqu'à `DUREE_MINIMALE_MS` depuis son début avant de rediriger : la réponse a la
// même forme ET le même délai, que l'adresse soit connue ou non. Module à part : un fichier
// `"use server"` ne peut exporter que des fonctions asynchrones, et les tests y injectent l'attente.

export const DUREE_MINIMALE_MS = 800;

/** Attend ce qu'il reste de `DUREE_MINIMALE_MS` depuis `debut` (`Date.now()` au début du traitement). */
export async function attendreDureeMinimale(debut: number): Promise<void> {
  const reste = DUREE_MINIMALE_MS - (Date.now() - debut);
  if (reste > 0) await new Promise<void>((fin) => setTimeout(fin, reste));
}
