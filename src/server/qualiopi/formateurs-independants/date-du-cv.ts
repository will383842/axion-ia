/**
 * Formateurs indépendants — la DATE DU CV (décision de Will du 15/10).
 *
 * Au dépôt de son CV dans le dossier en ligne, le formateur indique la date de son CV
 * (mois et année, champ obligatoire). Elle est enregistrée sur la pièce, le 1er du mois à
 * minuit UTC, dans `dateEmission` (lue par la règle « CV de moins de 24 mois » :
 * `cvProbant`) et dans `dateCvDeclaree` (ce que le formateur a déclaré, affiché en
 * console à côté du CV). Jamais la date de dépôt.
 *
 * 🔴 Date absente, dans le futur ou de plus de 24 mois : le CV n'est pas probant, la pièce
 *    reste « à vérifier ». Rien n'est jamais accepté automatiquement.
 *
 * Module PUR : aucune base, aucune horloge implicite.
 */

import { addMonths } from "@/server/qualiopi/trainers/conformite";

import { CV_VALIDITE_MOIS } from "./garde-activation-complete";

/** Le refus, quand le champ est vide ou illisible. */
export const MESSAGE_DATE_DU_CV_MANQUANTE = "Indiquez la date de votre CV (mois et année).";

/** « 2025-03 » → le 1er mars 2025 à minuit UTC ; vide ou illisible → `null`. */
export function lireMoisDuCv(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const annee = Number(m[1]);
  const mois = Number(m[2]);
  if (annee < 1950 || mois < 1 || mois > 12) return null;
  return new Date(Date.UTC(annee, mois - 1, 1));
}

/** « mars 2025 ». */
export function moisAnneeDuCv(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/**
 * Ce que la console affiche à côté du CV (W-4) : la date déclarée par le formateur, ou
 * celle posée en console, et pourquoi elle ne vaut pas (plus de 24 mois, dans le futur).
 */
export function libelleDateDuCv(
  cv: { readonly dateCvDeclaree?: Date | null; readonly dateEmission: Date | null },
  maintenant: Date,
): string {
  const declaree = cv.dateCvDeclaree ?? null;
  const date = declaree ?? cv.dateEmission;
  if (date === null || Number.isNaN(date.getTime())) {
    return "Date du CV : non déclarée par le formateur";
  }
  const debut = declaree !== null ? "Date du CV déclarée par le formateur" : "Date du CV";
  let reserve = "";
  if (date.getTime() > maintenant.getTime()) reserve = " (dans le futur)";
  else if (addMonths(date, CV_VALIDITE_MOIS).getTime() <= maintenant.getTime()) {
    reserve = ` (plus de ${CV_VALIDITE_MOIS} mois)`;
  }
  return `${debut} : ${moisAnneeDuCv(date)}${reserve}`;
}
