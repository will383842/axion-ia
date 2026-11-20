/**
 * Phrase et question STANDARD qui remplacent un passage de financement retiré.
 *
 * Phrase française VALIDÉE par Williams le 20/11/2026 (P8). Anomalie A5 : les anciennes valeurs
 * (« Financement : solutions indiquées au premier échange. », « Comment se passe le financement ? »)
 * contenaient elles-mêmes le mot interdit en public. Les formulations ci-dessous reprennent celles déjà
 * publiées dans `src/content/transversal.ts` (#2187).
 *
 * Constantes UNIQUES : `regles.ts` les réexporte, `motifs-interdits-generateur.ts` les cite dans la
 * consigne des générateurs. Ce fichier n'importe rien (pas de jsdom côté générateurs).
 */
/*
 * Décision du pilote (audit PR B v2, point 4) : les QUATRE constantes sont ACCEPTÉES comme remplacements
 * des overrides automatiques. Elles sont figées par `familles-audit-pr-b-v2.spec.ts`.
 *  - PHRASE_FR : phrase VALIDÉE par Williams le 20/11/2026.
 *  - QUESTION_FR « Comment obtenir un devis ? » : validée le 20/11/2026 (complément de la phrase validée).
 *  - PHRASE_EN et QUESTION_EN : traduction fidèle des deux constantes FR ; la version EN est désactivée
 *    (301 vers le FR, cf. EN_LOCALE_ENABLED), donc sans effet public tant qu'elle le reste.
 */
export const PHRASE_FR = "Tarifs : sur devis, établi après un Diagnostic IA gratuit de 45 minutes.";
export const PHRASE_EN = "Pricing: a fixed quote, set after a free 45-minute AI Diagnostic call.";
export const QUESTION_FR = "Comment obtenir un devis ?";
export const QUESTION_EN = "How do I get a quote?";
