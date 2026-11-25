// Les lignes de « Comment ça se passe » (déclaration d'entreprise). Module SERVEUR : la page
// les calcule et les passe en props au composant client, qui n'importe donc ni ces textes ni
// `regle-attribution` (budget de poids du bucket « Routes /apporteur/dossier »).
// Vouvoiement, aucun engagement de délai. Textes inchangés (déplacés tels quels).

import type { RegleAttribution } from "@/features/apporteurs-reseau/regle-attribution";

export const comment = (mois: number) =>
  [
    "Après votre déclaration, nous prenons contact avec l'entreprise de votre part.",
    `Cet établissement vous est réservé ${mois} mois à compter de votre déclaration. Si vous avez rencontré la direction de l'entreprise, écrivez-nous : nous pouvons étendre votre réservation à toute l'entreprise.`,
    "Si elle a déjà été présentée ou nous est déjà connue, nous vous le disons.",
    "Toute commande signée pendant cette période vous est commissionnée, dès que la prestation est réalisée et entièrement payée.",
  ] as const;
// Lot 7b — validation par rendez-vous (contrat ≥ 2.8, interrupteur allumé) SEULEMENT. Les
// apporteurs sous le contrat 2.6 gardent `comment` ci-dessus, mot pour mot. Aucun objectif,
// aucun nombre, aucune relance. ⚠️ À RELIRE par le dirigeant (liste dans la PR).
export const commentRendezVous = (jours: number, mois: number) =>
  [
    "Après votre déclaration, nous prenons contact avec l'entreprise de votre part.",
    `Cette entreprise vous est gardée ${jours} jours à compter de votre déclaration.`,
    `Elle est validée à votre nom dès qu'un premier rendez-vous avec Axion-IA a eu lieu, s'il a été pris pendant ces ${jours} jours. Les ${mois} mois pendant lesquels elle vous est rattachée partent alors du jour de ce rendez-vous.`,
    `Un devis signé pendant ces ${jours} jours compte aussi.`,
    "Si elle a déjà été présentée ou nous est déjà connue, nous vous le disons.",
    "Une commission n'est due que sur une commande payée.",
  ] as const;

/** Les lignes à afficher, selon la règle de l'apporteur (`regleDe`). */
export function lignesComment(
  regle: RegleAttribution,
  protectionMois: number,
  reservationJours: number,
): readonly string[] {
  return regle === "rendez_vous"
    ? commentRendezVous(reservationJours, protectionMois)
    : comment(protectionMois);
}
