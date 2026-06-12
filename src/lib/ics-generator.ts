// Générateur .ics minimal RFC 5545 (Sprint X.6 / Booking V1).
//
// Utilisé par les emails cadrage pour attacher un événement calendrier
// directement importable par Outlook / Apple Mail / Gmail / Thunderbird.
//
// Scope V1 : événement VEVENT simple. Pas de récurrence, pas d'attendees,
// pas de VTIMEZONE (on émet en UTC pour éviter les surprises tz).
//
// Référence RFC 5545 (iCalendar). Les chaînes doivent être CRLF-terminated
// et les longues lignes pliées à 75 octets (folding) — on simplifie ici en
// gardant les lignes courtes par construction.

export interface IcsEventInput {
  /** Identifiant unique global (UUID + domain). */
  uid: string;
  /** Date/heure début (Date JS — sera converti en UTC `YYYYMMDDTHHmmssZ`). */
  start: Date;
  /** Date/heure fin (idem UTC). */
  end: Date;
  /** Titre court de l'événement. */
  summary: string;
  /** Description (multi-lignes acceptées). */
  description?: string;
  /** URL ou lieu physique. Pour visio, mettre l'URL Meet/Whereby/Jitsi. */
  location?: string;
  /** Email organisateur (affiché dans le client). */
  organizerEmail?: string;
  /** Nom organisateur affiché. */
  organizerName?: string;
}

const CRLF = "\r\n";

function formatUtcStamp(d: Date): string {
  // RFC 5545 DATE-TIME UTC : YYYYMMDDTHHmmssZ
  const pad = (n: number, len = 2) => n.toString().padStart(len, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/**
 * Échappement RFC 5545 §3.3.11 :
 *   - backslash, semicolon, comma → précédés d'un backslash
 *   - newlines → littéral `\n`
 */
function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\n|\r/g, "\\n");
}

/**
 * Génère le contenu d'un fichier `.ics` avec un seul VEVENT.
 * Retourne une chaîne UTF-8 (à attacher en `text/calendar; method=PUBLISH`).
 */
export function generateIcsEvent(input: IcsEventInput): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Axion-IA//Booking V1//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.uid}`,
    `DTSTAMP:${formatUtcStamp(new Date())}`,
    `DTSTART:${formatUtcStamp(input.start)}`,
    `DTEND:${formatUtcStamp(input.end)}`,
    `SUMMARY:${escapeIcsText(input.summary)}`,
  ];
  if (input.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(input.description)}`);
  }
  if (input.location) {
    lines.push(`LOCATION:${escapeIcsText(input.location)}`);
  }
  if (input.organizerEmail) {
    const cn = input.organizerName ? `CN=${escapeIcsText(input.organizerName)}:` : "";
    lines.push(`ORGANIZER;${cn}mailto:${input.organizerEmail}`);
  }
  lines.push("STATUS:CONFIRMED");
  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");
  return lines.join(CRLF) + CRLF;
}

/**
 * Helper haut-niveau pour un cadrage Axion-IA.
 */
export function generateCadrageIcs(opts: {
  cadrageId: string;
  scheduledAt: Date;
  durationMinutes: number;
  visioUrl?: string;
  locale: "fr" | "en";
}): string {
  const end = new Date(opts.scheduledAt.getTime() + opts.durationMinutes * 60_000);
  const isFr = opts.locale === "fr";
  return generateIcsEvent({
    uid: `cadrage-${opts.cadrageId}@axion-ia.com`,
    start: opts.scheduledAt,
    end,
    summary: isFr ? "Cadrage Axion-IA" : "Axion-IA scoping call",
    description: isFr
      ? "Appel de cadrage avec Williams pour préparer votre intervention Axion-IA. Merci de prévoir un environnement calme et une connexion stable."
      : "Scoping call with Williams to prepare your Axion-IA session. Please plan for a quiet environment and a stable connection.",
    ...(opts.visioUrl ? { location: opts.visioUrl } : {}),
    organizerEmail: "william@axion-ia.com",
    organizerName: isFr ? "Williams — Axion-IA" : "Williams — Axion-IA",
  });
}
