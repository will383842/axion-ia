-- P1.5 Phase A follow-up — Corrige 126 rows image_assets mal taguees isAiGenerated=true.
--
-- Contexte : commit fb87f6bb a fixe le code seed-images.cjs (isAiGenerated = !isLogo
-- bug → isAiGenerated = false par defaut). Cette migration data-fix applique le
-- correctif aux rows existants en prod (one-shot, idempotent).
--
-- Doctrine [[feedback_no_dalle_images]] : 0 image IA generative. Les images
-- importees par Will (logos + photos) ont toutes ai_model IS NULL → doivent
-- avoir is_ai_generated = false.
--
-- Idempotent : WHERE clause cible uniquement les rows mal taguees.
-- Re-run safe (deuxieme execution = 0 row affected).

UPDATE "image_assets"
SET "is_ai_generated" = false
WHERE "is_ai_generated" = true
  AND "ai_model" IS NULL;
