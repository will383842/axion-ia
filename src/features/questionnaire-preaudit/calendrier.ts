/**
 * Calendrier des relances du questionnaire avant audit (2026-10-26). PUR : aucune lecture de base,
 * aucune horloge implicite (`maintenant` est toujours passé).
 *
 * Décisions (plan « e-mails, relances, Telegram », adoptées le 25/10/2026) :
 *   · relances à J+2, J+5 et J+10 en jours CALENDAIRES depuis le jour (Paris) du premier envoi
 *     réel, reportées au jour ouvré suivant (week-end et jours fériés nationaux), à 9 h 30
 *     Europe/Paris, toujours strictement croissantes ;
 *   · une relance à moins de 24 h de l'audit : la 3e est avancée au jour ouvré précédent tant
 *     qu'elle reste après la 2e, sinon elle est annulée (comme une 1re ou une 2e trop proche).
 */

import { dayKeyInParis, fromParisLocalInput } from "@/lib/calendar-grid";

export type RangRelance = 1 | 2 | 3;

export const DECALAGES_RELANCES: Readonly<Record<RangRelance, number>> = { 1: 2, 2: 5, 3: 10 };
export const HEURE_RELANCE = "09:30";
const UN_JOUR_MS = 24 * 60 * 60 * 1000;

/** Pâques (dimanche) par l'algorithme de Butcher (calendrier grégorien). PUR. */
export function paques(annee: number): { mois: number; jour: number } {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return { mois, jour };
}

const deux = (n: number) => String(n).padStart(2, "0");
const cle = (d: Date) =>
  `${d.getUTCFullYear()}-${deux(d.getUTCMonth() + 1)}-${deux(d.getUTCDate())}`;
const versDate = (jourIso: string) => {
  const [a, m, j] = jourIso.split("-").map(Number);
  return new Date(Date.UTC(a as number, (m as number) - 1, j as number));
};

/** Ajoute `n` jours CALENDAIRES à un jour `AAAA-MM-JJ`. PUR. */
export function ajouterJours(jourIso: string, n: number): string {
  const d = versDate(jourIso);
  d.setUTCDate(d.getUTCDate() + n);
  return cle(d);
}

/** Les 11 jours fériés nationaux de France métropolitaine (`AAAA-MM-JJ`). PUR. */
export function feriesFrance(annee: number): ReadonlySet<string> {
  const p = paques(annee);
  const dimanche = cle(new Date(Date.UTC(annee, p.mois - 1, p.jour)));
  return new Set([
    `${annee}-01-01`,
    ajouterJours(dimanche, 1), // lundi de Pâques
    `${annee}-05-01`,
    `${annee}-05-08`,
    ajouterJours(dimanche, 39), // Ascension
    ajouterJours(dimanche, 50), // lundi de Pentecôte
    `${annee}-07-14`,
    `${annee}-08-15`,
    `${annee}-11-01`,
    `${annee}-11-11`,
    `${annee}-12-25`,
  ]);
}

/** Lundi à vendredi, hors jour férié national. PUR. */
export function estJourOuvreParis(jourIso: string): boolean {
  const d = versDate(jourIso);
  const js = d.getUTCDay();
  if (js === 0 || js === 6) return false;
  return !feriesFrance(d.getUTCFullYear()).has(jourIso);
}

/** Le jour lui-même s'il est ouvré, sinon le suivant. PUR. */
export function jourOuvreAPartirDe(jourIso: string): string {
  let j = jourIso;
  while (!estJourOuvreParis(j)) j = ajouterJours(j, 1);
  return j;
}

/** Le jour ouvré STRICTEMENT avant. PUR. */
export function jourOuvrePrecedent(jourIso: string): string {
  let j = ajouterJours(jourIso, -1);
  while (!estJourOuvreParis(j)) j = ajouterJours(j, -1);
  return j;
}

/** 9 h 30, heure de Paris, de ce jour. PUR. */
export function a930(jourIso: string): Date {
  const d = fromParisLocalInput(`${jourIso}T${HEURE_RELANCE}`);
  if (d === null) throw new Error(`jour invalide : ${jourIso}`);
  return d;
}

export interface RelancePlanifiee {
  readonly rang: RangRelance;
  /** `null` : annulée (voir `motif`). */
  readonly prevuLe: Date | null;
  readonly motif?: "audit_proche";
}

/**
 * Les 3 relances depuis J0 (premier envoi RÉEL de l'invitation). `dateAudit` : facultative ;
 * une relance qui tombe à moins de 24 h de l'audit (ou après) est annulée, sauf la 3e, avancée
 * au jour ouvré précédent tant qu'elle reste après la 2e. PUR.
 */
export function planifierRelances(j0: Date, dateAudit: Date | null): RelancePlanifiee[] {
  const jour0 = dayKeyInParis(j0);
  const jours: string[] = [];
  for (const rang of [1, 2, 3] as const) {
    let j = jourOuvreAPartirDe(ajouterJours(jour0, DECALAGES_RELANCES[rang]));
    const avant = jours[jours.length - 1];
    if (avant !== undefined && j <= avant) j = jourOuvreAPartirDe(ajouterJours(avant, 1));
    jours.push(j);
  }
  const limite = dateAudit === null ? null : dateAudit.getTime() - UN_JOUR_MS;
  const sortie: RelancePlanifiee[] = [];
  let derniere: Date | null = null;
  for (const [i, jour] of jours.entries()) {
    const rang = (i + 1) as RangRelance;
    let prevu = a930(jour);
    if (limite !== null && prevu.getTime() > limite) {
      if (rang === 3) {
        let j = jour;
        while (prevu.getTime() > limite) {
          j = jourOuvrePrecedent(j);
          prevu = a930(j);
        }
        if (
          derniere !== null &&
          prevu.getTime() > derniere.getTime() &&
          prevu.getTime() > j0.getTime()
        ) {
          sortie.push({ rang, prevuLe: prevu });
          derniere = prevu;
          continue;
        }
      }
      sortie.push({ rang, prevuLe: null, motif: "audit_proche" });
      continue;
    }
    sortie.push({ rang, prevuLe: prevu });
    derniere = prevu;
  }
  return sortie;
}

function partiesParis(d: Date): Record<string, string> {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

const jourDuMois = (j: string) => (j === "1" ? "1er" : j);
const heure = (h: string, m: string) => `${Number(h)} h${m === "00" ? "" : ` ${m}`}`;

/** « vendredi 6 novembre à 8 h 30 » (heure de Paris). PUR. */
export function formaterAuditTexte(date: Date): string {
  const p = partiesParis(date);
  return `${p["weekday"]} ${jourDuMois(p["day"] ?? "")} ${p["month"]} à ${heure(p["hour"] ?? "0", p["minute"] ?? "00")}`;
}

/** « 6 novembre » (heure de Paris). PUR. */
export function formaterAuditCourt(date: Date): string {
  const p = partiesParis(date);
  return `${jourDuMois(p["day"] ?? "")} ${p["month"]}`;
}

/** « 04/11 » (heure de Paris), pour Telegram. PUR. */
export function formaterJourMois(date: Date): string {
  const [, m, j] = dayKeyInParis(date).split("-");
  return `${j}/${m}`;
}

/** « mer. 4 nov. à 9 h 30 » (heure de Paris), pour Telegram. PUR. */
export function formaterProchaine(date: Date): string {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p["weekday"]} ${jourDuMois(p["day"] ?? "")} ${p["month"]} à ${heure(p["hour"] ?? "0", p["minute"] ?? "00")}`;
}

/** Minutes depuis minuit, heure de Paris. PUR. */
function minutesParis(d: Date): number {
  const p = partiesParis(d);
  return Number(p["hour"]) * 60 + Number(p["minute"]);
}

const DEBUT_CRENEAU = 9 * 60;
const FIN_CRENEAU = 18 * 60 + 30;

/** Une relance ne part que lun-ven (hors fériés), entre 9 h et 18 h 30, heure de Paris. PUR. */
export function dansCreneauRelance(maintenant: Date): boolean {
  if (!estJourOuvreParis(dayKeyInParis(maintenant))) return false;
  const m = minutesParis(maintenant);
  return m >= DEBUT_CRENEAU && m < FIN_CRENEAU;
}

/** `maintenant` s'il est dans le créneau, sinon 9 h 30 du prochain jour ouvré possible. PUR. */
export function prochainCreneauRelance(maintenant: Date): Date {
  if (dansCreneauRelance(maintenant)) return maintenant;
  const jour = dayKeyInParis(maintenant);
  if (estJourOuvreParis(jour) && minutesParis(maintenant) < DEBUT_CRENEAU) return a930(jour);
  return a930(jourOuvreAPartirDe(ajouterJours(jour, 1)));
}
