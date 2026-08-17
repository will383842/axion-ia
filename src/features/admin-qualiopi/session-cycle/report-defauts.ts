/**
 * Les valeurs par défaut du panneau de report — module PUR.
 *
 * 🔴 Le défaut : les deux champs `datetime-local` s'ouvraient **vides**. Or on
 * reporte presque toujours une journée entière, et l'utilisateur devait saisir
 * quatre fois la même information (date + heure, début + fin) au clavier, dans
 * un widget natif peu commode. Le formulaire ne pardonnait rien : oublier
 * l'heure de fin faisait échouer l'envoi après coup.
 *
 * ⚠️ On pré-remplit une PROPOSITION, jamais une décision : les deux champs
 * restent modifiables et obligatoires côté serveur. Un défaut qui ne se corrige
 * pas serait pire que pas de défaut.
 */

/** Horaires d'une journée de formation standard. */
export const HEURE_DEBUT = 9;
export const HEURE_FIN = 17;

/**
 * Formate une date au format attendu par `<input type="datetime-local">`.
 *
 * ⚠️ `toISOString()` ne convient PAS : il convertit en UTC. Un report proposé à
 * 09:00 heure de Paris s'afficherait « 07:00 » en été — l'utilisateur
 * corrigerait à la main une valeur que le code croyait juste. On formate donc
 * sur les composantes LOCALES, celles que le champ attend.
 */
export function pourChampDateHeure(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * La proposition de report : le lendemain, 09:00 → 17:00.
 *
 * Le lendemain plutôt qu'aujourd'hui : on ne reporte pas une session au jour
 * même — si c'était le cas, la date d'origine conviendrait encore.
 */
export function datesParDefautReport(maintenant: Date): {
  readonly debut: string;
  readonly fin: string;
} {
  const jour = new Date(maintenant);
  jour.setDate(jour.getDate() + 1);
  const debut = new Date(jour);
  debut.setHours(HEURE_DEBUT, 0, 0, 0);
  const fin = new Date(jour);
  fin.setHours(HEURE_FIN, 0, 0, 0);
  return { debut: pourChampDateHeure(debut), fin: pourChampDateHeure(fin) };
}
