/**
 * Dates de validité d'un devis : calculs de jour civil en heure de Paris (le serveur tourne en UTC).
 * Module pur, sans `"use server"` : partagé par la fixation de la validité d'un brouillon et par la
 * prolongation de validité d'un devis envoyé ou expiré.
 */

export const JOUR_MS = 86_400_000;

/** Jour civil (heure de Paris) de `maintenant`, en millisecondes UTC à minuit. */
export function minuitParisUtc(maintenant: Date): number {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(maintenant);
  const [y, mo, d] = p.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, mo - 1, d);
}

/** Décalage de Paris par rapport à UTC (ms) à l'instant `t`. */
export function decalageParisMs(t: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(t));
  const g = (k: string) => Number(parts.find((x) => x.type === k)?.value);
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - t;
}

/** Instant UTC de 23 h 59 min 59 s, HEURE DE PARIS, du jour civil `y-mo-d`. */
export function finDeJourneeParis(y: number, mo: number, d: number): Date {
  const naif = Date.UTC(y, mo - 1, d, 23, 59, 59);
  return new Date(naif - decalageParisMs(naif - decalageParisMs(naif)));
}

/** Lit un jour `AAAA-MM-JJ` ; rend `null` si le format est faux ou si la date n'existe pas. */
export function lireJourIso(s: string): { y: number; mo: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const verif = new Date(Date.UTC(y, mo - 1, d));
  if (verif.getUTCFullYear() !== y || verif.getUTCMonth() !== mo - 1 || verif.getUTCDate() !== d) {
    return null;
  }
  return { y, mo, d };
}
