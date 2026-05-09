-- Sprint 24 / C4 — Tiptap getJSON() + getText() persistence
--
-- Ajoute les colonnes nullable pour stocker, en plus du HTML rendu :
--   - le JSON canonique Tiptap (reuse cote consumer : RSS, AMP, AI summarisation)
--   - le texte plain (reuse cote search FTS, OG description fallback)
--
-- Toutes nullable pour preserver retro-compat avec les lignes existantes.

ALTER TABLE "article_translations"
  ADD COLUMN "body_json" JSONB,
  ADD COLUMN "body_text" TEXT;

ALTER TABLE "case_study_translations"
  ADD COLUMN "problem_json"  JSONB,
  ADD COLUMN "problem_text"  TEXT,
  ADD COLUMN "solution_json" JSONB,
  ADD COLUMN "solution_text" TEXT;

ALTER TABLE "help_article_translations"
  ADD COLUMN "body_json" JSONB,
  ADD COLUMN "body_text" TEXT;
