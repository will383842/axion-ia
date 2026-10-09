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
import type { IndicesPosteCandidature } from "./formateur-freelance";

/**
 * La mention que porte une fiche née sans numéro de déclaration d'activité.
 *
 * 🔴 Règle de Will : AUCUN formateur externe actif sans ce numéro. Une
 * candidature ne le porte jamais — le formulaire ne le demande pas — donc la
 * fiche née d'une candidature naît INACTIVE, et cette phrase dit pourquoi.
 */
export const MENTION_NDA_A_DEMANDER = "Numéro de déclaration à demander";

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

export function peutCreerFicheFormateur(c: {
  status: JobApplicationStatus;
  offerSlug: string | null | undefined;
  offerTitleSnap: string | null | undefined;
}): boolean {
  return (
    c.status === STATUT_OUVRANT_LA_FICHE_FORMATEUR &&
    estOffreFormateur(c.offerSlug, c.offerTitleSnap)
  );
}

/**
 * Statut de la fiche, lu sur le contrat de l'offre : une offre en freelance
 * (`CONTRACTOR`, en type principal ou second) recrute un SOUS-TRAITANT ; toute
 * autre, un salarié. Le statut se corrige ensuite sur la fiche.
 */
export function statutFormateurDepuisOffre(
  c: IndicesPosteCandidature,
): "salarie" | "sous_traitant" | null {
  return c.employmentType === "CONTRACTOR" || c.secondaryEmploymentType === "CONTRACTOR"
    ? "sous_traitant"
    : "salarie";
}

// Échafaudage U3 (premier commit, tests rouges).
export function estCandidatureFormateur(c: IndicesPosteCandidature): boolean {
  return estOffreFormateur(c.offerSlug, c.offerTitleSnap);
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
