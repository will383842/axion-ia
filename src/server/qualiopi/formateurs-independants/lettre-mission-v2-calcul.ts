/**
 * Lettre de mission v2 (lot S5) — ce que la lettre CALCULE, et rien d'autre.
 *
 * Texte arrêté par Will le 10/10/2026 : une lettre couvre 1 à N jours,
 * consécutifs ou non ; 350 € HT la journée, 175 € HT la demi-journée ;
 * forfait de déplacement par journée de déplacement ; paiement au plus tard le
 * jour de la dernière journée + 30 jours, avancé au jour ouvré précédent si
 * besoin, que le client ait réglé ou non (art. L441-10 C. com.) ; un virement
 * par mois de journées réalisées.
 *
 * 🔑 Module PUR : ni Prisma, ni Next. Montants en CENTIMES ENTIERS ; un tarif
 * qui n'en est pas un fait lever, il ne s'arrondit jamais en silence.
 */

import { estJourFerieFrance } from "@/lib/jours-ouvres";

/** 350 € HT la journée (texte arrêté). */
export const TARIF_JOURNEE_HT_CENTS = 35_000;
/** 175 € HT la demi-journée (texte arrêté) : la moitié de la journée. */
export const TARIF_DEMI_JOURNEE_HT_CENTS = TARIF_JOURNEE_HT_CENTS / 2;

/** Délai de paiement : dernière journée + 30 jours (art. L441-10 C. com.). */
export const DELAI_PAIEMENT_JOURS = 30;

/** Une journée de la lettre : date civile (`AAAA-MM-JJ`) et horaires `HH:MM`. */
export interface JourLettre {
  readonly date: string;
  readonly heureDebut: string;
  readonly heureFin: string;
}

/** Midi et demi : avant, c'est le matin ; après, l'après-midi. */
const PIVOT_MINUTES = 12 * 60 + 30;

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** 2 si le jour couvre le matin ET l'après-midi, 1 sinon. */
export function demiJourneesDuJour(j: JourLettre): 1 | 2 {
  return minutes(j.heureDebut) < PIVOT_MINUTES && minutes(j.heureFin) > PIVOT_MINUTES ? 2 : 1;
}

/** « N journée(s) et M demi-journée(s) » de la lettre. */
export function decompterJournees(jours: ReadonlyArray<JourLettre>): {
  journees: number;
  demiJournees: number;
} {
  let journees = 0;
  let demiJournees = 0;
  for (const j of jours) {
    if (demiJourneesDuJour(j) === 2) journees += 1;
    else demiJournees += 1;
  }
  return { journees, demiJournees };
}

function exigerCentimes(nom: string, v: number): void {
  if (!Number.isInteger(v) || v < 0) {
    throw new Error(`${nom} doit être un nombre entier de centimes positif (reçu ${v}).`);
  }
}

export interface HonorairesLettre {
  journees: number;
  demiJournees: number;
  honorairesHtCents: number;
  /** 0 = « compris dans les honoraires ». */
  deplacementHtCents: number;
  totalHtCents: number;
}

/**
 * Honoraires de la lettre. La demi-journée vaut la moitié du tarif de la
 * journée ; un tarif impair en centimes est refusé plutôt qu'arrondi.
 */
export function honorairesLettre(entree: {
  jours: ReadonlyArray<JourLettre>;
  tarifJourneeHtCents: number;
  forfaitDeplacementParJourHtCents: number | null;
  joursDeplacement: number;
}): HonorairesLettre {
  exigerCentimes("Le tarif de la journée", entree.tarifJourneeHtCents);
  if (entree.tarifJourneeHtCents % 2 !== 0) {
    throw new Error("Le tarif de la journée doit se partager en deux demi-journées entières.");
  }
  const forfait = entree.forfaitDeplacementParJourHtCents ?? 0;
  exigerCentimes("Le forfait de déplacement", forfait);
  if (!Number.isInteger(entree.joursDeplacement) || entree.joursDeplacement < 0) {
    throw new Error("Le nombre de journées de déplacement doit être un entier positif.");
  }
  const { journees, demiJournees } = decompterJournees(entree.jours);
  const honorairesHtCents =
    journees * entree.tarifJourneeHtCents + demiJournees * (entree.tarifJourneeHtCents / 2);
  const deplacementHtCents = forfait * entree.joursDeplacement;
  return {
    journees,
    demiJournees,
    honorairesHtCents,
    deplacementHtCents,
    totalHtCents: honorairesHtCents + deplacementHtCents,
  };
}

/** Midi UTC d'une date civile : aucun fuseau ne la fait changer de jour. */
function midiUtc(date: string): Date {
  return new Date(`${date}T12:00:00.000Z`);
}

function jourCivil(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Date limite de paiement : dernière journée + 30 jours, avancée au jour ouvré
 * PRÉCÉDENT (week-end, jour férié) — jamais repoussée.
 */
export function echeancePaiement(derniereJournee: string): string {
  const d = midiUtc(derniereJournee);
  d.setUTCDate(d.getUTCDate() + DELAI_PAIEMENT_JOURS);
  for (;;) {
    const jour = d.getUTCDay();
    if (jour !== 0 && jour !== 6 && !estJourFerieFrance(d)) return jourCivil(d);
    d.setUTCDate(d.getUTCDate() - 1);
  }
}

/** Un virement par mois de journées réalisées : l'échéance de chaque mois. */
export function echeancesParMois(
  jours: ReadonlyArray<JourLettre>,
): Array<{ mois: string; echeance: string }> {
  const derniere = new Map<string, string>();
  for (const j of jours) {
    const mois = j.date.slice(0, 7);
    const d = derniere.get(mois);
    if (d === undefined || j.date > d) derniere.set(mois, j.date);
  }
  return [...derniere.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([mois, d]) => ({ mois, echeance: echeancePaiement(d) }));
}

export type RegimeTvaLettre = "franchise_293b" | "exonere_formation" | "assujetti_20";

function euros(cents: number): string {
  const e = Math.trunc(cents / 100);
  const c = String(cents % 100).padStart(2, "0");
  return `${e.toLocaleString("fr-FR").replace(/\s/g, " ")},${c} €`;
}

/** La mention de TVA de la lettre (régime figé de la mission). */
export function mentionTvaLettre(regime: RegimeTvaLettre, totalHtCents: number): string {
  switch (regime) {
    case "franchise_293b":
      return "TVA non applicable, art. 293 B du CGI";
    case "exonere_formation":
      return "Exonération de TVA, art. 261-4-4° a du CGI";
    case "assujetti_20": {
      exigerCentimes("Le total", totalHtCents);
      // 20 % d'un entier de centimes : arrondi au centime le plus proche.
      return `TVA 20 % : ${euros(Math.round(totalHtCents / 5))}`;
    }
  }
}

/** « 1 400,00 € » — affichage d'un montant en centimes. */
export function formaterEurosCents(cents: number): string {
  exigerCentimes("Le montant", cents);
  return euros(cents);
}
