/**
 * SSOT des contraintes de longueur SEO/AEO des métadonnées générées (P0 qualité
 * 2026-06-25). L'audit a constaté un pattern « metaTitle/metaDescription/
 * directAnswer chroniquement trop courts » : metaTitle 33-50 car (cible 50-60),
 * metaDescription 107-144 car (cible 140-160), directAnswer 24-31 mots (cible
 * 40-80).
 *
 * Cause racine côté prompt : les anciennes consignes disaient « 50-60 caractères
 * MAX » / « 140-155 caractères » — le mot « MAX » et l'absence de plancher DUR
 * poussaient le modèle vers le bas de la fourchette (ou en dessous). Ce module
 * centralise :
 *
 *   1. Les seuils canoniques (META_LENGTH) — une seule source de vérité.
 *   2. Les blocs de directives prêts à coller dans les prompts des generators
 *      (META_LENGTH_RULES_*), qui exigent un PLANCHER autant qu'un plafond.
 *   3. Des helpers de mesure/clamp purs (déterministes, zéro I/O) réutilisables
 *      au rendu (filet de sécurité `src/lib/seo.ts`) comme dans les gates.
 *
 * Ne change AUCUN schéma de sortie : c'est purement éditorial + garde-fou.
 */

/** Seuils canoniques (caractères pour les titres/descriptions, mots pour les réponses). */
export const META_LENGTH = {
  /** metaTitle / title H1 : fourchette SERP Google (pixels ≈ 50-60 car). */
  metaTitle: { min: 50, max: 60 },
  /** metaDescription : fourchette anti-troncature SERP. */
  metaDescription: { min: 140, max: 160 },
  /** directAnswer (réponse directe AEO citable) : en MOTS. */
  directAnswerWords: { min: 40, max: 80 },
} as const;

/**
 * Bloc de directive metaTitle prêt à interpoler dans un prompt generator.
 * Insiste sur le PLANCHER (50 car) autant que sur le plafond (60 car) — c'est le
 * plancher qui manquait et produisait des titres à 33-45 car.
 */
export const META_TITLE_RULE = `"metaTitle" : OBLIGATOIREMENT entre ${META_LENGTH.metaTitle.min} et ${META_LENGTH.metaTitle.max} caractères (compte les espaces). NE JAMAIS descendre sous ${META_LENGTH.metaTitle.min} caractères : si trop court, ajoute une précision utile (bénéfice, secteur, « pour TPE/PME »…), JAMAIS de remplissage creux. Mot-clé principal au tout début. NE PAS dépasser ${META_LENGTH.metaTitle.max} caractères.`;

/**
 * Bloc de directive metaDescription prêt à interpoler. Plancher 140 car explicite.
 */
export const META_DESCRIPTION_RULE = `"metaDescription" : OBLIGATOIREMENT entre ${META_LENGTH.metaDescription.min} et ${META_LENGTH.metaDescription.max} caractères (compte les espaces). NE JAMAIS descendre sous ${META_LENGTH.metaDescription.min} caractères : phrase(s) complète(s) avec bénéfice concret + mot-clé naturel ; développe jusqu'à atteindre la fourchette plutôt que de t'arrêter court. NE PAS dépasser ${META_LENGTH.metaDescription.max} caractères.`;

/**
 * Bloc de directive directAnswer prêt à interpoler. Réponse directe AEO en mots.
 */
export const DIRECT_ANSWER_RULE = `"directAnswer" : OBLIGATOIREMENT entre ${META_LENGTH.directAnswerWords.min} et ${META_LENGTH.directAnswerWords.max} mots (ni moins, ni plus). Réponse autonome et complète, citable seule par une IA (AI Overview / vocal). NE JAMAIS répondre en moins de ${META_LENGTH.directAnswerWords.min} mots : si la réponse tient en une phrase, ajoute le « comment » / « pourquoi » concret jusqu'à atteindre le plancher.`;

/** Compte les mots d'un texte (split sur les espaces, tokens non vides). */
export function countWords(text: string | null | undefined): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Tronque proprement une chaîne à `max` caractères au dernier mot complet, avec
 * ellipse. Déterministe, pur. Si le texte tient déjà, renvoyé inchangé.
 * (Aligné sur `truncateMetaDescription` de `src/lib/seo.ts`.)
 */
export function clampToWordBoundary(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  const slice = trimmed.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(" ");
  return `${(lastSpace > Math.floor(max / 2) ? slice.slice(0, lastSpace) : slice).trimEnd()}…`;
}
