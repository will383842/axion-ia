/**
 * Qualiopi ind. 21 — ce que l'ACTIVATION d'un indépendant exige EN PLUS des règles
 * existantes, sous la règle provisoire (console) comme sous la règle complète
 * (`formateurs.activation_auto`). Composé par l'écrivain unique (`activation.ts`) :
 * aucun chemin d'activation n'y échappe, et aucun interrupteur ne le coupe.
 *
 *   1. entretien noté versé ;
 *   2. mise en situation versée ;
 *   3. au moins une formation avec une décision « habilité » ou « avec réserve » en
 *      vigueur ;
 *   4. formation à la méthode cochée « suivie », datée (décision de Will) ;
 *   5. pièces : CV validé de moins de 24 mois (date déclarée par le formateur, #1551),
 *      SIRET actif (dernier contrôle du registre vert ou orange validé, sur le SIRET de
 *      la fiche), numéro de déclaration d'activité de 11 chiffres (« en cours », « pas
 *      encore de numéro » ne sont plus acceptés).
 *
 * La règle complète juge déjà le CV et le SIRET (mêmes fonctions) : sous elle, seuls
 * 1 à 4 et le numéro sont ajoutés, pour ne pas dire deux fois le même manque.
 * L'attestation URSSAF garde sa règle existante (exigée à partir du seuil) : ce module
 * n'y touche pas.
 *
 * 🔴 Module PUR, garde FERMÉE : un fait non lu (`undefined`) est un manque.
 */

import type { DocumentConformite } from "@/server/qualiopi/trainers/conformite";

import { etatControle } from "../controle-regles";
import { cvProbant, MANQUES_COMPLETS, type ControleLu } from "../garde-activation-complete";
import { ndaEstEnCours } from "../nda-en-cours";
import { manquesEvaluationActivation, type LigneEvaluationLue } from "./regles";

export interface FaitsActivationQ21 {
  readonly evaluations?: ReadonlyArray<LigneEvaluationLue>;
  readonly siret?: string | null;
  readonly nda?: string | null;
  readonly controles?: ReadonlyArray<ControleLu>;
  /** Pièces du formateur ; le CV doit y être, avec son fichier. */
  readonly pieces?: ReadonlyArray<DocumentConformite>;
}

export const MANQUES_Q21 = {
  cv: MANQUES_COMPLETS.cv,
  siret:
    "Le SIRET n'est pas vérifié actif : le dernier contrôle du registre, sur le SIRET de la fiche, n'est pas vert ni orange validé, ou il a plus de 30 jours.",
  nda: "Le numéro de déclaration d'activité n'est pas renseigné.",
  ndaEnCours:
    "Le numéro de déclaration d'activité est encore « en cours » : il est obligatoire pour activer le formateur.",
  ndaInvalide: "Le numéro de déclaration d'activité saisi n'a pas 11 chiffres.",
  erreur: "Le contrôle des compétences n'a pas pu aboutir : activation refusée par prudence.",
} as const;

const siretNet = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, "");

/** SIRET actif : présent, contrôlé au registre (probant, < 30 jours), et le même. */
export function siretActif(
  siret: string | null | undefined,
  controles: ReadonlyArray<ControleLu> | undefined,
  maintenant: Date,
): boolean {
  const s = siretNet(siret);
  if (s === "" || controles === undefined || controles.length === 0) return false;
  const dernier = [...controles].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]!;
  return siretNet(dernier.siret) === s && etatControle(controles, maintenant).probant;
}

export function manquesActivationQ21(
  f: FaitsActivationQ21,
  regle: "provisoire" | "complete",
  maintenant: Date = new Date(),
): string[] {
  try {
    const manques = manquesEvaluationActivation(f.evaluations);
    if (regle === "provisoire") {
      if (!cvProbant(f.pieces ?? [], maintenant)) manques.push(MANQUES_Q21.cv);
      if (!siretActif(f.siret, f.controles, maintenant)) manques.push(MANQUES_Q21.siret);
    }
    const nda = (f.nda ?? "").trim();
    if (nda === "") manques.push(MANQUES_Q21.nda);
    else if (ndaEstEnCours(nda)) manques.push(MANQUES_Q21.ndaEnCours);
    else if (!/^\d{11}$/.test(nda.replace(/\s+/g, ""))) manques.push(MANQUES_Q21.ndaInvalide);
    return manques;
  } catch {
    return [MANQUES_Q21.erreur];
  }
}
