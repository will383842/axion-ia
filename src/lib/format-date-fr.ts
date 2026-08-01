/**
 * Format date FR — helper transverse de la console admin.
 *
 * Créé le 2026-05-14 (Fix P2-5 audit opérationnel), déplacé de la zone
 * génération de contenu vers src/lib le 2026-08-01 : consommé par toute la
 * console (audit UX — dates ISO brutes partout), il ne pouvait plus vivre
 * derrière la frontière d'isolation (§ 4.1bis).
 *
 * Affiche les timestamps admin en français Europe/Paris au lieu de
 * `.toISOString()` (UTC, peu lisible).
 */

const FORMATTER_FR = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const FORMATTER_FR_DATE = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * "14/05/2026 16:23" — utilisable côté admin pour timestamps.
 * Renvoie "—" si null/undefined.
 */
export function formatDateFr(d: Date | string | null | undefined): string {
  if (d === null || d === undefined) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return FORMATTER_FR.format(date);
}

/**
 * "14/05/2026" — sans heure.
 */
export function formatDateFrShort(d: Date | string | null | undefined): string {
  if (d === null || d === undefined) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return FORMATTER_FR_DATE.format(date);
}

/**
 * "il y a 2 j" / "il y a 3 h" / "à l'instant".
 */
export function formatDateRelativeFr(d: Date | string | null | undefined): string {
  if (d === null || d === undefined) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 30) return "à l'instant";
  if (sec < 60) return `il y a ${sec} s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `il y a ${hr} h`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `il y a ${days} j`;
  const months = Math.floor(days / 30);
  if (months < 12) return `il y a ${months} mois`;
  return formatDateFrShort(date);
}
