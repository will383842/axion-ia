/**
 * La file d'attente de l'article 3.5 (contrat 2.8) — règles PURES (aucun accès base).
 *
 * Décisions de Will : 2 déclarations au plus en attente par entreprise, dans l'ordre d'horodatage ;
 * refus de la 3e (3.3 bis c) ; 15 jours pour le premier rang ; extinction 12 mois après
 * l'enregistrement. Atteint par le WORKER : aucun `server-only`.
 */

import { ajouterMois, finDuNiemeJourParis } from "./regles";

export const ATTENTE_MAX_PAR_ENTREPRISE = 2;
export const FENETRE_PREMIER_RANG_JOURS = 15;
export const EXTINCTION_ATTENTE_MOIS = 12;
/**
 * Q-F1 (à confirmer par Will) : lecture littérale. Quand le premier rang laisse passer ses 15 jours,
 * il est effacé et le second RESTE en attente, sans fenêtre ni e-mail. `true` : informer aussitôt le suivant.
 */
export const RANG_2_PROMU_AVEC_FENETRE = false;

/** Clé de file : le SIRET, sinon le SIREN (Q-F2 : le périmètre déclaré). */
export function cleFile(siren: string, siret: string | null): string {
  return siret ?? siren;
}

/** L'ordre de la file : l'horodatage de la déclaration, puis l'identifiant. Ne modifie pas l'entrée. */
export function ordreDeFile<T extends { recueAt: Date; id: string }>(l: T[]): T[] {
  return [...l].sort(
    (a, b) => a.recueAt.getTime() - b.recueAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/** Une déclaration de plus peut-elle entrer ? Oui si moins de deux sont déjà vivantes. */
export function peutEntrerEnFile(vivantes: number): boolean {
  return vivantes < ATTENTE_MAX_PAR_ENTREPRISE;
}

/** Dernier instant du délai du premier rang : le jour de l'information est le jour 1. */
export function finFenetre(informeeAt: Date): Date {
  return finDuNiemeJourParis(informeeAt, FENETRE_PREMIER_RANG_JOURS);
}

/** Dernier instant de la déclaration en attente : fin du jour de Paris, 12 mois après son horodatage. */
export function eteinteLe(recueAt: Date): Date {
  return finDuNiemeJourParis(ajouterMois(recueAt, EXTINCTION_ATTENTE_MOIS), 1);
}

/** « 24 décembre 2026 », heure de Paris : le dernier jour du délai, en toutes lettres (charge de l'e-mail). */
export function jusquAuLisible(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}
