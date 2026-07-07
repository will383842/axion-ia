/**
 * Qualiopi — Formation Engine : RÈGLES PÉDAGOGIQUES PAR MODALITÉ.
 *
 * Module PUR — aucun import Prisma/Next/DB. Source unique de vérité des
 * consignes d'adaptation présentiel / distanciel / hybride, utilisée à deux
 * endroits :
 *  1. Prompts IA (structure + contenu) → l'IA conçoit un déroulé réellement
 *     adapté à la modalité (avant ce module, la modalité était mentionnée mais
 *     aucune règle spécifique n'était injectée → contenu identique partout).
 *  2. Builders de supports → guide d'animation / notes adaptés à la modalité.
 *
 * Réf. Qualiopi : indicateur 9 (adaptation des modalités), indicateur 12 (suivi
 * de l'assiduité — le distanciel s'appuie sur le relevé de connexion), et le
 * décret FOAD (D.6313-3-1) pour la formation ouverte et à distance.
 */

export type Modalite = "presentiel" | "distanciel" | "hybride";

/** Normalise une valeur libre de modalité vers l'une des 3 modalités canoniques. */
export function normaliserModalite(value: string | null | undefined): Modalite {
  const v = (value ?? "").toLowerCase();
  if (v.includes("distanc") || v.includes("foad") || v.includes("visio")) return "distanciel";
  if (v.includes("hybrid") || v.includes("mixte") || v.includes("blended")) return "hybride";
  return "presentiel";
}

/** Libellé lisible de la modalité (titres de supports, PDF). */
export function libelleModalite(modalite: Modalite): string {
  switch (modalite) {
    case "distanciel":
      return "À distance (classe virtuelle)";
    case "hybride":
      return "Hybride (présentiel + distanciel)";
    default:
      return "En présentiel";
  }
}

// ── Règles injectées dans les prompts IA ──────────────────────────────────────

const REGLES_PRESENTIEL = [
  "Modalité PRÉSENTIEL (salle) :",
  "- Privilégier les ateliers en salle, le travail en binômes/sous-groupes, les mises en situation physiques.",
  "- Exploiter le tableau/paperboard et la circulation du formateur entre les postes.",
  "- Rythmer par des temps collectifs debout (icebreaker, restitution) pour maintenir l'énergie.",
  "- Prévoir une pause toutes les ~90 minutes.",
].join("\n");

const REGLES_DISTANCIEL = [
  "Modalité DISTANCIEL (classe virtuelle synchrone) :",
  "- Concevoir pour la visio : séquences plus courtes (15-20 min max sans interaction), alternance stricte théorie/pratique.",
  "- Utiliser des breakout rooms pour les exercices en sous-groupes, un document collaboratif partagé, le chat et les sondages pour l'interactivité.",
  "- Intégrer une PAUSE ÉCRAN toutes les ~45 minutes (fatigue visuelle) et des activités caméra/hors-écran.",
  "- Donner des consignes explicites d'outils (partage d'écran, main levée, annotation).",
  "- L'assiduité est tracée via le relevé de connexion (indicateur 12) — prévoir des jalons de présence actifs.",
].join("\n");

const REGLES_HYBRIDE = [
  "Modalité HYBRIDE (présentiel + distanciel) :",
  "- Répartir explicitement ce qui se fait en présentiel (ateliers, mises en situation) vs à distance (apports, entraînement autonome, classe virtuelle).",
  "- Assurer la continuité pédagogique entre les temps : un livrable produit à distance est réutilisé en présentiel et inversement.",
  "- Adapter chaque activité aux contraintes des deux formats (voir règles présentiel et distanciel).",
].join("\n");

/**
 * Bloc de consignes d'adaptation à injecter dans un prompt IA (structure/contenu).
 */
export function reglesModalitePourPrompt(modalite: Modalite): string {
  switch (modalite) {
    case "distanciel":
      return REGLES_DISTANCIEL;
    case "hybride":
      return `${REGLES_HYBRIDE}\n\n${REGLES_PRESENTIEL}\n\n${REGLES_DISTANCIEL}`;
    default:
      return REGLES_PRESENTIEL;
  }
}

// ── Consignes courtes pour les notes d'animation des supports ─────────────────

/**
 * Rappel synthétique (1 ligne) affiché dans le guide d'animation / notes
 * formateur d'un support, selon la modalité.
 */
export function rappelAnimationModalite(modalite: Modalite): string {
  switch (modalite) {
    case "distanciel":
      return "À distance : caméra encouragée, pause écran toutes les ~45 min, exercices en breakout room, sondages pour vérifier la compréhension.";
    case "hybride":
      return "Hybride : articuler présentiel (ateliers) et distanciel (apports, entraînement) ; réutiliser en salle les livrables produits à distance.";
    default:
      return "En présentiel : ateliers en binômes, restitutions au paperboard, pause toutes les ~90 min.";
  }
}
