/**
 * Qualiopi — Formation Engine : CONTRÔLE QUALITÉ du contenu détaillé.
 *
 * Module PUR (aucune I/O, aucun appel IA). Évalue de façon DÉTERMINISTE la
 * complétude pédagogique d'un `ContenuDetaille` selon les meilleures pratiques
 * Qualiopi (RNQ) — pendant « supports » de la grille qualité du programme :
 *
 *  - indicateur 9 : ≥ 60 % de séquences à visée pratique (exercice présent) ;
 *  - chaque séquence : ≥ 1 concept expliqué + un exemple concret ;
 *  - chaque exercice : un corrigé + des critères de réussite observables ;
 *  - chaque module : une synthèse + au moins une question de quiz (éval formative) ;
 *  - adaptation à la modalité présente là où c'est pertinent.
 *
 * Produit un score /100, un verdict et la liste des manques → tracé dans la
 * FileValidation (aide le validateur humain) et sert de garde qualité douce.
 * Ne dépend PAS d'un appel LLM (0 coût, reproductible, production-safe).
 */

import type { ContenuDetaille } from "@/server/qualiopi/engine/content-schema";

export type QualiteVerdict = "excellent" | "correct" | "insuffisant";

export interface QualiteContenuResult {
  /** Score global 0-100. */
  score: number;
  verdict: QualiteVerdict;
  /** Ratio de séquences avec exercice (indicateur 9). */
  ratioPratique: number;
  /** Manques repérés (libellés lisibles), triés par importance. */
  manques: string[];
  /** Détail chiffré (traçabilité). */
  stats: {
    nbModules: number;
    nbSequences: number;
    nbSequencesAvecExercice: number;
    nbSequencesAvecExemple: number;
    nbModulesAvecQuiz: number;
    nbModulesAvecSynthese: number;
  };
}

const RATIO_PRATIQUE_MIN = 0.6; // Qualiopi indicateur 9

/**
 * Évalue la qualité pédagogique d'un contenu détaillé. Pur & déterministe.
 */
export function evaluateContenuDetailleQuality(contenu: ContenuDetaille): QualiteContenuResult {
  const manques: string[] = [];
  const modules = contenu.modules;
  const nbModules = modules.length;

  let nbSequences = 0;
  let nbSequencesAvecExercice = 0;
  let nbSequencesAvecExemple = 0;
  let nbModulesAvecQuiz = 0;
  let nbModulesAvecSynthese = 0;

  if (nbModules === 0) {
    manques.push("Aucun module de contenu généré.");
  }

  for (const mod of modules) {
    if (mod.synthese && mod.synthese.trim().length >= 20) nbModulesAvecSynthese++;
    else manques.push(`Module « ${mod.titre} » : synthèse manquante ou trop courte.`);

    if (mod.quiz.length > 0) nbModulesAvecQuiz++;
    else manques.push(`Module « ${mod.titre} » : aucune question de quiz (évaluation formative).`);

    for (const seq of mod.sequences) {
      nbSequences++;
      if (seq.concepts.length === 0) {
        manques.push(`Séquence « ${seq.titre} » : aucun concept expliqué.`);
      }
      if (seq.exempleConcret && seq.exempleConcret.trim().length >= 20) nbSequencesAvecExemple++;
      else manques.push(`Séquence « ${seq.titre} » : exemple concret absent ou trop court.`);

      if (seq.exercice) {
        nbSequencesAvecExercice++;
        if (!seq.exercice.corrige || seq.exercice.corrige.trim().length < 10) {
          manques.push(`Séquence « ${seq.titre} » : exercice sans corrigé exploitable.`);
        }
        if (seq.exercice.criteresReussite.length === 0) {
          manques.push(`Séquence « ${seq.titre} » : exercice sans critère de réussite.`);
        }
      }
    }
  }

  const ratioPratique = nbSequences > 0 ? nbSequencesAvecExercice / nbSequences : 0;
  if (nbSequences > 0 && ratioPratique < RATIO_PRATIQUE_MIN) {
    manques.push(
      `Ratio pratique ${(ratioPratique * 100).toFixed(0)} % < 60 % attendu (Qualiopi indicateur 9).`,
    );
  }

  // ── Scoring pondéré (somme = 100) ──
  const pct = (num: number, den: number): number => (den > 0 ? num / den : 0);
  let score = 0;
  score += 25 * pct(nbSequencesAvecExemple, nbSequences); // exemples concrets
  score += 25 * Math.min(1, ratioPratique / RATIO_PRATIQUE_MIN); // ratio pratique (plafonné à la cible)
  score += 20 * pct(nbModulesAvecQuiz, nbModules); // évaluation formative
  score += 15 * pct(nbModulesAvecSynthese, nbModules); // synthèses
  // Corrigés + critères présents sur toutes les séquences pratiques
  const seqPratiquesCompletes = modules
    .flatMap((m) => m.sequences)
    .filter(
      (s) =>
        s.exercice &&
        s.exercice.corrige.trim().length >= 10 &&
        s.exercice.criteresReussite.length > 0,
    ).length;
  score += 15 * pct(seqPratiquesCompletes, nbSequencesAvecExercice);
  const scoreArrondi = nbModules === 0 ? 0 : Math.round(score);

  // « Excellent » exige AUSSI le ratio pratique Qualiopi (indicateur 9) : une
  // formation trop théorique ne peut pas être notée excellente, quel que soit le
  // reste.
  const ratioOk = ratioPratique >= RATIO_PRATIQUE_MIN;
  const verdict: QualiteVerdict =
    nbModules === 0
      ? "insuffisant"
      : scoreArrondi >= 85 && ratioOk
        ? "excellent"
        : scoreArrondi >= 70
          ? "correct"
          : "insuffisant";

  return {
    score: scoreArrondi,
    verdict,
    ratioPratique,
    manques,
    stats: {
      nbModules,
      nbSequences,
      nbSequencesAvecExercice,
      nbSequencesAvecExemple,
      nbModulesAvecQuiz,
      nbModulesAvecSynthese,
    },
  };
}
