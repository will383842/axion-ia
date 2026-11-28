/** Dates calendaires (UTC) du robot : chaînes `AAAA-MM-JJ` et colonnes `@db.Date`. */

/** Profondeur de l'historique Search Console (16 mois). */
export const MOIS_HISTORIQUE = 16;

export const REGEX_JOUR = /^\d{4}-\d{2}-\d{2}$/;

export function enDate(jour: string): Date {
  return new Date(`${jour}T00:00:00.000Z`);
}

export function enJour(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function ajouterJours(jour: string, n: number): string {
  const d = enDate(jour);
  d.setUTCDate(d.getUTCDate() + n);
  return enJour(d);
}

/** Même jour, `n` mois plus tôt (un 31 qui n'existe pas retombe sur le dernier jour du mois). */
export function reculerMois(jour: string, n: number): string {
  const d = enDate(jour);
  const jourDuMois = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - n);
  const dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(jourDuMois, dernier));
  return enJour(d);
}
