-- Aperçu de partage (Open Graph) relevé par l'inspecteur, colonne par colonne.
--
-- 🔴 POURQUOI — recensement OG du 2026-08-17. Les 1 667 URLs indexables de la
-- production ont été récupérées et mesurées. Aucun écran de la console ne
-- montrait ce que le site sert quand on partage un lien, et rien ne le stockait :
-- `site_routes` connaissait le `<title>`, la meta description, le H1, le nombre
-- de JSON-LD… et rien de l'aperçu social. On découvrait un aperçu cassé en
-- partageant le lien.
--
-- 🔑 DEUX FAMILLES DE DIMENSIONS, ET C'EST LE CŒUR DU SUJET.
--
--   · `og_declared_*` = ce que les balises ANNONCENT ;
--   · `og_image_*`    = ce que le fichier MESURE.
--
-- Les 1 667 pages annonçaient 1200×630 pour des fichiers qui faisaient 1200×675
-- (nos cartes) ou 1080×607 (les photos de blog). Une seule colonne, recopiée de
-- la balise, aurait rangé le mensonge en base sans jamais permettre de le voir.
-- L'écart entre les deux familles EST le défaut ; il faut donc les deux.
--
-- Toutes les colonnes sont NULL par défaut : une route jamais inspectée n'a
-- rien à dire, et « pas encore relevé » ne doit pas se lire comme « pas d'image ».

ALTER TABLE "site_routes"
  ADD COLUMN IF NOT EXISTS "og_image"           VARCHAR(1000),
  ADD COLUMN IF NOT EXISTS "og_title"           VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "og_description"     TEXT,
  ADD COLUMN IF NOT EXISTS "og_type"            VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "og_declared_width"  INTEGER,
  ADD COLUMN IF NOT EXISTS "og_declared_height" INTEGER,
  ADD COLUMN IF NOT EXISTS "og_image_width"     INTEGER,
  ADD COLUMN IF NOT EXISTS "og_image_height"    INTEGER,
  ADD COLUMN IF NOT EXISTS "og_image_status"    INTEGER,
  ADD COLUMN IF NOT EXISTS "og_image_bytes"     INTEGER,
  ADD COLUMN IF NOT EXISTS "og_image_type"      VARCHAR(60),
  ADD COLUMN IF NOT EXISTS "og_inspected_at"    TIMESTAMP(3);

-- L'écran des aperçus trie et pagine par fraîcheur du relevé, et le worker
-- choisit ses prochaines routes par « jamais relevé d'abord ». Sans cet index,
-- les deux font un balayage complet — sur une table qui vise les 17 629 routes.
--
-- `NULLS FIRST` est explicite : c'est l'ordre voulu (les jamais-relevées en
-- tête), et c'est aussi l'ordre par défaut de Postgres en ASC. L'écrire évite
-- qu'un futur `DESC` inverse silencieusement la priorité du worker.
CREATE INDEX IF NOT EXISTS "site_routes_og_inspected_at_idx"
  ON "site_routes" ("og_inspected_at" ASC NULLS FIRST);
