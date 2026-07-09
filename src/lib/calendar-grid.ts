// Util pur : grille mensuelle lundi→dimanche pour les vues calendrier admin.
// Neuf (n'altère pas CalendrierV2/Booking → 0 régression). Générique, sans
// dépendance domaine ni lib tierce.

/**
 * Construit la grille d'un mois (semaines lundi→dimanche).
 * @param year  année (ex 2026)
 * @param month mois 1-12
 * @returns tableau de `Date | null` (null = case de remplissage avant le 1er /
 *          après le dernier jour), longueur multiple de 7. Les `Date` sont à
 *          minuit UTC du jour concerné (usage : extraire year/month/day, pas
 *          l'heure).
 */
export function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // getUTCDay : 0=dimanche…6=samedi → on décale pour lundi=0.
  const firstWeekday = (first.getUTCDay() + 6) % 7;

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(Date.UTC(year, month - 1, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/**
 * Clé jour « YYYY-MM-DD » d'une date, calculée en **Europe/Paris** (jamais UTC
 * — sinon décalage d'un jour à minuit). Sert de clé de regroupement calendrier.
 */
export function dayKeyInParis(date: Date): string {
  // "en-CA" formate en YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Clé jour d'une `Date` de la grille (déjà à minuit UTC → composants UTC). */
export function dayKeyOfGridDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Heure « HH:MM » Europe/Paris (pour l'affichage d'un créneau). */
export function timeInParis(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
