-- Index sur keywords.cluster_id (2026-06-25) — accélère l'agrégat par cluster
-- du sélecteur de mots-clés (selectKeywordRich groupe/filtre par cluster_id).
-- 100 % additif : un seul CREATE INDEX IF NOT EXISTS, aucun drop, aucune
-- modification de colonne.

-- CreateIndex
CREATE INDEX IF NOT EXISTS "keywords_cluster_id_idx" ON "keywords"("cluster_id");
