/**
 * Le fichier d'AGENDA (.ics) joint à la convocation d'un formateur indépendant
 * (lot C, M19, côté formateur) : un événement par journée de la session, à
 * l'heure de Paris, avec un identifiant stable (un second envoi met à jour
 * l'événement au lieu d'en créer un autre).
 *
 * Module pur : aucune base, aucun réseau. Les échappements et le pliage RFC 5545
 * sont ceux de l'export du planning (`features/admin-planning/ics.ts`).
 */

import { escapeIcsText, foldIcsLine, formatUtcStamp } from "@/features/admin-planning/ics";

const CRLF = "\r\n";

/** Un instant UTC pour « jour civil + HH:MM, heure de Paris » (changement d'heure compris). */
export function parisVersUtc(jourIso: string, hhmm: string): Date | null {
  const j = /^(\d{4})-(\d{2})-(\d{2})$/.exec(jourIso);
  const h = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (j === null || h === null) return null;
  const naif = Date.UTC(Number(j[1]), Number(j[2]) - 1, Number(j[3]), Number(h[1]), Number(h[2]));
  const heureParis = (t: number): number => {
    const p = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Paris",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date(t));
    const v = (type: string) => Number(p.find((x) => x.type === type)?.value ?? "0");
    return Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"));
  };
  // Écart Paris - UTC à cet instant ; une seconde passe règle les heures de bascule.
  let t = naif - (heureParis(naif) - naif);
  t = naif - (heureParis(t) - t);
  return new Date(t);
}

export interface EntreeAgenda {
  /** Identifiant stable de l'affectation (entre dans l'UID de chaque événement). */
  readonly affectationId: string;
  readonly titre: string;
  readonly lieu: string;
  readonly description: string;
  readonly jours: ReadonlyArray<{ date: Date; heureDebut: string; heureFin: string }>;
  readonly maintenant: Date;
}

/** Le calendrier, ou `null` quand aucune journée n'a d'horaire lisible. */
export function construireAgendaSession(e: EntreeAgenda): string | null {
  const stamp = formatUtcStamp(e.maintenant);
  const evenements: string[] = [];
  for (const j of e.jours) {
    const jour = j.date.toISOString().slice(0, 10);
    const debut = parisVersUtc(jour, j.heureDebut);
    const fin = parisVersUtc(jour, j.heureFin);
    if (debut === null || fin === null || fin.getTime() <= debut.getTime()) continue;
    evenements.push(
      "BEGIN:VEVENT",
      `UID:session-${e.affectationId}-${jour}@axion-ia.com`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${formatUtcStamp(debut)}`,
      `DTEND:${formatUtcStamp(fin)}`,
      `SUMMARY:${escapeIcsText(e.titre)}`,
      ...(e.lieu ? [`LOCATION:${escapeIcsText(e.lieu)}`] : []),
      `DESCRIPTION:${escapeIcsText(e.description)}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
    );
  }
  if (evenements.length === 0) return null;
  const lignes = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Axion-IA//Session Formateur//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...evenements,
    "END:VCALENDAR",
  ];
  return lignes.map(foldIcsLine).join(CRLF) + CRLF;
}
