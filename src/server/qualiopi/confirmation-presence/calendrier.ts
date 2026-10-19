/**
 * Chantier QNC, NC6 — le calendrier de la confirmation de présence (P-12,
 * étapes 3 et 4). Fonction PURE : pas de base, pas d'horloge. L'appelant lit
 * les faits (journal des relances) et passe l'instant.
 *
 * Jours calendaires de Paris. J = premier jour de la session (voir `jourJ`).
 *
 *  - demande   : J-3 ≤ jour ≤ J-1, entre 9 h et 19 h, si aucune demande n'est partie ;
 *  - relance   : J-2 ≤ jour ≤ J-1, entre 9 h et 19 h, si la demande est partie un jour
 *                de Paris antérieur, sans réponse, sans relance déjà faite ;
 *  - entreprise: jour = J-1, entre 12 h et 19 h, si une demande existe depuis ≥ 3 h, que
 *                la dernière réponse n'est pas « oui », qu'une adresse de contact existe
 *                et qu'aucune information n'est partie.
 */

import { parisDateISO, parisMinutesDuJour } from "@/server/qualiopi/presence/time";
import {
  DELAI_AVANT_INFO_ENTREPRISE_MS,
  JOUR_DERNIER,
  JOURS_DEMANDE_PREMIER,
  JOURS_RELANCE_PREMIER,
  PLAGE_ENTREPRISE,
  PLAGE_STAGIAIRE,
  type ReponsePresence,
} from "./objets";

export type EtapePresence = "demande" | "relance" | "information_entreprise";

export interface FaitsPresence {
  /** Instant d'envoi de la demande, ou null. */
  readonly demandeLe: Date | null;
  readonly relanceLe: Date | null;
  readonly informationEntrepriseLe: Date | null;
  /** Dernière réponse du stagiaire, ou null. */
  readonly reponse: ReponsePresence | null;
  /** Le contact de l'entreprise a-t-il une adresse e-mail ? */
  readonly contactEmail: boolean;
}

/** Nombre de jours calendaires de `de` à `a` (dates ISO `YYYY-MM-DD`), insensible à l'heure d'été. */
function ecartJours(de: string, a: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
}

function dansLaPlage(minutes: number, plage: { debut: number; fin: number }): boolean {
  return minutes >= plage.debut && minutes < plage.fin;
}

/**
 * Le jour de Paris d'une date de journée. Une date SEULE (`YYYY-MM-DD`) est déjà un jour
 * civil ; une chaîne ISO AVEC heure est un instant, dont le jour de Paris n'est pas le
 * jour UTC (`2026-12-06T23:30:00Z` est le 7 à Paris) — le découper en `slice(0, 10)` lisait
 * la date UTC.
 */
function jourDeParis(date: string | Date): string {
  if (typeof date !== "string") return parisDateISO(date);
  return date.length <= 10 ? date : parisDateISO(new Date(date));
}

/**
 * J : la première date de `jours` (Paris), à défaut `dateDebut`. Rend une date
 * ISO `YYYY-MM-DD` de Paris.
 */
export function jourJ(session: {
  readonly jours?: ReadonlyArray<{ readonly date: string | Date }> | null | undefined;
  readonly dateDebut: Date;
}): string {
  const dates = (session.jours ?? []).map((j) => jourDeParis(j.date));
  if (dates.length === 0) return parisDateISO(session.dateDebut);
  return [...dates].sort()[0] as string;
}

/** Les étapes dues à cet instant, dans l'ordre : demande, relance, information. */
export function etapesDues(
  maintenant: Date,
  jourJIso: string,
  faits: FaitsPresence,
): ReadonlyArray<EtapePresence> {
  const aujourdhui = parisDateISO(maintenant);
  const avantJ = ecartJours(aujourdhui, jourJIso);
  const minutes = parisMinutesDuJour(maintenant);
  const dues: EtapePresence[] = [];

  const fenetreStagiaire = dansLaPlage(minutes, PLAGE_STAGIAIRE);

  if (
    faits.demandeLe === null &&
    avantJ >= JOUR_DERNIER &&
    avantJ <= JOURS_DEMANDE_PREMIER &&
    fenetreStagiaire
  ) {
    dues.push("demande");
  }

  if (
    faits.demandeLe !== null &&
    faits.relanceLe === null &&
    faits.reponse === null &&
    avantJ >= JOUR_DERNIER &&
    avantJ <= JOURS_RELANCE_PREMIER &&
    fenetreStagiaire &&
    parisDateISO(faits.demandeLe) < aujourdhui
  ) {
    dues.push("relance");
  }

  if (
    faits.demandeLe !== null &&
    faits.informationEntrepriseLe === null &&
    faits.reponse !== "oui" &&
    faits.contactEmail &&
    avantJ === JOUR_DERNIER &&
    dansLaPlage(minutes, PLAGE_ENTREPRISE) &&
    maintenant.getTime() - faits.demandeLe.getTime() >= DELAI_AVANT_INFO_ENTREPRISE_MS
  ) {
    dues.push("information_entreprise");
  }

  return dues;
}

/** « lundi 26 octobre 2026 », pour un jour civil `YYYY-MM-DD` (celui de Paris). */
export function libelleJour(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
