/**
 * INT-T65-A (registre Partners) — la convention conclue sous la CONDITION
 * SUSPENSIVE de l'accord de prise en charge de l'OPCO (C. civ. 1304 s.).
 *
 * Module PUR (aucune base, aucun `server-only`) : il est lu par le service, par
 * l'alerte de rappel, par les gabarits PDF et par l'écran de la console.
 *
 * ## Ce qu'il traduit
 *
 * La clause de la juriste (A07), validée par Williams le 2026-10-04 à 09h19 UTC
 * (axion-apporteurs#656, commentaire 5978462914) :
 *
 *   - **accomplissement** (point 3) : accord ÉCRIT au moins égal au seuil, au
 *     plus tard à la date limite → `active`, effets à la DATE DE SIGNATURE ;
 *   - **renonciation** (point 4, art. 1304-4) : tant que la condition n'est ni
 *     accomplie ni défaillie → `active`, effets à la date de signature ;
 *   - **défaillance** (point 5) : refus, accord inférieur notifié avant la date
 *     limite, ou date limite passée sans accord → `caduque` ;
 *   - **après la défaillance** (point 6) : un accord tardif ne fait pas revivre
 *     la convention. Le seul chemin est une NOUVELLE convention, datée de sa
 *     propre signature : ce module n'a donc AUCUNE transition qui sorte de
 *     `caduque` (ni d'`active`).
 *
 * ## La date limite est un JOUR CIVIL DE PARIS
 *
 * Remarque de la juriste (#656, commentaire 5979338659) : « au plus tard le
 * {dateLimite} » désigne un JOUR, pas un instant. On stocke un instant
 * (`dateLimiteCondition`, Timestamptz) — celui de 00:00 heure de Paris du jour
 * limite — et la BORNE est la fin de ce jour civil de Paris : minuit EXCLUSIF,
 * heure de Paris, heure d'été comme d'hiver. Un accord reçu à 23h59 le jour
 * limite est dans le délai ; à 00h00 le lendemain, il est hors délai.
 *
 * ## Aucun flottant
 *
 * Seuil en points de base (1 à 10 000) OU en centimes entiers (>= 1) ; montants
 * en centimes entiers. Toute valeur non entière lève une `RangeError` au lieu
 * d'être arrondie en silence.
 */

import { dayKeyInParis, fromParisLocalInput } from "@/lib/calendar-grid";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Seuil de la condition : exactement l'un des deux (forme d'A02). */
export type SeuilConditionSuspensive =
  | { readonly type: "pourcentage"; readonly bps: number }
  | { readonly type: "montant"; readonly cents: number };

/**
 * Paramètres de la clause imprimée par les deux conventions (instantané de
 * rendu, donc sérialisable : la date limite y est DÉJÀ formatée).
 */
export interface ParametresClauseConditionSuspensiveOpco {
  /** Libellé de l'OPCO du client (`{opco}`). */
  readonly opco: string;
  /** Jour civil de Paris, « jj/mm/aaaa » (`{dateLimite}`). */
  readonly dateLimite: string;
  /** Rendu par `libelleSeuilClause` (`{seuil}`). */
  readonly seuil: SeuilConditionSuspensive;
}

/** États FERMÉS de la condition (acceptance, point 2). */
export type EtatConditionSuspensive = "en_attente" | "active" | "caduque";

export const ETATS_CONDITION_SUSPENSIVE: readonly EtatConditionSuspensive[] = [
  "en_attente",
  "active",
  "caduque",
];

export interface ConditionSuspensive {
  readonly seuil: SeuilConditionSuspensive;
  /** Prix HORS TAXES de la convention, en centimes : base d'un seuil en pourcentage. */
  readonly prixHtCents: number;
  /** Instant de 00:00 (heure de Paris) du jour limite — cf. en-tête. */
  readonly dateLimite: Date;
  /** Date de signature de la convention ; `null` tant qu'elle n'est pas signée. */
  readonly signeeLe: Date | null;
}

export type EvenementConditionSuspensive =
  | { readonly type: "accord_ecrit"; readonly le: Date; readonly montantAccordeCents: number }
  | { readonly type: "refus"; readonly le: Date }
  | { readonly type: "renonciation"; readonly le: Date };

export type CauseConditionSuspensive =
  "en_attente" | "accord_ecrit" | "renonciation" | "refus" | "accord_insuffisant" | "delai_depasse";

export interface EvaluationConditionSuspensive {
  readonly etat: EtatConditionSuspensive;
  /** Date d'effet de la convention : sa date de SIGNATURE, quand elle est active. */
  readonly effetLe: Date | null;
  readonly cause: CauseConditionSuspensive;
  /** Instant de l'événement décisif (ou de la borne dépassée) ; `null` en attente. */
  readonly le: Date | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Contrôles d'entiers
// ─────────────────────────────────────────────────────────────────────────────

export const SEUIL_BPS_MIN = 1;
export const SEUIL_BPS_MAX = 10_000;
export const SEUIL_CENTS_MIN = 1;

function exigerEntier(valeur: number, nom: string, min: number, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(valeur) || valeur < min || valeur > max) {
    throw new RangeError(`${nom} : entier attendu entre ${min} et ${max}, reçu ${valeur}`);
  }
}

/** Valide un seuil (bornes des CHECK `convention_seuil_bps_borne` / `_cents_positif`). */
export function validerSeuil(seuil: SeuilConditionSuspensive): void {
  if (seuil.type === "pourcentage") {
    exigerEntier(seuil.bps, "seuil en points de base", SEUIL_BPS_MIN, SEUIL_BPS_MAX);
  } else {
    exigerEntier(seuil.cents, "seuil en centimes", SEUIL_CENTS_MIN);
  }
}

/**
 * L'accord atteint-il le seuil ?
 *
 * En pourcentage, la comparaison se fait en ENTIERS, sans division :
 * `accordé × 10 000 >= bps × prixTtc`.
 */
export function seuilAtteint(
  seuil: SeuilConditionSuspensive,
  prixHtCents: number,
  montantAccordeCents: number,
): boolean {
  validerSeuil(seuil);
  exigerEntier(prixHtCents, "prix HT en centimes", 0);
  exigerEntier(montantAccordeCents, "montant accordé en centimes", 0);
  if (seuil.type === "montant") return montantAccordeCents >= seuil.cents;
  return BigInt(montantAccordeCents) * 10_000n >= BigInt(seuil.bps) * BigInt(prixHtCents);
}

/** Lit le seuil sur les colonnes de la convention ; `null` si aucun n'est posé. */
export function seuilDepuisColonnes(colonnes: {
  seuilConditionBps: number | null;
  seuilConditionCents: number | null;
}): SeuilConditionSuspensive | null {
  if (colonnes.seuilConditionBps !== null && colonnes.seuilConditionCents === null) {
    return { type: "pourcentage", bps: colonnes.seuilConditionBps };
  }
  if (colonnes.seuilConditionCents !== null && colonnes.seuilConditionBps === null) {
    return { type: "montant", cents: colonnes.seuilConditionCents };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Le jour civil de Paris
// ─────────────────────────────────────────────────────────────────────────────

const JOUR_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** « YYYY-MM-DD » valide (calendrier réel : pas de 31 février). */
export function estJourIso(jour: string): boolean {
  const m = JOUR_ISO.exec(jour);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === jour;
}

/** Jour civil de Paris (« YYYY-MM-DD ») d'un instant. */
export function jourDeParis(instant: Date): string {
  return dayKeyInParis(instant);
}

/** Décale un jour civil de `n` jours (arithmétique de calendrier, sans fuseau). */
export function decalerJour(jour: string, n: number): string {
  if (!estJourIso(jour)) throw new RangeError(`jour invalide : ${jour}`);
  const [a, m, j] = jour.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, j + n)).toISOString().slice(0, 10);
}

/** Instant de 00:00, heure de Paris, d'un jour civil — ce que l'on STOCKE. */
export function debutDuJourDeParis(jour: string): Date {
  if (!estJourIso(jour)) throw new RangeError(`jour invalide : ${jour}`);
  const instant = fromParisLocalInput(`${jour}T00:00`);
  if (instant === null) throw new RangeError(`jour invalide : ${jour}`);
  return instant;
}

/**
 * BORNE EXCLUSIVE du délai : 00:00 heure de Paris le LENDEMAIN du jour limite.
 * Un instant est dans le délai si et seulement s'il lui est strictement
 * antérieur.
 */
export function finDuJourLimite(dateLimite: Date): Date {
  return debutDuJourDeParis(decalerJour(jourDeParis(dateLimite), 1));
}

/** L'instant donné est-il APRÈS la fin du jour limite (heure de Paris) ? */
export function dateLimiteDepassee(dateLimite: Date, instant: Date): boolean {
  return instant.getTime() >= finDuJourLimite(dateLimite).getTime();
}

/** Date limite imprimée par la clause : « jj/mm/aaaa », jour de Paris. */
export function libelleJourLimite(dateLimite: Date): string {
  const [a, m, j] = jourDeParis(dateLimite).split("-");
  return `${j}/${m}/${a}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rappel avant la date limite
// ─────────────────────────────────────────────────────────────────────────────

/** Le rappel tombe sept jours (civils, de Paris) avant le jour limite. */
export const RAPPEL_CONDITION_SUSPENSIVE_JOURS = 7;

/** Jour civil (Paris) à partir duquel le rappel est dû. */
export function dateDuRappel(dateLimite: Date): string {
  return decalerJour(jourDeParis(dateLimite), -RAPPEL_CONDITION_SUSPENSIVE_JOURS);
}

/** Le rappel est dû à partir du J-7 (jour de Paris), tant que la condition est en attente. */
export function rappelDu(
  condition: ConditionSuspensive,
  evenements: readonly EvenementConditionSuspensive[],
  maintenant: Date,
): boolean {
  if (evaluerConditionSuspensive(condition, evenements, maintenant).etat !== "en_attente") {
    return false;
  }
  return jourDeParis(maintenant) >= dateDuRappel(condition.dateLimite);
}

// ─────────────────────────────────────────────────────────────────────────────
// Machine d'états
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Évalue la condition à l'instant `maintenant`.
 *
 * Les événements sont lus dans l'ordre CHRONOLOGIQUE (jamais dans l'ordre
 * reçu) ; le PREMIER événement survenu dans le délai décide, et plus rien ne
 * change ensuite : un accord après un refus, ou une renonciation après la
 * défaillance, ne fait pas revivre la convention (point 6 de la clause).
 * Un événement survenu après la fin du jour limite ne compte pas.
 */
export function evaluerConditionSuspensive(
  condition: ConditionSuspensive,
  evenements: readonly EvenementConditionSuspensive[],
  maintenant: Date,
): EvaluationConditionSuspensive {
  validerSeuil(condition.seuil);
  const borne = finDuJourLimite(condition.dateLimite);
  const ordonnes = [...evenements].sort((a, b) => a.le.getTime() - b.le.getTime());

  for (const e of ordonnes) {
    if (e.le.getTime() >= borne.getTime()) break;
    if (e.le.getTime() > maintenant.getTime()) break;
    switch (e.type) {
      case "renonciation":
        return { etat: "active", effetLe: condition.signeeLe, cause: "renonciation", le: e.le };
      case "refus":
        return { etat: "caduque", effetLe: null, cause: "refus", le: e.le };
      case "accord_ecrit":
        return seuilAtteint(condition.seuil, condition.prixHtCents, e.montantAccordeCents)
          ? { etat: "active", effetLe: condition.signeeLe, cause: "accord_ecrit", le: e.le }
          : { etat: "caduque", effetLe: null, cause: "accord_insuffisant", le: e.le };
    }
  }

  if (maintenant.getTime() >= borne.getTime()) {
    return { etat: "caduque", effetLe: null, cause: "delai_depasse", le: borne };
  }
  return { etat: "en_attente", effetLe: null, cause: "en_attente", le: null };
}

/**
 * Transitions AUTORISÉES : seulement depuis `en_attente`. `active` et `caduque`
 * sont terminaux — une convention caduque ne revit pas, elle se remplace.
 */
export function transitionAutorisee(
  de: EtatConditionSuspensive,
  vers: EtatConditionSuspensive,
): boolean {
  return de === "en_attente" && (vers === "active" || vers === "caduque");
}

// ─────────────────────────────────────────────────────────────────────────────
// Rendu des paramètres de la clause
// ─────────────────────────────────────────────────────────────────────────────

/** « 50 », « 62,5 », « 33,33 » — points de base en pourcentage, sans flottant. */
export function pourcentageDepuisBps(bps: number): string {
  exigerEntier(bps, "seuil en points de base", SEUIL_BPS_MIN, SEUIL_BPS_MAX);
  const entier = Math.trunc(bps / 100);
  const reste = bps % 100;
  if (reste === 0) return String(entier);
  return `${entier},${String(reste).padStart(2, "0").replace(/0$/, "")}`;
}

/** « 3 000,00 € » — centimes entiers, espaces ordinaires (police PDF sans U+202F). */
export function euroDepuisCentimes(cents: number): string {
  exigerEntier(cents, "montant en centimes", 0);
  const euros = Math.trunc(cents / 100);
  const centimes = String(cents % 100).padStart(2, "0");
  const milliers = String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${milliers},${centimes} €`;
}

/**
 * Paramètre `{seuil}` de la clause, toujours HORS TAXES (la convention imprime un
 * total HT). En pourcentage, la base est NOMMÉE : « 50 % » seul ne dirait pas de
 * quoi. En euros, « hors taxes » est écrit : un montant nu serait ambigu.
 */
export function libelleSeuilClause(seuil: SeuilConditionSuspensive): string {
  validerSeuil(seuil);
  return seuil.type === "pourcentage"
    ? `${pourcentageDepuisBps(seuil.bps)} % du prix hors taxes de la présente convention`
    : `${euroDepuisCentimes(seuil.cents)} hors taxes`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Saisie à l'écran → entiers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lit un nombre décimal FRANÇAIS saisi (« 1 500,50 », « 62,5 », « 62.5 ») en
 * un ENTIER d'unités de `10^-decimales`, sans jamais passer par un flottant.
 * `null` si la saisie est illisible ou porte plus de décimales qu'admises.
 */
export function entierDepuisSaisie(saisie: string, decimales: number): number | null {
  const net = saisie.replace(/[\s  ]/g, "").replace(",", ".");
  const m = /^(\d+)(?:\.(\d*))?$/.exec(net);
  if (!m) return null;
  const fraction = m[2] ?? "";
  if (fraction.length > decimales) return null;
  const valeur = Number(m[1]) * 10 ** decimales + Number(fraction.padEnd(decimales, "0") || "0");
  return Number.isSafeInteger(valeur) ? valeur : null;
}

/** « 62,5 » (%) → 6250 points de base ; `null` hors de 1..10 000. */
export function bpsDepuisSaisie(saisie: string): number | null {
  const v = entierDepuisSaisie(saisie, 2);
  return v !== null && v >= SEUIL_BPS_MIN && v <= SEUIL_BPS_MAX ? v : null;
}

/** « 1 500,50 » (€) → 150 050 centimes ; `null` sous 1 centime. */
export function centimesDepuisSaisie(saisie: string): number | null {
  const v = entierDepuisSaisie(saisie, 2);
  return v !== null && v >= SEUIL_CENTS_MIN ? v : null;
}
