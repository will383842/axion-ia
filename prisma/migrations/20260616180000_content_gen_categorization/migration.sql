-- Catégorisation content-gen (2026-06-16).
-- (1) Propage le secteur de service jusqu'au job de génération (Campagne → Job → Article.categoryId au publish).
-- (2) Crée les 5 catégories de blog mappées 1:1 aux ServiceSector.
-- Additive-only + idempotent (IF NOT EXISTS / ON CONFLICT). Ne touche à rien d'existant.

-- (1) Colonne service_sector sur content_gen_jobs (propagée depuis la campagne)
ALTER TABLE "content_gen_jobs" ADD COLUMN IF NOT EXISTS "service_sector" "ServiceSector";

-- (2) 5 catégories de blog = 5 ServiceSector (slug stable, mappé en code).
INSERT INTO "categories" ("id", "slug", "name_fr", "name_en", "icon", "color_accent", "display_order", "status", "seo_title_fr", "seo_desc_fr", "created_at", "updated_at") VALUES
  (gen_random_uuid(), 'blog-formations-ia', 'Formations IA', 'AI Training', 'graduation-cap', '#c24a1b', 10, 'published', 'Formations IA — articles & guides | Axion-IA', 'Articles, guides et cas concrets sur les formations IA opérationnelles pour PME et ETI.', now(), now()),
  (gen_random_uuid(), 'blog-coaching-1-to-1', 'Coaching 1-to-1', 'One-on-one Coaching', 'user-check', '#1a4dd9', 20, 'published', 'Coaching IA individuel — articles | Axion-IA', 'Accompagnement individuel à l''IA : articles, retours d''expérience et méthodes.', now(), now()),
  (gen_random_uuid(), 'blog-audits-ia', 'Audits IA', 'AI Audits', 'search', '#c24a1b', 30, 'published', 'Audits IA — articles & méthodes | Axion-IA', 'Audits IA opérationnels : diagnostics, méthodologie et cas concrets.', now(), now()),
  (gen_random_uuid(), 'blog-implementations-ia', 'Implémentations IA', 'AI Implementations', 'code', '#1a4dd9', 40, 'published', 'Implémentations IA — articles | Axion-IA', 'Intégration et déploiement de solutions IA : retours terrain et bonnes pratiques.', now(), now()),
  (gen_random_uuid(), 'blog-sites-web-augmentes', 'Sites web augmentés', 'AI-enhanced Websites', 'globe', '#c24a1b', 50, 'published', 'Sites web augmentés par l''IA — articles | Axion-IA', 'Sites web et applications augmentés par l''IA : conception, SEO et performance.', now(), now())
ON CONFLICT ("slug") DO NOTHING;
