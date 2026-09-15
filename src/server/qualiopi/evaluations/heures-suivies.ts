/**
 * Qualiopi — Heures RÉELLEMENT suivies, à la minute.
 *
 * Module PUR (aucun I/O) : lu par le service d'attestation, les deux gabarits
 * d'attestation et l'évaluateur d'alertes.
 *
 * 🔴 2e relecture A09 (audit initial 2026-09-14). Les heures suivies étaient
 * arrondies à l'HEURE (`Math.round(taux × durée / 100)`), puis l'assiduité de la
 * pièce était recalculée depuis cet arrondi : 45 % de 3 h s'imprimait « 1 h sur
 * 3 h (33 %) », et 2 % de 14 h donnait « 0 h » — une pièce qui certifiait un
 * suivi de zéro heure. Le règlement publié promet « les heures effectivement
 * suivies » : elles se comptent en minutes et s'impriment en heures ET minutes.
 */

import { computeTauxPresence } from "@/server/qualiopi/presence/taux";

/** Minutes suivies reconstituées depuis un taux (repli sans créneau : ±0,5 % de la durée). */
export function minutesSuivies(tauxPct: number, dureeHeures: number): number {
  return Math.round((tauxPct * dureeHeures * 60) / 100);
}

/** Un créneau de présence, tel que le lit `computeTauxPresence`. */
export interface CreneauMesure {
  dureePrevueMinutes: number;
  dureeRealiseeMinutes: number;
  date?: Date | string;
  demiJournee?: "matin" | "apres_midi" | "journee";
}

/** Ce qu'on sait de la présence d'une inscription. */
export interface PresenceMesuree {
  tauxPresencePct: number | null | undefined;
  creneaux?: ReadonlyArray<CreneauMesure> | null | undefined;
}

/**
 * 🔴 3e relecture A09 — la SEULE définition du « 0 h », lue par le service
 * d'attestation, le certificat de réalisation, l'e-mail et les alertes.
 *
 * Aucune minute réalisée sur les créneaux de présence quand il en existe ;
 * sans créneau, taux strictement nul. Le taux entier seul ne suffit pas : 20
 * minutes sur 70 h l'arrondissent à 0 %, et la pièce aurait dit « n'a suivi
 * aucune heure ». Indépendante de la durée : snapshot légal ou lecture live, le
 * verdict est le même.
 */
export function aucuneHeureSuivie(p: PresenceMesuree): boolean {
  const creneaux = p.creneaux ?? [];
  if (creneaux.length > 0) return computeTauxPresence([...creneaux]).minutesRealisees === 0;
  return p.tauxPresencePct === 0;
}

/**
 * 🔴 3e relecture A09 — minutes suivies à imprimer, MÊME calcul pour
 * l'attestation et le certificat de réalisation d'un même stagiaire.
 *
 * Durée suivie calculée à partir de la proportion des minutes réalisées sur les
 * minutes prévues des créneaux, appliquée à la durée de référence ; sans
 * créneau, sur le taux. Un suivi non nul ne s'imprime
 * jamais « 0 h » : au moins une minute. À n'appeler qu'avec un taux MESURÉ.
 */
export function minutesSuiviesPresence(p: PresenceMesuree, dureeHeures: number): number {
  if (aucuneHeureSuivie(p)) return 0;
  const creneaux = p.creneaux ?? [];
  let minutes = minutesSuivies(p.tauxPresencePct ?? 0, dureeHeures);
  if (creneaux.length > 0) {
    const { minutesRealisees, minutesPrevues } = computeTauxPresence([...creneaux]);
    if (minutesPrevues > 0) {
      minutes = Math.round((minutesRealisees / minutesPrevues) * dureeHeures * 60);
    }
  }
  return Math.max(1, minutes);
}

/**
 * 🔴 4e relecture A09 — la durée de référence, MÊME repli pour l'attestation et
 * le certificat de réalisation : durée réelle de la session, sinon durée du
 * snapshot légal, sinon durée du catalogue.
 *
 * Un snapshot légal existant SANS durée faisait retomber l'attestation à 0 h
 * prévues pendant que le certificat prenait la durée du catalogue.
 */
export function dureeReferenceHeures(d: {
  dureeReelleHeures: number | null | undefined;
  dureeSnapshotHeures: number | null | undefined;
  dureeCatalogueHeures: number | null | undefined;
}): number {
  return d.dureeReelleHeures ?? d.dureeSnapshotHeures ?? d.dureeCatalogueHeures ?? 0;
}

/** « 6 h 30 », « 7 h », « 0 h » — jamais « 6,5 h ». */
export function heuresMinutesFr(heures: number): string {
  const total = Math.round(heures * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/** Assiduité calculée sur les MINUTES, pas sur des heures arrondies. */
export function assiduiteSurMinutes(heuresSuivies: number, heuresTotales: number): string {
  const totales = Math.round(heuresTotales * 60);
  if (totales === 0) return "—";
  return `${Math.round((Math.round(heuresSuivies * 60) / totales) * 100)} %`;
}
