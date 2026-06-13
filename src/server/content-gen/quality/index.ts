/**
 * Quality helpers SSOT (Sprint v7 Phase 16 + 17 — Session 10 commit 4/4).
 *
 * Barrel file qui ré-exporte tous les helpers quality pour single import path.
 * DX improvement : `import { computeSeoScore, composeMultiJudge, ... } from "@/server/content-gen/quality"`
 *
 * Pattern strict : aucune logique nouvelle ici, juste re-exports nommés.
 *
 * Structure du module :
 *   - SEO + Readability + Doctrine (V1)
 *   - Soft-404 anti-doorway HCU (audit P1-5)
 *   - Plagiarism Jaccard internal + RSS (audit existing)
 *   - Dedup guard (existing)
 *   - Search intent validator (existing)
 *   - Multi-judge ensemble (Phase 16 — env MULTI_JUDGE_ENABLED)
 *   - Originality.ai gate (Phase 16 — env ORIGINALITY_AI_API_KEY)
 */

// ─── V1 quality checks (existing) ────────────────────────────────────────────
export { computeReadabilityFr } from "./readability";
export { computeSeoScore } from "./seo-score";
export { checkDoctrine } from "./doctrine-check";
export { evaluateSoft404 } from "./soft-404-gate";
export { jaccardSimilarity, checkPlagiarism } from "./plagiarism";

// ─── Sprint v7 Phase 16 — Quality gates renforcés (env-gated) ────────────────
export {
  composeMultiJudge,
  runMultiJudge,
  type JudgeResult,
  type MultiJudgeEnsembleResult,
} from "./multi-judge-ensemble";

export {
  scanWithOriginalityAi,
  passesOriginalityGate,
  type OriginalityScanInput,
  type OriginalityScanResult,
} from "./originality-ai-client";
