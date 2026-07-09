// Planning unifié — export iCalendar (.ics) de l'agenda d'un formateur.
//
// OBJECTIF : permettre à un formateur d'ABONNER son agenda perso (Google
// Agenda / Outlook / Apple) au planning de ses prestations Axion-IA, via un
// flux .ics en lecture seule. Un ré-import (re-synchro) doit METTRE À JOUR les
// événements existants, jamais en créer des doublons — d'où des `UID` stables
// et déterministes (cf. `icsUid`).
//
// Ce module est VOLONTAIREMENT distinct de `src/lib/ics-generator.ts` (spécifique
// au « cadrage » booking, un VEVENT unique method=PUBLISH). Ici on émet un
// calendrier COMPLET (N événements) à partir du type pivot `PlanningEvent`, sans
// toucher au générateur booking pour éviter toute régression.
//
// Conformité RFC 5545 (iCalendar) traitée ici :
//   - échappement §3.3.11 (backslash, `;`, `,`, retour ligne → `\n`) ;
//   - pliage des lignes à 75 OCTETS §3.1 (piège : on compte les octets UTF-8,
//     pas les caractères — un « é » pèse 2 octets — et on ne coupe JAMAIS au
//     milieu d'un caractère multi-octet) ;
//   - DATE-TIME UTC `YYYYMMDDTHHMMSSZ` pour les créneaux horodatés ;
//   - `VALUE=DATE` (journée entière, jour Europe/Paris) quand la fin est
//     inconnue (`fin === null`).
//
// Fonctions PURES (aucun accès DB / réseau / horloge sauf `DTSTAMP`). Le lieu
// et l'horloge « maintenant » sont injectables pour des tests déterministes.

import { dayKeyInParis } from "@/lib/calendar-grid";
import { nextDayKey } from "./expand";
import { mobiliseLeFormateur } from "./conflicts";
import { PLANNING_STATUT_LABELS, PLANNING_TYPE_LABELS, type PlanningEvent } from "./types";

// RFC 5545 : les lignes sont terminées par CRLF, et pliées à 75 octets max.
const CRLF = "\r\n";
const OCTET_LIMIT = 75;

// Un seul encodeur réutilisé — mesurer la taille UTF-8 d'un caractère est le
// cœur du pliage correct (75 octets ≠ 75 caractères).
const ENCODER = new TextEncoder();

/** Taille en octets UTF-8 d'une chaîne (souvent un seul caractère au pliage). */
function byteLength(s: string): number {
  return ENCODER.encode(s).length;
}

/**
 * Échappement RFC 5545 §3.3.11 pour les propriétés TEXT (SUMMARY, DESCRIPTION,
 * LOCATION, noms…).
 *
 * L'ordre importe : le backslash est échappé EN PREMIER, sinon les backslashes
 * qu'on ajoute pour `;`/`,`/retour-ligne seraient re-doublés.
 */
export function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\n|\r/g, "\\n");
}

/**
 * Pliage d'UNE ligne de contenu (« content line ») à 75 octets (RFC 5545 §3.1).
 *
 * On accumule caractère par caractère (itération par POINT DE CODE via `for..of`,
 * qui respecte les paires de substitution) en comptant les octets UTF-8. Dès que
 * le prochain caractère ferait dépasser 75 octets sur la ligne physique courante,
 * on insère un « folding » = CRLF suivi d'UNE espace, et cette espace de tête
 * compte pour 1 octet dans le budget de la ligne de continuation.
 *
 * On ne coupe donc jamais au milieu d'un caractère multi-octet.
 */
export function foldIcsLine(line: string): string {
  const physical: string[] = [];
  let current = "";
  let currentBytes = 0;

  for (const ch of line) {
    const chBytes = byteLength(ch);
    if (currentBytes + chBytes > OCTET_LIMIT) {
      physical.push(current);
      // Ligne de continuation : l'espace de tête est comptée dans les 75 octets.
      current = ` ${ch}`;
      currentBytes = 1 + chBytes;
    } else {
      current += ch;
      currentBytes += chBytes;
    }
  }
  physical.push(current);
  return physical.join(CRLF);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** DATE-TIME UTC RFC 5545 : `YYYYMMDDTHHMMSSZ`. */
export function formatUtcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`
  );
}

/** DATE RFC 5545 : `YYYYMMDD` du jour Europe/Paris (pour les journées entières). */
function formatParisDate(d: Date): string {
  // `dayKeyInParis` renvoie « YYYY-MM-DD » calculé en Europe/Paris ; on retire
  // les tirets pour obtenir la forme DATE iCal.
  return dayKeyInParis(d).replace(/-/g, "");
}

/**
 * `UID` stable et déterministe d'un événement de planning.
 *
 * Forme `formation-<id>@axion-ia.com` / `coaching-<id>@axion-ia.com` : liée à
 * l'identité métier (type + id), PAS à un timestamp ni un aléa. C'est ce qui
 * garantit qu'une re-synchro met à jour l'événement existant côté Google/Outlook
 * au lieu d'en créer un second.
 */
export function icsUid(e: Pick<PlanningEvent, "type" | "id">): string {
  return `${e.type}-${e.id}@axion-ia.com`;
}

/** Description lisible : type, client, formateur, statut (une info par ligne). */
function buildDescription(e: PlanningEvent): string {
  const parts = [`Type : ${PLANNING_TYPE_LABELS[e.type]}`];
  if (e.clientNom !== null) parts.push(`Client : ${e.clientNom}`);
  if (e.formateurNom !== null) parts.push(`Formateur : ${e.formateurNom}`);
  parts.push(`Statut : ${PLANNING_STATUT_LABELS[e.statut]}`);
  // Retours ligne réels : `escapeIcsText` les convertira en `\n` littéraux.
  return parts.join("\n");
}

/**
 * Lignes brutes (non pliées) d'un VEVENT pour un événement de planning.
 *
 * - `fin === null` → journée entière : `DTSTART;VALUE=DATE` + `DTEND;VALUE=DATE`
 *   au lendemain (la borne DATE de fin est EXCLUSIVE en RFC 5545).
 * - sinon → créneau horodaté en UTC.
 */
function buildVeventLines(e: PlanningEvent, dtstamp: string): string[] {
  const lines: string[] = ["BEGIN:VEVENT", `UID:${icsUid(e)}`, `DTSTAMP:${dtstamp}`];

  if (e.fin === null) {
    const startDate = formatParisDate(e.debut);
    lines.push(`DTSTART;VALUE=DATE:${startDate}`);
    // Fin exclusive → jour suivant (via l'arithmétique calendaire de expand.ts).
    lines.push(`DTEND;VALUE=DATE:${nextDayKey(dayKeyInParis(e.debut)).replace(/-/g, "")}`);
  } else {
    lines.push(`DTSTART:${formatUtcStamp(e.debut)}`);
    lines.push(`DTEND:${formatUtcStamp(e.fin)}`);
  }

  lines.push(`SUMMARY:${escapeIcsText(e.titre)}`);
  lines.push(`DESCRIPTION:${escapeIcsText(buildDescription(e))}`);
  if (e.lieu !== null) lines.push(`LOCATION:${escapeIcsText(e.lieu)}`);
  lines.push("STATUS:CONFIRMED");
  lines.push("END:VEVENT");
  return lines;
}

export interface BuildPlanningIcsOptions {
  /** Horloge injectable pour `DTSTAMP` (tests déterministes). Défaut : maintenant. */
  now?: Date;
}

/**
 * Construit un VCALENDAR complet à partir d'une liste d'événements de planning.
 *
 * Règles :
 *   - les prestations qui ne mobilisent plus le formateur (annulée / reportée)
 *     sont EXCLUES — elles ne doivent pas polluer l'agenda perso ;
 *   - chaque événement restant devient un VEVENT avec un `UID` stable ;
 *   - toutes les lignes sont échappées puis pliées à 75 octets ;
 *   - le document est terminé par CRLF (RFC 5545).
 *
 * `nomCalendrier` alimente `X-WR-CALNAME` / `NAME` : le libellé affiché par le
 * client d'agenda pour le calendrier abonné.
 */
export function buildPlanningIcs(
  events: PlanningEvent[],
  nomCalendrier: string,
  options: BuildPlanningIcsOptions = {},
): string {
  const dtstamp = formatUtcStamp(options.now ?? new Date());
  const nom = escapeIcsText(nomCalendrier);

  const rawLines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Axion-IA//Planning Formateur//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    // X-WR-CALNAME : nom historique lu par Google/Apple ; NAME : équivalent RFC 7986.
    `X-WR-CALNAME:${nom}`,
    `NAME:${nom}`,
  ];

  for (const e of events) {
    // Une prestation annulée/reportée ne mobilise plus le formateur → hors agenda.
    if (!mobiliseLeFormateur(e)) continue;
    rawLines.push(...buildVeventLines(e, dtstamp));
  }

  rawLines.push("END:VCALENDAR");

  // Pliage de CHAQUE ligne, puis jointure CRLF + CRLF final.
  return rawLines.map(foldIcsLine).join(CRLF) + CRLF;
}
