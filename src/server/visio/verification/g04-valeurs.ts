/**
 * G4 — LES VALEURS SONT DANS LA CITATION (`compte-rendu-et-extraction.md` §4.2).
 *
 *   · tout MONTANT et toute QUANTITÉ de la valeur doit se retrouver dans une
 *     citation du fait — en chiffres ou en lettres, par une table FERMÉE
 *     (« un » … « cent », « mille ») ; euros ↔ centimes contrôlés ;
 *   · une DATE n'est jamais celle de l'IA : l'expression exacte
 *     (« avant le 15 décembre ») doit figurer dans la citation, et la date
 *     cible est RECALCULÉE par le code à partir de la date de l'échange. Un
 *     écart = rejet ; une expression que le code ne sait pas lire garde ses
 *     mots, sans date (jamais une date inventée).
 *
 * Module PUR : la date de l'échange est un paramètre.
 */

import { normaliserPourCitation } from "./g01-citation";

const UNITES: Readonly<Record<string, number>> = {
  zero: 0,
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
  treize: 13,
  quatorze: 14,
  quinze: 15,
  seize: 16,
  vingt: 20,
  trente: 30,
  quarante: 40,
  cinquante: 50,
  soixante: 60,
  cent: 100,
  cents: 100,
  mille: 1000,
};

function sansAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Les nombres écrits en lettres (table fermée), par suite de mots. */
function nombresEnLettres(texte: string): number[] {
  const mots = sansAccents(texte).split(/[\s-]+/);
  const trouves: number[] = [];
  let total = 0;
  let courant = 0;
  let enCours = false;
  const clore = () => {
    if (enCours) trouves.push(total + courant);
    total = 0;
    courant = 0;
    enCours = false;
  };
  for (const brut of mots) {
    const mot = brut.replace(/[^a-z]/g, "");
    if (mot === "et" && enCours) continue;
    const v = UNITES[mot];
    if (v === undefined) {
      clore();
      continue;
    }
    enCours = true;
    if (v === 100) courant = (courant === 0 ? 1 : courant) * 100;
    else if (v === 1000) {
      total += (courant === 0 ? 1 : courant) * 1000;
      courant = 0;
    } else if (mot === "vingt" && courant % 100 === 4) courant = courant - 4 + 80;
    else courant += v;
  }
  clore();
  return trouves;
}

/** Tous les nombres d'un texte : chiffres (« 3 000 », « 3.000 », « 3k », « 2,5 ») et lettres. */
export function nombresDuTexte(texte: string): number[] {
  const n = texte.normalize("NFKC").toLowerCase();
  const trouves: number[] = [];
  for (const m of n.matchAll(/\d{1,3}(?:[  .]\d{3})+(?:,\d+)?|\d+(?:,\d+)?\s*k\b|\d+(?:,\d+)?/g)) {
    const brut = m[0];
    const k = /k$/.test(brut.trim());
    const nettoye = brut.replace(/k$/, "").trim().replace(/[  .]/g, "").replace(",", ".");
    const v = Number(nettoye);
    if (Number.isFinite(v)) trouves.push(k ? v * 1000 : v);
  }
  return [...trouves, ...nombresEnLettres(n)];
}

/** Le nombre `attendu` est-il dit dans la citation (en euros pour un montant) ? */
export function nombrePresent(attendu: number, citations: readonly string[]): boolean {
  const nombres = citations.flatMap(nombresDuTexte);
  if (nombres.some((n) => Math.abs(n - attendu) < 1e-9)) return true;
  // « entre 3 et 4 000 » : le 3 porte le millier du second nombre.
  const mentionMilliers =
    nombres.some((n) => n >= 1000) || citations.some((c) => /mille|\dk\b/i.test(c));
  return (
    mentionMilliers &&
    attendu % 1000 === 0 &&
    nombres.some((n) => Math.abs(n - attendu / 1000) < 1e-9)
  );
}

export interface ValeurAVerifier {
  readonly montant_min_cents: number | null;
  readonly montant_max_cents: number | null;
  readonly quantite: number | null;
  readonly date_cible: string | null;
  readonly expression_temporelle: string | null;
}

export type PrecisionCalculee =
  "jour" | "semaine" | "mois" | "trimestre" | "annee" | "avant_le" | "apres_le";

export interface DateRecalculee {
  readonly date: string;
  readonly precision: PrecisionCalculee;
}

export type VerdictValeurs =
  | { readonly ok: true; readonly date: DateRecalculee | null; readonly dateNonLue: boolean }
  | { readonly ok: false };

const MOIS = [
  "janvier",
  "fevrier",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "aout",
  "septembre",
  "octobre",
  "novembre",
  "decembre",
];
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function utc(a: number, m: number, j: number): Date {
  return new Date(Date.UTC(a, m, j));
}
function dernierJour(a: number, m: number): number {
  return new Date(Date.UTC(a, m + 1, 0)).getUTCDate();
}

/**
 * Recalcule la date d'une expression, à partir de la date de l'échange (la
 * prochaine occurrence dans le futur). `null` si le code ne sait pas lire.
 */
export function recalculerDate(expression: string, dateEchange: Date): DateRecalculee | null {
  const e = sansAccents(normaliserPourCitation(expression));
  const ref = utc(
    dateEchange.getUTCFullYear(),
    dateEchange.getUTCMonth(),
    dateEchange.getUTCDate(),
  );
  const an = ref.getUTCFullYear();
  const prefixe: PrecisionCalculee | null = /\bavant\b|\bd'ici\b/.test(e)
    ? "avant_le"
    : /\bapres\b|\ba partir d/.test(e)
      ? "apres_le"
      : null;

  // « le 15 décembre (2026) », « 15/12 ».
  const jourMois = e.match(
    /\b(\d{1,2})(?:er)?\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)(?:\s+(\d{4}))?/,
  );
  const slash = e.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (jourMois || slash) {
    const j = Number(jourMois ? jourMois[1] : slash![1]);
    const m = jourMois ? MOIS.indexOf(jourMois[2]!) : Number(slash![2]) - 1;
    const aDit = jourMois ? jourMois[3] : slash![3];
    if (m < 0 || m > 11 || j < 1 || j > dernierJour(an, m)) return null;
    let a = aDit ? Number(aDit.length === 2 ? `20${aDit}` : aDit) : an;
    if (!aDit && utc(a, m, j) < ref) a += 1;
    return { date: iso(utc(a, m, j)), precision: prefixe ?? "jour" };
  }

  // Jours relatifs.
  if (/\bdemain\b/.test(e)) {
    return { date: iso(new Date(ref.getTime() + 86_400_000)), precision: prefixe ?? "jour" };
  }
  const jour = JOURS.findIndex((nom) => new RegExp(`\\b${nom}\\b`).test(e));
  if (jour >= 0) {
    // La prochaine occurrence (« jeudi » ou « jeudi prochain » dit un mardi :
    // le jeudi qui vient). Le jour même renvoie à la semaine suivante.
    let ecart = (jour - ref.getUTCDay() + 7) % 7;
    if (ecart === 0) ecart = 7;
    return {
      date: iso(new Date(ref.getTime() + ecart * 86_400_000)),
      precision: prefixe ?? "jour",
    };
  }
  const dans = e.match(/\bdans (\d+|un|une|deux|trois|quatre|cinq|six) (jours?|semaines?|mois)\b/);
  if (dans) {
    const n = /^\d+$/.test(dans[1]!) ? Number(dans[1]) : (UNITES[dans[1]!] ?? 0);
    const unite = dans[2]!;
    if (unite.startsWith("jour"))
      return { date: iso(new Date(ref.getTime() + n * 86_400_000)), precision: "jour" };
    if (unite.startsWith("semaine"))
      return { date: iso(new Date(ref.getTime() + n * 7 * 86_400_000)), precision: "semaine" };
    return { date: iso(utc(an, ref.getUTCMonth() + n, 1)), precision: "mois" };
  }
  if (/\bla semaine prochaine\b/.test(e)) {
    const lundi = (8 - ref.getUTCDay()) % 7 || 7;
    return { date: iso(new Date(ref.getTime() + lundi * 86_400_000)), precision: "semaine" };
  }
  if (/\ble mois prochain\b/.test(e)) {
    return { date: iso(utc(an, ref.getUTCMonth() + 1, 1)), precision: prefixe ?? "mois" };
  }
  if (/\bfin (?:d'annee|de l'annee|d'annee civile)\b/.test(e)) {
    return { date: iso(utc(an, 11, 31)), precision: prefixe ?? "mois" };
  }

  // Saisons (trimestre) : la prochaine.
  const saisons: ReadonlyArray<[string, number, number]> = [
    ["printemps", 2, 20],
    ["ete", 5, 21],
    ["automne", 8, 22],
    ["hiver", 11, 21],
  ];
  for (const [nom, m, j] of saisons) {
    if (new RegExp(`\\b${nom}\\b`).test(e)) {
      let a = an;
      if (utc(a, m + 3, 1) <= ref) a += 1;
      return { date: iso(utc(a, m, j)), precision: prefixe ?? "trimestre" };
    }
  }

  // Un mois seul : « en mars », « fin mars », « début mars », « mi-mars ».
  const mois = MOIS.findIndex((nom) => new RegExp(`\\b${nom}\\b`).test(e));
  if (mois >= 0) {
    let a = an;
    if (utc(a, mois + 1, 0) < ref) a += 1;
    const jourDuMois = /\bfin\b/.test(e) ? dernierJour(a, mois) : /\bmi\b/.test(e) ? 15 : 1;
    return { date: iso(utc(a, mois, jourDuMois)), precision: prefixe ?? "mois" };
  }
  return null;
}

/** G4 : vérifie montants, quantités et date d'une valeur contre les citations du fait. */
export function verifierValeurs(
  v: ValeurAVerifier,
  citations: readonly string[],
  dateEchange: Date,
): VerdictValeurs {
  for (const cents of [v.montant_min_cents, v.montant_max_cents]) {
    if (cents === null) continue;
    if (cents % 100 !== 0) {
      if (!nombrePresent(cents / 100, citations)) return { ok: false };
      continue;
    }
    if (!nombrePresent(cents / 100, citations)) return { ok: false };
  }
  if (
    v.montant_min_cents !== null &&
    v.montant_max_cents !== null &&
    v.montant_min_cents > v.montant_max_cents
  ) {
    return { ok: false };
  }
  if (v.quantite !== null && !nombrePresent(v.quantite, citations)) return { ok: false };

  if (v.expression_temporelle === null) {
    // Une date sans ses mots n'est pas prouvée.
    return v.date_cible === null ? { ok: true, date: null, dateNonLue: false } : { ok: false };
  }
  const expr = normaliserPourCitation(v.expression_temporelle);
  const dansCitation = citations.some((c) =>
    ` ${normaliserPourCitation(c)} `.includes(` ${expr} `),
  );
  if (!dansCitation) return { ok: false };
  const calculee = recalculerDate(v.expression_temporelle, dateEchange);
  if (calculee === null) return { ok: true, date: null, dateNonLue: true };
  if (v.date_cible !== null && v.date_cible.slice(0, 10) !== calculee.date) return { ok: false };
  return { ok: true, date: calculee, dateNonLue: false };
}
