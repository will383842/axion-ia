-- P0-1 Sprint correctif 2026-05-21
-- Problème : generation_provenance.article_id FK → articles.id ON DELETE CASCADE
-- détruisait les traces légales AI Act (art. 50, deadline 2026-08-02) lors de
-- la suppression d'un article.
-- Fix : ON DELETE RESTRICT — un article ne peut être supprimé tant qu'il possède
-- des lignes de provenance. La suppression doit passer par une procédure admin
-- dédiée qui archive les lignes provenance avant de supprimer l'article.

-- AlterTable: generation_provenance FK → RESTRICT
ALTER TABLE "generation_provenance" DROP CONSTRAINT IF EXISTS "generation_provenance_article_id_fkey";
ALTER TABLE "generation_provenance" ADD CONSTRAINT "generation_provenance_article_id_fkey"
  FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
