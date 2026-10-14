/**
 * Formateurs indépendants — DATES DU PAIEMENT PAR MISSION (L15b), pures.
 *
 * On raisonne en JOURS CIVILS DE PARIS, sous forme de clés « AAAA-MM-JJ » : une
 * journée de formation est un jour, pas un instant, et l'échéance légale se
 * compte en jours civils (L441-10 C. com.). Aucun fuseau, aucune heure d'été
 * n'intervient une fois la clé obtenue.
 *
 * Règles (ADR 0066 v2 (e), plan 08 §2.7) :
 *   - échéance du VIREMENT = date de l'autofacture + 30 jours (décision du 14/10/2026,
 *     `paiement/echeance-autofacture.ts`) ; « dernière journée + 30 » (`echeanceLegale`)
 *     n'en est plus que le plancher, posé à l'écriture du relevé ;
 *   - date cible du virement = dernier jour OUVRÉ au plus tard à l'échéance
 *     (week-ends et jours fériés de métropole, source unique `lib/jours-ouvres.ts`) ;
 *   - l'orange et le rouge se calculent sur la date cible, jamais sur l'échéance.
 */

import { dernierJourOuvreAuPlusTard as dernierOuvre, estJourCivilOuvre } from "@/lib/jours-ouvres";

import { PARAMETRES_ARGENT_FORMATEURS, type ParametresArgentFormateurs } from "./parametres";

/** Un jour civil, « AAAA-MM-JJ ». */
export type JourCivil = string;

const MOTIF_JOUR = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function estJourCivil(x: unknown): x is JourCivil {
  if (typeof x !== "string" || !MOTIF_JOUR.test(x)) return false;
  const d = new Date(`${x}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === x;
}

function exiger(j: JourCivil): Date {
  if (!estJourCivil(j)) throw new Error(`jour civil invalide : ${String(j)}`);
  return new Date(`${j}T00:00:00Z`);
}

const PARIS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Le jour civil de Paris d'un instant. */
export function jourParis(instant: Date): JourCivil {
  const p = Object.fromEntries(PARIS.formatToParts(instant).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

const PARIS_HEURE = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * L'instant d'une heure « HH:MM » de Paris, un jour civil donné (lot D, M11 :
 * début d'une demi-journée annulée). Deux passes suffisent à absorber le
 * décalage d'été ou d'hiver du jour.
 */
export function instantParis(jour: JourCivil, heure: string): Date {
  const m = /^(\d{2}):(\d{2})$/.exec(heure);
  if (m === null) throw new Error(`heure invalide : ${heure}`);
  const voulu = exiger(jour).getTime() + (Number(m[1]) * 60 + Number(m[2])) * 60_000;
  let t = voulu;
  for (let i = 0; i < 2; i++) {
    const p = Object.fromEntries(
      PARIS_HEURE.formatToParts(new Date(t)).map((x) => [x.type, x.value]),
    );
    const lu =
      exiger(jourParis(new Date(t))).getTime() + (Number(p.hour) * 60 + Number(p.minute)) * 60_000;
    t += voulu - lu;
  }
  return new Date(t);
}

/**
 * Le jour civil d'une colonne `@db.Date` lue par Prisma (minuit UTC). Ne JAMAIS
 * passer par `jourParis` : minuit UTC du 05/11 est déjà le 05/11 à Paris, mais
 * c'est la convention de stockage qui fait foi, pas un fuseau.
 */
export function jourDeColonneDate(d: Date): JourCivil {
  return d.toISOString().slice(0, 10);
}

export function ajouterJours(j: JourCivil, n: number): JourCivil {
  const d = exiger(j);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Nombre de jours de `a` à `b` (positif si `b` est après `a`). */
export function joursEntre(a: JourCivil, b: JourCivil): number {
  return Math.round((exiger(b).getTime() - exiger(a).getTime()) / 86_400_000);
}

/** « AAAA-MM » du jour. */
export function moisDe(j: JourCivil): string {
  exiger(j);
  return j.slice(0, 7);
}

export function estOuvre(j: JourCivil): boolean {
  exiger(j);
  return estJourCivilOuvre(j);
}

/** Le dernier jour ouvré au plus tard à `j` (source unique : `lib/jours-ouvres.ts`). */
export function dernierJourOuvreAuPlusTard(j: JourCivil): JourCivil {
  exiger(j);
  return dernierOuvre(j);
}

/**
 * Dernière journée réalisée + 30 jours. Depuis le 14/10/2026, le PLANCHER de l'échéance
 * (la plus proche date possible) ; l'échéance du virement part de l'autofacture
 * (`paiement/echeance-autofacture.ts`). Reste la date fixe de l'indemnité d'annulation
 * (art. 11.3) et de la présentation de la méthode (art. 21.2).
 */
export function echeanceLegale(
  derniereJournee: JourCivil,
  p: Pick<ParametresArgentFormateurs, "delaiPaiementJours"> = PARAMETRES_ARGENT_FORMATEURS,
): JourCivil {
  return ajouterJours(derniereJournee, p.delaiPaiementJours);
}

/** Date cible du virement : dernier jour ouvré au plus tard à l'échéance. */
export function dateCibleVirement(echeance: JourCivil): JourCivil {
  return dernierJourOuvreAuPlusTard(echeance);
}

export type CouleurVirement = "a_venir" | "orange" | "rouge";

/** Orange à J-5 de la date cible ; rouge une fois la date cible PASSÉE. */
export function couleurVirement(
  dateCible: JourCivil,
  aujourdhui: JourCivil,
  p: Pick<ParametresArgentFormateurs, "orangeAvantDateCibleJours"> = PARAMETRES_ARGENT_FORMATEURS,
): CouleurVirement {
  const reste = joursEntre(aujourdhui, dateCible);
  if (reste < 0) return "rouge";
  if (reste <= p.orangeAvantDateCibleJours) return "orange";
  return "a_venir";
}
