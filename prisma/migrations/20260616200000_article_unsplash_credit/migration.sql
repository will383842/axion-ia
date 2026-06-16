-- Unsplash hero (Option A, 2026-06-16) — attribution photographe CGU §6 quand
-- l'image hero d'un article content-gen est une photo Unsplash hotlinkée.
-- Additif uniquement (colonnes nullable), backward-compat 100%. Idempotent.
ALTER TABLE "articles"
  ADD COLUMN IF NOT EXISTS "featured_image_photographer_name" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "featured_image_photographer_url" VARCHAR(500);
