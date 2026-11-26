/**
 * Réseau d'apporteurs — la règle d'attribution PAR RENDEZ-VOUS (future règle du contrat 2.8).
 *
 * Ce que dira le contrat 2.8 : l'entreprise est réservée 60 jours à compter de la saisie ; elle
 * est validée au premier rendez-vous qui a EU LIEU, s'il a été PRIS pendant ces 60 jours (il peut
 * se tenir après) ; la protection de six mois part du jour du rendez-vous tenu ; un rendez-vous
 * pris AVANT la saisie ne compte pas.
 *
 * Les contrats 2.6 et antérieurs restent sous la confirmation par le silence (`regles.ts`, art. 3.2).
 * `basculeVersRendezVous` (26/11/2026, décision de Will) : une présentation EN ATTENTE, faite sous
 * l'ancienne règle par un apporteur déjà en 2.8, passe à la règle du rendez-vous.
 *
 * ⚠️ Module PUR : ni base, ni environnement, ni `server-only`. L'interrupteur vit à part
 * (`interrupteur-rendez-vous.ts`) et se passe en argument (`regleDe(signature, actif)`).
 */

import { PROTECTION_MOIS, ajouterMois, finDuNiemeJourParis } from "./regles";

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
 * Fin de la réservation provisoire (décision N1) : la FIN du 60e jour calendaire (Paris), le jour de la
 * saisie étant le jour 1, quelle que soit l'heure de la saisie (23:59:59.999 Paris, borne incluse).
 * Même règle pour les fenêtres « rendez-vous pris » et « devis signé » dans les 60 jours : elles
 * lisent toutes `reserveeJusquAt`, donc cette fonction.
 */
export function finReservation(recueAt: Date): Date {
  return finDuNiemeJourParis(recueAt, RESERVATION_PROVISOIRE_JOURS);
}

/** Fin de la protection : six mois à compter du rendez-vous TENU. */
export function finDeProtectionRendezVous(rendezVousAt: Date): Date {
  return ajouterMois(rendezVousAt, PROTECTION_MOIS);
}

/** Délai minimal laissé à l'apporteur, à compter de la bascule, pour obtenir le rendez-vous (contrat 2.8, art. 13.5). */
export const DELAI_MINIMAL_BASCULE_JOURS = 30;

/**
 * Terme de la réservation d'une présentation BASCULÉE : le plus tardif du terme normal (fin du
 * 60e jour depuis la saisie) et de la date de bascule + 30 jours (art. 13.5, clause transitoire).
 */
export function termeApresBascule(recueAt: Date, maintenant: Date): Date {
  const normal = finReservation(recueAt);
  const minimal = new Date(maintenant.getTime() + DELAI_MINIMAL_BASCULE_JOURS * 86_400_000);
  return normal.getTime() >= minimal.getTime() ? normal : minimal;
}

export type MotifBasculeRefusee =
  | "interrupteur"
  | "version"
  | "statut_apporteur"
  | "silence_acquis"
  | "deja_reglee"
  | "rebond"
  | "terme_depasse";

/**
 * Cette présentation EN ATTENTE (`reservee`, sans ligne de réservation) passe-t-elle de l'ancienne
 * règle (silence) à la règle du rendez-vous ? Oui si l'interrupteur est allumé, l'apporteur est
 * `signe` à la version 2.8 ou plus, la date du silence n'est pas déjà atteinte (la présentation est alors
 * acquise, la confirmation tacite la traite) et le terme (`finReservation`) n'est pas déjà dépassé. Une prise de contact revenue en
 * erreur suspend l'ancienne règle sans limite : la présentation peut avoir plus de 60 jours, elle
 * n'est pas basculée (l'appelant la signale). Ne modifie rien, rend le terme à enregistrer
 * (`termeApresBascule` : au moins 30 jours à compter de la bascule).
 */
export function basculeVersRendezVous(e: {
  statut: string;
  recueAt: Date;
  apporteur: { statut: string; signature: unknown };
  /** La date de confirmation par le silence est atteinte : la présentation est déjà acquise (art. 3.2). */
  silenceAtteint: boolean;
  aUneLigne: boolean;
  rebond: boolean;
  actif: boolean;
  maintenant: Date;
}): { bascule: true; reserveeJusquAt: Date } | { bascule: false; motif: MotifBasculeRefusee } {
  if (e.actif !== true) return { bascule: false, motif: "interrupteur" };
  if (e.statut !== "reservee" || e.aUneLigne) return { bascule: false, motif: "deja_reglee" };
  if (e.apporteur.statut !== "signe") return { bascule: false, motif: "statut_apporteur" };
  if (!versionAuMoins(e.apporteur.signature, VERSION_REGLE_RENDEZ_VOUS))
    return { bascule: false, motif: "version" };
  if (e.rebond) return { bascule: false, motif: "rebond" };
  if (e.silenceAtteint) return { bascule: false, motif: "silence_acquis" };
  const terme = finReservation(e.recueAt);
  if (!(terme.getTime() >= e.maintenant.getTime()))
    return { bascule: false, motif: "terme_depasse" };
  return { bascule: true, reserveeJusquAt: termeApresBascule(e.recueAt, e.maintenant) };
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
  /**
   * Date à laquelle AXION IA a annulé ce rendez-vous : il est alors RÉPUTÉ TENU à la date à laquelle il était FIXÉ (contrat 2.8, art. 3.2), et cette date doit être passée (Axion
   * ne peut pas empêcher une validation en annulant). Une annulation, une absence ou un report
   * par l'ENTREPRISE ne se transmet JAMAIS ici : il ne valide pas. Le silence d'Axion non plus.
   */
  annuleParAxionAt?: Date | null;
  maintenant: Date;
}): { ok: true } | { ok: false; motif: MotifRendezVousRefuse } {
  const pris = e.prisAt.getTime();
  if (!(pris >= e.recueAt.getTime())) return { ok: false, motif: "pris_avant_saisie" };
  if (!(pris <= e.reserveeJusquAt.getTime())) return { ok: false, motif: "pris_apres_reservation" };
  const tenu = (e.tenuAt ?? e.annuleParAxionAt)?.getTime();
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
  rendezVousEnAttentePrisAt?: Date | null | undefined;
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
  const pris = r.rendezVousEnAttentePrisAt?.getTime();
  if (pris === undefined) return false;
  return !(pris < r.recueAt.getTime()) && !(pris > r.reserveeJusquAt.getTime());
}

/**
 * La réservation d'une présentation, telle que la lisent les gardes d'occupation (`reservationOccupe`) :
 * la saisie (`recueAt`), le terme, et la prise d'un rendez-vous encore à tenir. `null` sans ligne.
 */
export function versReservationProvisoire(
  recueAt: Date,
  r:
    | { reserveeJusquAt: Date; rendezVousPrisAt?: Date | null; valideeAt?: Date | null }
    | null
    | undefined,
): ReservationProvisoire | null {
  if (!r) return null;
  return {
    recueAt,
    reserveeJusquAt: r.reserveeJusquAt,
    // Un rendez-vous déjà validé n'est plus « à tenir ».
    rendezVousEnAttentePrisAt: r.valideeAt ? null : (r.rendezVousPrisAt ?? null),
  };
}
