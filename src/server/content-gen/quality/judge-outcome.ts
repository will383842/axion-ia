/**
 * Content Generator — routage du verdict du LLM-judge (fix 2026-07-17).
 *
 * Module PUR (aucun import Prisma/BullMQ) pour rester testable sans mock, sur le
 * modèle de `intent-enforcement.ts`. Consommé par `content-quality-improver-worker`.
 *
 * Bug corrigé : le verdict `publish` du juge tombait dans le `: "needs_review"`
 * final du worker et n'était JAMAIS re-soumis à la décision d'auto-publication.
 * Un article que le juge validait dormait donc indéfiniment dans la file des
 * rejets. C'est la même classe de bug que celle corrigée pour les news le
 * 2026-07-03 (cf. `content-gen-worker.ts` « Priorité auto-publish NEWS sur la
 * boucle qualité »), restée ouverte pour tous les autres types de contenu.
 */

/** Sous-ensemble de `policies` (clé ContentGenConfig) utile à la décision. */
export interface AutoPublishPolicies {
  readonly factoryAutoPublishAllBlogTypes?: boolean;
  readonly factoryAutoPromoteTier1MinScore?: number;
  readonly newsAutoPublish?: boolean;
}

export interface JudgeOutcomeInput {
  readonly verdict: "publish" | "improve" | "reject";
  /** `false` si le juge n'a pas pu tourner (API down) — interdit toute décision auto. */
  readonly judgeRan: boolean;
  readonly reachedCap: boolean;
  /** `content_gen_jobs.doctrineCheckPassed`, qui persiste en réalité `!blockingFail`. */
  readonly doctrineCheckPassed: boolean | null;
  readonly isRss: boolean;
  readonly policies: AutoPublishPolicies;
}

export type JudgeOutcome =
  "quarantined_critical" | "quality_improving" | "approved" | "needs_review";

/**
 * Décide du statut de sortie de la boucle qualité.
 *
 * Garde-fous :
 *  - juge absent (API down) → jamais d'auto-publication (`judgeRan`)
 *  - `blockingFail` persisté (dedup sémantique, benefit-gate, plagiat, intent,
 *    doctrine) → `needs_review`, quel que soit le verdict
 *  - toggles `factoryAutoPublishAllBlogTypes` / `newsAutoPublish` respectés
 */
export function resolveJudgeOutcome(input: JudgeOutcomeInput): JudgeOutcome {
  if (input.verdict === "reject") return "quarantined_critical";
  if (input.verdict === "improve" && !input.reachedCap && input.judgeRan) {
    return "quality_improving";
  }
  if (input.verdict === "publish" && input.judgeRan) {
    // `doctrineCheckPassed === false` ⇒ blockingFail : doublon sémantique,
    // bénéfice insuffisant, plagiat, intent — jamais d'auto-publication.
    if (input.doctrineCheckPassed === false) return "needs_review";
    const allowed = input.isRss
      ? input.policies.newsAutoPublish !== false
      : input.policies.factoryAutoPublishAllBlogTypes !== false;
    return allowed ? "approved" : "needs_review";
  }
  return "needs_review";
}
