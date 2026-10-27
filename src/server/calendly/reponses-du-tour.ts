// Lire le formulaire de la visio du Tour France IA (2026-10-25).
//
// Le formulaire est calqué sur celui du Diagnostic IA : secteur, nom de
// l'entreprise, « comment nous avez-vous connu », taille, tâches qui prennent le
// plus de temps, usage actuel de l'IA. Les QUESTIONS vivent chez Calendly
// (`questions.ts`) : ce module ne recopie aucun libellé, il reconnaît chaque
// question par son SENS (comme `estQuestionOrigine` ou `estQuestionEntreprise`) et
// ne lève jamais. Une question inconnue, ou sans réponse, est simplement ignorée.
//
// Module PUR : aucune lecture, aucune écriture.

import { estQuestionEntreprise, estQuestionVille } from "@/features/admin-rendezvous/a-venir";
import { estQuestionOrigine } from "@/features/admin-rendezvous/origine-rendez-vous";
import type { ReponseCrm } from "@/server/calendly/type-rendez-vous";
import { couperTexte } from "@/server/calendly/type-rendez-vous";

/** Longueur maximale d'une réponse gardée dans le profil. */
export const PROFIL_TOUR_REPONSE_MAX = 300;

export interface ProfilDuTour {
  readonly secteur: string | null;
  readonly entreprise: string | null;
  readonly origine: string | null;
  readonly taille: string | null;
  readonly taches: string | null;
  readonly usageIa: string | null;
}

export type ChampProfilTour = keyof ProfilDuTour;

function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Le champ du profil qu'une question demande, ou `null`. L'ORDRE compte : « taille
 * de l'entreprise » contient « entreprise », et une question sur les tâches peut
 * citer l'IA ; le plus précis passe d'abord.
 */
export function champDeLaQuestion(question: string): ChampProfilTour | null {
  if (estQuestionOrigine(question)) return "origine";
  const q = normaliser(question);
  if (/\b(taille|effectifs?|salaries?|collaborateurs?|employes?)\b/.test(q)) return "taille";
  if (/\btaches?\b|chronophage|plus de temps/.test(q)) return "taches";
  if (/\b(ia|intelligence artificielle|chatgpt)\b/.test(q)) return "usageIa";
  if (/\b(secteur|activite|metier|domaine)\b/.test(q)) return "secteur";
  if (estQuestionVille(question)) return null;
  if (estQuestionEntreprise(question)) return "entreprise";
  return null;
}

/**
 * Le profil lu dans les réponses du formulaire, ou `null` s'il n'en contient
 * aucune. À champ répété, la PREMIÈRE réponse non vide fait foi.
 */
export function profilDuTour(reponses: readonly ReponseCrm[]): ProfilDuTour | null {
  const profil: Record<ChampProfilTour, string | null> = {
    secteur: null,
    entreprise: null,
    origine: null,
    taille: null,
    taches: null,
    usageIa: null,
  };
  let trouve = false;
  for (const { question, reponse } of reponses) {
    const champ = champDeLaQuestion(question);
    const texte = reponse.trim();
    if (!champ || texte === "" || profil[champ] !== null) continue;
    profil[champ] = couperTexte(texte, PROFIL_TOUR_REPONSE_MAX);
    trouve = true;
  }
  return trouve ? profil : null;
}
