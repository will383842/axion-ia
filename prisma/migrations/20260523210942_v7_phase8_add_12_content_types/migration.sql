-- Sprint v7 Phase 8 — Migration enum ContentType +12 nouvelles valeurs.
-- Mapping côté code : src/server/content-gen/generators/index.ts (12 nouveaux generators).
--
-- Postgres 12+ : `ALTER TYPE ADD VALUE` n'est pas transactionnel (limitation
-- DDL enum). On exécute chaque ADD VALUE en statement séparé. La migration
-- est idempotent grâce à `IF NOT EXISTS`.
--
-- Cohérence avec wizard step 3 — 19 sliders 6 sections (Sprint v7 Phase 8).

ALTER TYPE "ContentType" ADD VALUE IF NOT EXISTS 'long_tail_keyword';
ALTER TYPE "ContentType" ADD VALUE IF NOT EXISTS 'pain_point_solution';
ALTER TYPE "ContentType" ADD VALUE IF NOT EXISTS 'vs_comparator';
ALTER TYPE "ContentType" ADD VALUE IF NOT EXISTS 'alternative_to';
ALTER TYPE "ContentType" ADD VALUE IF NOT EXISTS 'top_x_in_y';
ALTER TYPE "ContentType" ADD VALUE IF NOT EXISTS 'how_to_x_in_y';
ALTER TYPE "ContentType" ADD VALUE IF NOT EXISTS 'best_for_x_in_y';
ALTER TYPE "ContentType" ADD VALUE IF NOT EXISTS 'calculator_roi';
ALTER TYPE "ContentType" ADD VALUE IF NOT EXISTS 'glossary_term';
ALTER TYPE "ContentType" ADD VALUE IF NOT EXISTS 'what_is_x';
ALTER TYPE "ContentType" ADD VALUE IF NOT EXISTS 'faq_geo';
ALTER TYPE "ContentType" ADD VALUE IF NOT EXISTS 'case_study_local';
