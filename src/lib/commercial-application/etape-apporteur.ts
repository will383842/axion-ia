// Où en est un candidat apporteur — l'axe de progression, et lui seul
// (2026-09-21).
//
// ── Pourquoi ce module existe ─────────────────────────────────────────────
// La console montrait UNE LIGNE PAR FORMULAIRE. Une personne qui laisse ses
// cinq champs, revient valider l'écran 1, puis envoie son dossier complet
// occupait TROIS lignes, sans que rien ne dise qu'il s'agit de la même
// personne. Mesuré en production le 19/09 (R2) : 2 personnes sur 2 lignes côté
// apporteurs, 6 personnes sur 2 lignes côté carrières, 1 personne présente des
// deux côtés.
//
// 🔴 CE N'EST PAS UN PROBLÈME D'AFFICHAGE. Trois lignes, c'est trois fois le
// geste : trois fois « archiver », trois invitations possibles, et un compteur
// « 17 à traiter » qui décrit 12 personnes. Le doublon d'invitation est
// d'ailleurs déjà protégé — par personne, pas par ligne — précisément parce que
// la ligne n'est pas la bonne unité.
//
// ── L'axe, et ce qui n'en fait pas partie ────────────────────────────────
// Trois valeurs, strictement ordonnées, toutes dérivées du seul `details` :
//
//   1. premier contact   — cinq champs laissés (ou saisis par nous)
//   2. dossier commencé  — écran 1 validé, dossier pas terminé
//   3. dossier complet   — le dossier est arrivé
//
// ⚠️ « Invité » et « échange réservé » n'en font PAS partie, et c'est délibéré :
// ils ne vivent pas dans `details` (l'un dans le journal des envois, l'autre
// dans `calendly_events`). Les faire entrer ici obligerait ce module à lire la
// base — il deviendrait impur, et il entre dans le graphe du worker. Même
// raison que `est-apporteur.ts`, qui porte l'avertissement en toutes lettres.
//
// Module PUR : aucun import serveur, jamais.

import { ORIGINE_ECRAN_1_DOSSIER, ORIGINE_SAISIE_MANUELLE } from "../contact/accuse-attendu";
import { LEAD_APPORTEUR_ETAPE } from "./lead-apporteur";

export type EtapeApporteur = "premier-contact" | "dossier-commence" | "dossier-complet";

/**
 * Le rang, qui sert à comparer. 🔑 Il est écrit ICI et nulle part ailleurs :
 * un `indexOf` sur un tableau de libellés se serait décalé le jour où quelqu'un
 * réordonne l'affichage.
 */
const RANG: Readonly<Record<EtapeApporteur, number>> = {
  "premier-contact": 1,
  "dossier-commence": 2,
  "dossier-complet": 3,
};

export const LIBELLE_ETAPE: Readonly<Record<EtapeApporteur, string>> = {
  "premier-contact": "Premier contact",
  "dossier-commence": "Dossier commencé",
  "dossier-complet": "Dossier complet",
};

/**
 * L'étape d'UNE ligne, lue défensivement.
 *
 * Le JSON vient de la base et peut être n'importe quoi. Rien ne doit lever :
 * ce code tourne dans une liste de console, et une exception y rendrait une
 * page blanche au lieu d'une ligne imparfaite.
 *
 * 🔑 Le repli est `dossier-complet`, et c'est le bon sens du doute : une ligne
 * apporteur sans marqueur EST un dossier arrivé par le formulaire complet —
 * c'est le cas historique, antérieur aux deux marqueurs.
 */
export function etapeDeLaLigne(details: unknown): EtapeApporteur {
  if (!details || typeof details !== "object" || Array.isArray(details)) return "dossier-complet";
  const d = details as Record<string, unknown>;
  if (d.etape === LEAD_APPORTEUR_ETAPE) return "premier-contact";
  if (d.origine === ORIGINE_SAISIE_MANUELLE) return "premier-contact";
  if (d.origine === ORIGINE_ECRAN_1_DOSSIER) return "dossier-commence";
  return "dossier-complet";
}

/**
 * L'étape la plus avancée d'un groupe de lignes.
 *
 * ⚠️ « La plus avancée », pas « la plus récente ». Quelqu'un qui envoie son
 * dossier complet puis repasse par le formulaire de premier contact n'est pas
 * revenu en arrière — et une console qui l'afficherait « premier contact »
 * ferait renvoyer une invitation à quelqu'un qui a déjà tout donné.
 */
export function etapeLaPlusAvancee(lignes: readonly { details: unknown }[]): EtapeApporteur {
  let meilleure: EtapeApporteur = "premier-contact";
  for (const l of lignes) {
    const e = etapeDeLaLigne(l.details);
    if (RANG[e] > RANG[meilleure]) meilleure = e;
  }
  return meilleure;
}

/** Comparaison explicite, pour les tests et pour tout tri d'affichage. */
export function rangEtape(e: EtapeApporteur): number {
  return RANG[e];
}
