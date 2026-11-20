/**
 * Phrase et question STANDARD qui remplacent un passage de financement retiré.
 *
 * ⚠️ EN ATTENTE DE VALIDATION DE WILLIAMS (analyse du 20/11/2026, anomalie A5). Les anciennes valeurs
 * (« Financement : solutions indiquées au premier échange. », « Comment se passe le financement ? »)
 * contenaient elles-mêmes le mot interdit en public. Les formulations ci-dessous reprennent celles déjà
 * publiées dans `src/content/transversal.ts` (#2187).
 *
 * Constantes UNIQUES : `regles.ts` les réexporte, `motifs-interdits-generateur.ts` les cite dans la
 * consigne des générateurs. Ce fichier n'importe rien (pas de jsdom côté générateurs).
 */
export const PHRASE_FR =
  "Tarifs : devis ferme en forfait fixe, établi après un Diagnostic IA de 45 minutes.";
export const PHRASE_EN = "Pricing: a fixed quote, set after a free 45-minute AI Diagnostic call.";
export const QUESTION_FR = "Comment obtenir un devis ?";
export const QUESTION_EN = "How do I get a quote?";
