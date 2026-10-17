/**
 * Qualiopi ind. 21 — le SQL BRUT de la table des évaluations de compétences, liste unique.
 *
 * Prisma 5.22 n'exprime ni CHECK ni trigger. Une migration ultérieure qui retirerait
 * ceux-ci rendrait les grilles RÉÉCRIVABLES (ou une décision sans motif possible) sans
 * que rien ne rougisse. Le test `__tests__/le-sql-brut-est-declare.spec.ts` lit la
 * migration et vérifie que chaque objet ci-dessous y est créé, et rien d'autre.
 */

export const MIGRATION_EVALUATION_COMPETENCES = "20261017120000_formateurs_evaluation_competences";

export const TABLE_EVALUATIONS = "evaluations_competences_formateur";

export const OBJETS_SQL_EVALUATION = [
  { nom: "evaluations_competences_formateur_coherente", type: "check" },
  { nom: "evaluations_competences_formateur_ajout_seul", type: "trigger" },
  { nom: "evaluations_competences_formateur_pas_de_truncate", type: "trigger" },
] as const;
