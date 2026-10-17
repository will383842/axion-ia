/**
 * Espace formateur — les messages de la saisie d'évaluation (lot L08).
 * Codes fermés portés par l'adresse (`?evaluation=`) : aucun texte libre n'y circule.
 */

import type { IssueSaisie } from "@/server/qualiopi/pedagogie/saisie-evaluation-service";

export const MESSAGES_EVALUATION: Readonly<Record<IssueSaisie, { ok: boolean; texte: string }>> = {
  ok: {
    ok: true,
    texte: "Évaluation enregistrée. La grille d'évaluation est produite à partir de votre saisie.",
  },
  ok_sans_grille: {
    ok: true,
    texte:
      "Évaluation enregistrée. La grille d'évaluation n'a pas pu être produite à l'instant : elle le sera automatiquement.",
  },
  non_active: {
    ok: false,
    texte: "La saisie de l'évaluation n'est pas ouverte pour cette formation.",
  },
  non_membre: { ok: false, texte: "Cette formation n'est pas dans votre espace." },
  stagiaire_inconnu: { ok: false, texte: "Ce stagiaire n'est pas inscrit à cette formation." },
  invalide: {
    ok: false,
    texte:
      "Chaque objectif demande une note ET une observation (5 caractères au moins). Rien n'a été enregistré.",
  },
  dossier_clos: {
    ok: false,
    texte:
      "Le dossier de cette formation est clos : l'évaluation ne peut plus être saisie. Prévenez l'organisme.",
  },
  deja_evalue: {
    ok: false,
    texte: "Ce stagiaire a déjà une évaluation finale. Pour la corriger, prévenez l'organisme.",
  },
  erreur: {
    ok: false,
    texte: "L'évaluation n'a pas pu être enregistrée. Réessayez dans un instant.",
  },
};
