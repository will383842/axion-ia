/**
 * Réseau d'apporteurs — la règle d'attribution PAR RENDEZ-VOUS (future règle du contrat 2.8).
 *
 * Ce que dira le contrat 2.8 : l'entreprise est réservée 60 jours à compter de la saisie ; elle
 * est validée au premier rendez-vous qui a EU LIEU, s'il a été PRIS pendant ces 60 jours (il peut
 * se tenir après) ; la protection de six mois part du jour du rendez-vous tenu ; un rendez-vous
 * pris AVANT la saisie ne compte pas.
 *
 * Lot 2 (2026-11-25) : ces fonctions ne sont lues par AUCUN appelant. Les contrats 2.6 et
 * antérieurs restent sous la confirmation par le silence (`regles.ts`, art. 3.2).
 *
 * ⚠️ Module PUR : ni base, ni environnement, ni `server-only`. L'interrupteur vit à part
 * (`interrupteur-rendez-vous.ts`) et se passe en argument (`regleDe(signature, actif)`).
 */

import { PROTECTION_MOIS, ajouterJours, ajouterMois } from "./regles";

/** Durée de la réservation provisoire, à compter de la saisie (`recueAt`). */
export const RESERVATION_PROVISOIRE_JOURS = 60;
/** Première version du contrat qui porte la validation par rendez-vous. */
export const VERSION_REGLE_RENDEZ_VOUS = "2.8";

/** `null` : la règle en vigueur aujourd'hui (confirmation par le silence). */
export type RegleAttribution = "rendez_vous" | null;

/**
 * « 2.10 » → [2, 10] ; `null` pour tout ce qui n'est pas une suite de nombres séparés par des
 * points. Bornée (quatre composantes de quatre chiffres au plus) : une chaîne démesurée est
 * illisible, elle ne devient jamais « l'infini ».
 */
function composantes(version: unknown): number[] | null {
  if (typeof version !== "string" || !/^\d{1,4}(\.\d{1,4}){0,3}$/.test(version)) return null;
  return version.split(".").map(Number);
}

/**
 * La signature de l'apporteur (`signatureApporteur`, champ `version`) porte-t-elle une version du
 * contrat au moins égale à `min` ? Comparaison composante par composante, en NOMBRES
 * (« 2.10 » > « 2.8 ») ; une composante manquante vaut 0 (« 3 » = « 3.0 »). Version absente,
 * vide ou illisible : faux.
 */
export function versionAuMoins(signature: unknown, min: string): boolean {
  if (typeof signature !== "object" || signature === null || Array.isArray(signature)) return false;
  // Le champ doit appartenir à l'objet lui-même (jamais hérité d'un prototype).
  if (!Object.prototype.hasOwnProperty.call(signature, "version")) return false;
  const version = composantes((signature as { version?: unknown }).version);
  const seuil = composantes(min);
  if (!version || !seuil) return false;
  for (let i = 0; i < Math.max(version.length, seuil.length); i++) {
    const a = version[i] ?? 0;
    const b = seuil[i] ?? 0;
    if (a !== b) return a > b;
  }
  return true;
}

/** La règle d'un apporteur : par rendez-vous seulement si l'interrupteur est allumé ET son contrat ≥ 2.8. */
export function regleDe(signature: unknown, actif: boolean): RegleAttribution {
  return actif === true && versionAuMoins(signature, VERSION_REGLE_RENDEZ_VOUS)
    ? "rendez_vous"
    : null;
}

/** Fin de la réservation provisoire : la saisie + 60 jours (borne incluse). */
export function finReservation(recueAt: Date): Date {
  return ajouterJours(recueAt, RESERVATION_PROVISOIRE_JOURS);
}

/** Fin de la protection : six mois à compter du rendez-vous TENU. */
export function finDeProtectionRendezVous(rendezVousAt: Date): Date {
  return ajouterMois(rendezVousAt, PROTECTION_MOIS);
}

export type MotifRendezVousRefuse =
  "pris_avant_saisie" | "pris_apres_reservation" | "pas_encore_tenu";

/**
 * Ce rendez-vous valide-t-il l'entreprise ? Il doit avoir été PRIS pendant la réservation (bornes
 * incluses) et avoir EU LIEU ; il peut s'être tenu après la fin de la réservation.
 *
 * Les contrôles sont écrits en POSITIF : une date illisible (`Invalid Date`) ne satisfait aucune
 * comparaison, donc elle refuse, jamais elle ne valide.
 */
export function rendezVousRecevable(e: {
  recueAt: Date;
  reserveeJusquAt: Date;
  prisAt: Date;
  tenuAt: Date | null;
  maintenant: Date;
}): { ok: true } | { ok: false; motif: MotifRendezVousRefuse } {
  const pris = e.prisAt.getTime();
  if (!(pris >= e.recueAt.getTime())) return { ok: false, motif: "pris_avant_saisie" };
  if (!(pris <= e.reserveeJusquAt.getTime())) return { ok: false, motif: "pris_apres_reservation" };
  if (!e.tenuAt || !(e.tenuAt.getTime() <= e.maintenant.getTime()))
    return { ok: false, motif: "pas_encore_tenu" };
  return { ok: true };
}
