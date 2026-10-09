/**
 * « RETENUE → FICHE FORMATEUR » — les règles pures de la passerelle (L10,
 * chantier « candidatures unifiées », paquet 4a).
 *
 * Avant : un formateur recruté par une offre d'emploi devait être RESSAISI dans
 * Qualiopi › Formateurs — nom, adresse, téléphone, CV recopiés à la main depuis
 * sa candidature. La passerelle crée la fiche depuis le dossier, par l'action
 * existante (`createTrainerAction`), et relie les deux par
 * `JobApplication.trainerId`.
 *
 * Module PUR (aucun import serveur) : la page de la candidature, la fiche
 * formateur et l'action le partagent, et un test le lit sans base.
 */

import type { JobApplicationStatus } from "../../../prisma/generated/client";
import {
  estCandidatureFormateurFreelance,
  type IndicesPosteCandidature,
} from "./formateur-freelance";

/**
 * La mention que porte une fiche née sans numéro de déclaration d'activité.
 *
 * 🔴 Règle de Will : AUCUN formateur externe actif sans ce numéro. La fiche
 * née d'une candidature n'en porte pas de vérifié, donc elle naît INACTIVE, et
 * cette phrase dit ce qui reste à faire : le confirmer par une pièce du
 * dossier — un numéro déclaratif ne suffit pas.
 */
export const MENTION_NDA_A_DEMANDER =
  "Numéro de déclaration d'activité à confirmer dans le dossier";

/**
 * L'état qui ouvre la passerelle : « Recrutée » (`hired`). C'est le seul où la
 * personne est retenue ET l'a accepté ; « Proposition faite » attend encore sa
 * réponse, et une fiche créée trop tôt serait une fiche à défaire.
 */
export const STATUT_OUVRANT_LA_FICHE_FORMATEUR: JobApplicationStatus = "hired";

/**
 * Une offre de FORMATEUR. Aucune catégorie ne le dit (`JobCategory` n'a pas de
 * valeur « formation » : les deux offres du catalogue sont rangées en
 * `conseil`). Le slug le dit (`formateur-ia-itinerant`,
 * `formateur-ia-sedentaire`) ; le TITRE FIGÉ le dit aussi, et lui survit à la
 * suppression de l'offre.
 */
export function estOffreFormateur(
  offerSlug: string | null | undefined,
  offerTitleSnap: string | null | undefined,
): boolean {
  if (offerSlug && /^format(eur|rice)\b/.test(offerSlug)) return true;
  return /\bformat(eur|rice)s?\b/i.test(offerTitleSnap ?? "");
}

/** Candidature de formateur, freelance ou salarié. */
export function estCandidatureFormateur(c: IndicesPosteCandidature): boolean {
  return estOffreFormateur(c.offerSlug, c.offerTitleSnap) || estCandidatureFormateurFreelance(c);
}

/**
 * La passerelle s'ouvre-t-elle ?
 *
 * Une candidature de formateur FREELANCE l'ouvre à toute étape : on ne
 * « recrute » pas un sous-traitant, on référence un prestataire, et sa fiche
 * (inactive) précède la vérification du dossier. Toute autre candidature de
 * formateur attend « Recrutée ».
 */
export function peutCreerFicheFormateur(
  c: {
    status: JobApplicationStatus;
    offerSlug: string | null | undefined;
    offerTitleSnap: string | null | undefined;
  } & Partial<Pick<IndicesPosteCandidature, "employmentType" | "secondaryEmploymentType">>,
): boolean {
  const indices: IndicesPosteCandidature = {
    offerSlug: c.offerSlug,
    offerTitleSnap: c.offerTitleSnap,
    employmentType: c.employmentType,
    secondaryEmploymentType: c.secondaryEmploymentType,
  };
  if (estCandidatureFormateurFreelance(indices)) return true;
  return c.status === STATUT_OUVRANT_LA_FICHE_FORMATEUR && estCandidatureFormateur(indices);
}

/** Types schema.org qui disent un contrat de travail SALARIÉ. */
const TYPES_SALARIES: readonly string[] = ["FULL_TIME", "PART_TIME", "TEMPORARY"];

/**
 * Statut de la fiche, ou `null` quand rien ne permet de le dire.
 *
 * 🔴 JAMAIS `salarie` PAR DÉFAUT : une spontanée « Formateur IA indépendant »
 * en serait devenue un salarié. L'ordre :
 *   1. candidature de formateur FREELANCE → `sous_traitant` (même une offre
 *      étiquetée freelance mais saisie FULL_TIME) ;
 *   2. offre salariée EXPLICITE (FULL_TIME, PART_TIME, TEMPORARY) → `salarie` ;
 *   3. tout le reste (spontanée sans indice, offre supprimée, type inconnu)
 *      → `null` : l'administrateur choisit dans le bouton.
 */
export function statutFormateurDepuisOffre(
  c: IndicesPosteCandidature,
): "salarie" | "sous_traitant" | null {
  if (estCandidatureFormateurFreelance(c)) return "sous_traitant";
  if (c.employmentType && TYPES_SALARIES.includes(c.employmentType)) return "salarie";
  return null;
}

/**
 * La mention à afficher sur une fiche formateur, ou `null`.
 *
 * Calculée, jamais stockée : elle disparaît d'elle-même dès que le numéro est
 * saisi ou que la fiche est activée — une note écrite à la création resterait,
 * elle, fausse le lendemain.
 */
export function mentionActivationFormateur(t: {
  actif: boolean;
  sousTraitantNda: string | null | undefined;
}): string | null {
  if (t.actif) return null;
  if (t.sousTraitantNda && t.sousTraitantNda.trim() !== "") return null;
  return MENTION_NDA_A_DEMANDER;
}
