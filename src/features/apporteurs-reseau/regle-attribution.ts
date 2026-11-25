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

import { PROTECTION_MOIS, ajouterMois } from "./regles";

/** Durée de la réservation provisoire, à compter de la saisie (`recueAt`). */
export const RESERVATION_PROVISOIRE_JOURS = 60;
/** Première version du contrat qui porte la validation par rendez-vous. */
export const VERSION_REGLE_RENDEZ_VOUS = "2.8";

/** `null` : la règle en vigueur aujourd'hui (confirmation par le silence). */
export type RegleAttribution = "rendez_vous" | null;

/** Forme canonique : 1 à 4 composantes de 1 à 4 chiffres, sans zéro de tête (« 2.08 » : refusé). */
const VERSION_CANONIQUE = /^(0|[1-9]\d{0,3})(\.(0|[1-9]\d{0,3})){0,3}$/;

/** « 2.10 » → [2, 10] ; `null` pour tout ce qui n'est pas une version canonique. */
function composantes(version: unknown): number[] | null {
  if (typeof version !== "string" || version.length > 19 || !VERSION_CANONIQUE.test(version))
    return null;
  return version.split(".").map(Number);
}

/**
 * La signature de l'apporteur (`signatureApporteur`, champ `version`) porte-t-elle une version du
 * contrat au moins égale à `min` ? Comparaison composante par composante, en NOMBRES
 * (« 2.10 » > « 2.8 ») ; une composante manquante vaut 0 (« 3 » = « 3.0 »). Version absente,
 * vide, illisible, non canonique ou héritée d'un prototype : faux.
 */
export function versionAuMoins(signature: unknown, min: string): boolean {
  if (typeof signature !== "object" || signature === null || Array.isArray(signature)) return false;
  if (!Object.hasOwn(signature, "version")) return false;
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

/**
 * « AAAA-MM-JJ » du jour de Paris : LE MÊME découpage que `aujourdhuiParis`
 * (`declaration-regles.ts`, qui importe ce module : d'où la copie d'une ligne ; un test fige
 * l'égalité des deux).
 */
const jourDeParis = (d: Date): string =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(d);

/**
 * Fin de la réservation provisoire : la FIN du 60e jour, heure de Paris (J0 = le jour de la
 * saisie) : couvert jusqu'à 23:59:59.999 de J+60, refusé à 00:00 de J+61. L'heure de la saisie
 * n'y change rien, ni les passages à l'heure d'hiver ou d'été. Date illisible : date illisible
 * (toute comparaison refuse).
 */
export function finReservation(recueAt: Date): Date {
  if (Number.isNaN(recueAt.getTime())) return new Date(Number.NaN);
  const [a = 0, m = 1, jour = 1] = jourDeParis(recueAt).split("-").map(Number);
  // Minuit UTC du jour J+61 (le calendrier fait les mois et les années bissextiles).
  const minuitUtc = Date.UTC(a, m - 1, jour + RESERVATION_PROVISOIRE_JOURS + 1);
  const cible = new Date(minuitUtc).toISOString().slice(0, 10);
  // Minuit à Paris = minuit UTC − 2 h (été) ou − 1 h (hiver) : celui des deux qui tombe à 00:00.
  const ete = minuitUtc - 2 * 3_600_000;
  const minuitParis =
    jourDeParis(new Date(ete)) === cible && jourDeParis(new Date(ete - 1)) !== cible
      ? ete
      : minuitUtc - 3_600_000;
  return new Date(minuitParis - 1);
}

/** Fin de la protection : six mois à compter du rendez-vous TENU. */
export function finDeProtectionRendezVous(rendezVousAt: Date): Date {
  return ajouterMois(rendezVousAt, PROTECTION_MOIS);
}

export type MotifRendezVousRefuse =
  "pris_avant_saisie" | "pris_apres_reservation" | "pas_encore_tenu" | "tenu_avant_prise";

/**
 * Ce rendez-vous valide-t-il l'entreprise ? Il doit avoir été PRIS pendant la réservation (bornes
 * incluses) et avoir EU LIEU, pas avant sa prise ; il peut s'être tenu après la fin de la
 * réservation.
 *
 * Juge UN rendez-vous, isolément. La règle vise le PREMIER rendez-vous tenu : c'est à l'appelant
 * de présenter les rendez-vous par date de tenue croissante et de retenir le premier recevable,
 * jamais le dernier (les six mois partent de celui-là).
 *
 * ⚠️ Conditions écrites en POSITIF : toute comparaison avec une date illisible rend `false`, donc
 * une date illisible REFUSE (elle ne valide jamais une entreprise ni n'ouvre six mois de protection).
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
  const tenu = e.tenuAt?.getTime();
  if (tenu === undefined || !(tenu <= e.maintenant.getTime()))
    return { ok: false, motif: "pas_encore_tenu" };
  if (!(tenu >= pris)) return { ok: false, motif: "tenu_avant_prise" };
  return { ok: true };
}

/** La réservation provisoire d'une présentation `reservee`, telle que la liront les gardes. */
export type ReservationProvisoire = {
  /** La saisie : un rendez-vous pris avant elle ne compte pas. */
  recueAt: Date;
  reserveeJusquAt: Date;
  /**
   * Date de PRISE d'un rendez-vous ni tenu ni annulé (c'est l'appelant qui le sait). Absent ou
   * `null` : aucun rendez-vous en attente.
   */
  rendezVousPrisAt?: Date | null | undefined;
};

/**
 * La réservation retient-elle encore l'entreprise ? Oui tant qu'elle court (terme inclus), OU
 * tant qu'un rendez-vous PRIS pendant la réservation (bornes incluses) reste à tenir : il peut
 * encore valider l'entreprise, donc un second apporteur ne doit pas pouvoir la saisir.
 *
 * ⚠️ Échec du côté « occupée » : une date illisible continue d'occuper (jamais deux apporteurs).
 * Seul un terme clairement dépassé libère, et seul un rendez-vous clairement hors fenêtre est écarté.
 */
export function reservationOccupe(r: ReservationProvisoire, maintenant: Date): boolean {
  if (!(r.reserveeJusquAt.getTime() < maintenant.getTime())) return true;
  const pris = r.rendezVousPrisAt?.getTime();
  if (pris === undefined) return false;
  return !(pris < r.recueAt.getTime()) && !(pris > r.reserveeJusquAt.getTime());
}
