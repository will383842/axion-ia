// PR N (#2464 pt 6) : l'étape « purge-rgpd » du passage quotidien. Son propre fichier (plan § 0.5).
// Le 1er du mois (jour de Paris), et seulement si `APPORTEURS_PURGE_RGPD` vaut « essai » ou « appliquer ».
import { modePurgeRgpd, purgerDonneesApporteurs } from "./purge-rgpd";

/** Le jour du mois à Paris. */
export function jourDuMoisParis(d: Date): number {
  return Number(
    new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric" }).format(d),
  );
}

export async function etapePurgeRgpd(maintenant: Date): Promise<void> {
  const mode = modePurgeRgpd();
  if (!mode) return;
  if (jourDuMoisParis(maintenant) !== 1) return;
  await purgerDonneesApporteurs(maintenant, mode);
}
