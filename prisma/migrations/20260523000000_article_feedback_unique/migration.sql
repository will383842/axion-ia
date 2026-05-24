-- SP-X5 — P0-11 race-safe doublon protection ArticleFeedback
--
-- AVERTISSEMENT AVANT DEPLOY EN PROD :
-- Si la table "article_feedback" contient des doublons (même article_id + user_id),
-- cette migration échouera avec une erreur de contrainte UNIQUE.
-- Corriger d'abord via :
--   DELETE FROM article_feedback
--   WHERE id NOT IN (
--     SELECT DISTINCT ON (article_id, user_id) id
--     FROM article_feedback
--     ORDER BY article_id, user_id, created_at DESC
--   );
-- Puis appliquer cette migration.

-- CreateIndex
CREATE UNIQUE INDEX "article_feedback_articleId_userId_key" ON "article_feedback"("article_id", "user_id");
