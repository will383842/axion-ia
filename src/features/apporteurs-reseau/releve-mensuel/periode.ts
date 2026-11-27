/**
 * Relevé mensuel : la PÉRIODE. Mois civil de Paris `[1er M 00:00 ; 1er M+1 00:00[`.
 * Module PUR (aucune base). Les bornes suivent l'heure légale de Paris (heure d'été comprise).
 */

import { estJourCivilOuvre } from "@/lib/jours-ouvres";

const FORMAT = /^(\d{4})-(0[1-9]|1[0-2])$/;

/**
 * « 2026-10 » en heure de Paris. Même règle que `moisParis` de `commissions.ts`, recopiée ici
 * parce que ce module doit rester PUR : `commissions.ts` importe Prisma.
 */
export function moisParis(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
  })
    .format(d)
    .slice(0, 7);
}

export function periodeValide(periode: string): boolean {
  return FORMAT.test(periode);
}

function decouper(periode: string): { annee: number; mois: number } {
  const m = FORMAT.exec(periode);
  if (!m) throw new Error(`période invalide : « ${periode} » (attendu AAAA-MM)`);
  return { annee: Number(m[1]), mois: Number(m[2]) };
}

const PARIS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** L'instant UTC de « jour 00:00 » à Paris (minuit n'est jamais ambigu : les bascules sont à 2-3 h). */
function minuitParis(annee: number, mois: number, jour: number): Date {
  for (const decalageHeures of [1, 2]) {
    const t = new Date(Date.UTC(annee, mois - 1, jour) - decalageHeures * 3_600_000);
    const p = Object.fromEntries(PARIS.formatToParts(t).map((x) => [x.type, x.value]));
    if (
      Number(p.year) === annee &&
      Number(p.month) === mois &&
      Number(p.day) === jour &&
      Number(p.hour) === 0 &&
      Number(p.minute) === 0
    ) {
      return t;
    }
  }
  throw new Error(`minuit de Paris introuvable pour ${annee}-${mois}-${jour}`);
}

export function periodeSuivante(periode: string): string {
  const { annee, mois } = decouper(periode);
  return mois === 12 ? `${annee + 1}-01` : `${annee}-${String(mois + 1).padStart(2, "0")}`;
}

export function periodePrecedente(periode: string): string {
  const { annee, mois } = decouper(periode);
  return mois === 1 ? `${annee - 1}-12` : `${annee}-${String(mois - 1).padStart(2, "0")}`;
}

/** `debut` : 1er M 00:00 Paris. `coupure` : 1er M+1 00:00 Paris (exclue). */
export function bornesPeriode(periode: string): { debut: Date; coupure: Date } {
  const { annee, mois } = decouper(periode);
  const suivante = decouper(periodeSuivante(periode));
  return {
    debut: minuitParis(annee, mois, 1),
    coupure: minuitParis(suivante.annee, suivante.mois, 1),
  };
}

/** 1er janvier 00:00 Paris de l'année de la période (début du cumul annuel). */
export function debutAnnee(periode: string): Date {
  return minuitParis(decouper(periode).annee, 1, 1);
}

/** Le mois de Paris précédant `maintenant` : celui qu'on prépare. */
export function moisPrecedent(maintenant: Date): string {
  return periodePrecedente(moisParis(maintenant));
}

/** Une période n'est close que si elle est STRICTEMENT antérieure au mois de Paris en cours. */
export function periodeEstClose(periode: string, maintenant: Date): boolean {
  decouper(periode);
  return periode < moisParis(maintenant);
}

/** Refus côté serveur d'une période non close. */
export function exigerPeriodeClose(periode: string, maintenant: Date): void {
  if (!periodeEstClose(periode, maintenant)) {
    throw new Error(
      `La période ${periode} n'est pas close : un relevé ne se prépare qu'après sa fin.`,
    );
  }
}

/** Le Nᵉ jour ouvré (week-ends et fériés exclus) du mois, « AAAA-MM-JJ ». `n ≥ 1`. */
export function niemeJourOuvre(periode: string, n: number): string {
  const { annee, mois } = decouper(periode);
  if (!Number.isInteger(n) || n < 1) throw new Error("n doit être un entier ≥ 1");
  let restant = n;
  for (let jour = 1; jour <= 31; jour += 1) {
    const cle = `${periode}-${String(jour).padStart(2, "0")}`;
    if (new Date(Date.UTC(annee, mois - 1, jour)).getUTCMonth() !== mois - 1) break;
    if (estJourCivilOuvre(cle)) {
      restant -= 1;
      if (restant === 0) return cle;
    }
  }
  throw new Error(`le mois ${periode} n'a pas ${n} jours ouvrés`);
}

export function premierJourOuvre(periode: string): string {
  return niemeJourOuvre(periode, 1);
}
