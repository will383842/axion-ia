// Planning unifié — expansion pure d'un événement sur les jours qu'il couvre.
//
// Une formation collective s'étale sur plusieurs jours (dateDebut → dateFin) :
// elle doit apparaître sur CHAQUE case du calendrier qu'elle traverse, pas
// seulement le premier jour.
//
// Toute l'arithmétique se fait sur des clés « YYYY-MM-DD » calculées en
// Europe/Paris, puis avancées en arithmétique calendaire UTC. On évite ainsi
// tout décalage lié au passage à l'heure d'été (un jour parisien peut durer 23
// ou 25 h : ajouter « 24 h » à une Date serait faux).

import { dayKeyInParis } from "@/lib/calendar-grid";

/** Garde-fou : une prestation ne peut pas couvrir plus de 62 jours de calendrier. */
export const MAX_EVENT_DAYS = 62;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Jour calendaire suivant une clé « YYYY-MM-DD » (arithmétique UTC, sans DST). */
export function nextDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map((s) => Number.parseInt(s, 10));
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + 1));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/**
 * Clés jour « YYYY-MM-DD » (Europe/Paris) couvertes par un événement, bornes
 * incluses.
 *
 * - `fin` null → un seul jour (événement « journée entière »).
 * - `fin` antérieure à `debut` (donnée incohérente) → un seul jour, sans throw.
 * - au-delà de `maxDays`, la liste est tronquée (garde-fou anti-boucle).
 *
 * Les clés « YYYY-MM-DD » se comparent lexicographiquement dans l'ordre
 * chronologique — d'où les comparaisons de chaînes.
 */
export function expandEventDayKeys(
  debut: Date,
  fin: Date | null,
  maxDays: number = MAX_EVENT_DAYS,
): string[] {
  const startKey = dayKeyInParis(debut);
  const endKey = fin !== null ? dayKeyInParis(fin) : startKey;
  if (endKey <= startKey) return [startKey];

  const keys: string[] = [];
  let cur = startKey;
  for (let i = 0; i < maxDays; i += 1) {
    keys.push(cur);
    if (cur === endKey) return keys;
    cur = nextDayKey(cur);
  }
  return keys;
}
