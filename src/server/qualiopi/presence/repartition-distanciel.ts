/**
 * Répartition d'une présence distancielle sur les demi-journées d'un jour.
 *
 * ## Pourquoi ce module existe
 *
 * L'import d'un relevé Zoom/Teams/Meet posait UN créneau « journée » par jour,
 * là où le présentiel en pose DEUX (matin, après-midi). Deux conséquences, dont
 * la seconde est la plus grave :
 *
 * 1. **Double comptage.** Sur une session hybride, la même journée portait trois
 *    créneaux — matin 3 h 30 + après-midi 3 h 30 + journée 7 h — soit 14 h
 *    attendues pour une journée de 7 h. Un stagiaire présent de bout en bout
 *    affichait 50 % et se voyait refuser son attestation.
 *
 * 2. **Une preuve plus faible.** `CAA Nantes 14/06/2022` (n° 20NT01403) sanctionne
 *    précisément les feuilles « signées une seule fois par jour et **non par
 *    demi-journées** », jugées « insuffisamment probantes », avec redressement au
 *    prorata — 3 h validées sur 6 h facturées. Le créneau « journée » unique
 *    était donc exactement la forme condamnée, sur ce qui représente la majorité
 *    du catalogue.
 *
 * Aligner le distanciel sur le grain demi-journée traite la cause : il n'existe
 * plus qu'une seule façon de compter une présence.
 *
 * ## Comment les minutes sont réparties
 *
 * Le relevé donne une première connexion, une dernière déconnexion, et un total
 * de minutes effectives — jamais le détail des intervalles. On ne peut donc pas
 * savoir avec certitude ce qui a été suivi le matin et ce qui l'a été l'après-
 * midi. On répartit au prorata du **recouvrement** entre la plage de connexion
 * et chaque demi-journée : c'est la seule inférence que la donnée autorise, et
 * elle est défendable — « le stagiaire était connecté entre 9 h et 12 h, cette
 * plage ne recouvre que le matin ».
 *
 * Chaque part est ensuite **plafonnée à la durée prévue** de sa demi-journée :
 * les parseurs agrègent un participant sur toute la plage du fichier, et un
 * export couvrant deux jours produirait sinon plus de réalisé que de prévu.
 *
 * Logique pure — aucun import Prisma, aucune horloge.
 */

import type { DemiJourneeLabel } from "./types";

/** Une demi-journée cible, avec sa fenêtre horaire réelle. */
export interface CreneauCible {
  demiJournee: DemiJourneeLabel;
  dureePrevueMinutes: number;
  /** Fenêtre réelle de la demi-journée, en minutes depuis minuit (heure de Paris). */
  debutMin: number;
  finMin: number;
}

/** Minutes écoulées depuis minuit pour un `HH:MM`. */
export function minutesDepuisMinuit(heure: string): number {
  return Number(heure.slice(0, 2)) * 60 + Number(heure.slice(3, 5));
}

/**
 * Découpe la fenêtre d'une journée en fenêtres de demi-journées, au pivot.
 *
 * ⚠️ Le pivot est une CONVENTION — `session_jours` ne déclare les horaires qu'au
 * grain de la journée (décision de conception assumée : découper « 09:00–17:00 »
 * en un matin « 09:00–12:30 » inventerait une pause que personne n'a saisie).
 * Il ne sert qu'à répartir, jamais à afficher un horaire sur la feuille.
 */
export function fenetreDemiJournee(
  jourHeureDebut: string,
  jourHeureFin: string,
  demiJournee: DemiJourneeLabel,
  pivot = "13:00",
): { debutMin: number; finMin: number } {
  const debut = minutesDepuisMinuit(jourHeureDebut);
  const fin = minutesDepuisMinuit(jourHeureFin);
  const p = minutesDepuisMinuit(pivot);

  if (demiJournee === "journee") return { debutMin: debut, finMin: fin };
  if (demiJournee === "matin") return { debutMin: debut, finMin: Math.min(fin, p) };
  return { debutMin: Math.max(debut, p), finMin: fin };
}

/**
 * Répartit les minutes réellement suivies sur les demi-journées d'un jour.
 *
 * @param creneaux    Demi-journées du jour, dans l'ordre d'affichage.
 * @param dureeMinutes Minutes effectives issues du relevé.
 * @param joinMin     Première connexion, minutes depuis minuit. `null` si absente.
 * @param leaveMin    Dernière déconnexion. `null` si absente.
 * @returns Minutes attribuées à chaque créneau, dans le même ordre.
 */
export function repartirMinutesConnexion(input: {
  creneaux: CreneauCible[];
  dureeMinutes: number;
  joinMin: number | null;
  leaveMin: number | null;
}): number[] {
  const { creneaux } = input;
  if (creneaux.length === 0) return [];
  if (creneaux.length === 1) {
    return [Math.max(0, Math.min(input.dureeMinutes, creneaux[0]!.dureePrevueMinutes))];
  }

  const duree = Math.max(0, Math.round(input.dureeMinutes));
  if (duree === 0) return creneaux.map(() => 0);

  // Poids = recouvrement entre la plage de connexion et la demi-journée. Sans
  // horodatage exploitable, on retombe sur la durée prévue : réparti au prorata
  // de ce qui était attendu, faute de mieux — et jamais en inventant une
  // présence sur une demi-journée que la connexion ne recouvre pas.
  const recouvrementsUtilisables =
    input.joinMin !== null && input.leaveMin !== null && input.leaveMin > input.joinMin;

  const poids = creneaux.map((c) => {
    if (!recouvrementsUtilisables) return c.dureePrevueMinutes;
    const debut = Math.max(input.joinMin as number, c.debutMin);
    const fin = Math.min(input.leaveMin as number, c.finMin);
    return Math.max(0, fin - debut);
  });

  const total = poids.reduce((s, p) => s + p, 0);
  // Une plage de connexion qui ne recouvre aucune demi-journée (connexion hors
  // horaires déclarés) : on retombe sur les durées prévues plutôt que de tout
  // attribuer à zéro, ce qui effacerait une présence réelle.
  const poidsEffectifs = total > 0 ? poids : creneaux.map((c) => c.dureePrevueMinutes);
  const totalEffectif = poidsEffectifs.reduce((s, p) => s + p, 0);
  if (totalEffectif <= 0) return creneaux.map(() => 0);

  // Plus grand reste, pour que la somme des parts vaille exactement la durée
  // relevée avant plafonnement.
  const brutes = poidsEffectifs.map((p) => (duree * p) / totalEffectif);
  const parts = brutes.map((b) => Math.floor(b));
  let reste = duree - parts.reduce((s, p) => s + p, 0);
  const ordre = brutes
    .map((b, i) => ({ i, frac: b - Math.floor(b) }))
    .sort((x, y) => y.frac - x.frac);
  for (const { i } of ordre) {
    if (reste <= 0) break;
    parts[i] = (parts[i] as number) + 1;
    reste -= 1;
  }

  // Plafond au prévu : le réalisé ne peut pas dépasser l'attendu, sinon le taux
  // dépasse 100 % — les parseurs agrègent un participant sur toute la plage du
  // fichier, et un export de deux jours le produirait.
  return parts.map((p, i) => Math.min(p, creneaux[i]!.dureePrevueMinutes));
}

/**
 * Les demi-journées RÉELLEMENT portées par une journée, dans l'ordre.
 *
 * ## Pourquoi cette fonction existe (2026-08-25)
 *
 * 🔑 Cette règle vivait **en littéral** dans `feuille-pdf.ts`, et nulle part
 * ailleurs. Toute nouvelle lecture des demi-journées attendues devait la
 * recopier — et un prédicat recopié diverge toujours : ce dépôt l'a payé
 * quatre fois. La règle d'alerte « journée déclarée sans créneau » avait
 * besoin exactement du même calcul.
 *
 * Une journée de 09:00 à 12:00 ne porte QUE le matin ; de 14:00 à 18:00, que
 * l'après-midi. Une demi-journée de durée nulle n'existe pas : l'inclure
 * ferait réclamer une signature pour un créneau qui n'a jamais eu lieu.
 *
 * ⚠️ Le grain `journee` n'est pas produit ici : il vient d'un import
 * distanciel, jamais du découpage d'une journée déclarée.
 */
export function demiJourneesDuJour(
  jourHeureDebut: string,
  jourHeureFin: string,
): DemiJourneeLabel[] {
  const portees: DemiJourneeLabel[] = [];
  for (const dj of ["matin", "apres_midi"] as const) {
    const f = fenetreDemiJournee(jourHeureDebut, jourHeureFin, dj);
    if (f.finMin > f.debutMin) portees.push(dj);
  }
  return portees;
}
