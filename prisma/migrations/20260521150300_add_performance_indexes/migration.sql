-- P0-8 Sprint correctif 2026-05-21
-- Problème : 3 index composites manquants pour des requêtes fréquentes
-- qui entraînaient des seq-scans coûteux en production.

-- Index 1: articles status + published_at DESC (pages blog — liste filtrée status=published)
-- Requête type : WHERE status = 'published' ORDER BY published_at DESC LIMIT 20
-- Remplace le double-scan séquentiel sur status + tri published_at.
CREATE INDEX IF NOT EXISTS "articles_status_published_at_idx"
  ON "articles"("status", "published_at" DESC);

-- Index 2: generation_provenance article_id + timestamp DESC (lookup AI Act audit)
-- Requête type : WHERE article_id = $1 ORDER BY timestamp DESC
-- Permet de retrouver rapidement l'historique de génération d'un article
-- pour les audits de conformité AI Act art. 50.
CREATE INDEX IF NOT EXISTS "gen_prov_article_timestamp_idx"
  ON "generation_provenance"("article_id", "timestamp" DESC);

-- Index 3: keywords vertical + last_used_at ASC NULLS FIRST + usage_count ASC
-- (rotation équitable SKIP LOCKED — sélection du prochain keyword disponible)
-- Requête type : WHERE vertical = $1 AND (locked_until IS NULL OR locked_until < now())
--               ORDER BY last_used_at ASC NULLS FIRST, usage_count ASC LIMIT 1
-- Permet à plusieurs workers de sélectionner des keywords en parallèle
-- sans conflit (PostgreSQL SKIP LOCKED + cet index = O(log n) au lieu de seq-scan).
CREATE INDEX IF NOT EXISTS "keywords_vertical_priority_idx"
  ON "keywords"("vertical", "last_used_at" ASC NULLS FIRST, "usage_count" ASC);
