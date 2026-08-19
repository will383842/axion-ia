-- Surcharge éditoriale de l'aperçu de partage.
--
-- 🔴 POURQUOI — recensement OG du 2026-08-17. L'aperçu de chaque page était
-- entièrement calculé dans le code. Aucune page n'était modifiable depuis la
-- console, et le seul champ qui prétendait l'être — « URL de l'image OG » du
-- formulaire blog — écrivait une colonne qu'aucun rendu ne lisait.
--
-- 🔑 DEUX PORTÉES, PARCE QUE LE SITE A DEUX ÉCHELLES.
--
--   · `route`  — une URL précise. Le cas courant.
--   · `modele` — un `pathPattern` entier, qui couvre d'un coup les 10 162
--     pages ville×service. Ces pages ne sont même pas au catalogue
--     `site_routes` (l'énumérateur ne catalogue que les 623 combinaisons
--     portant une copy éditoriale) : sans cette portée, elles seraient
--     purement inatteignables depuis la console.
--
-- La portée `route` l'emporte sur `modele` — le particulier bat le général,
-- sinon poser une exception serait impossible.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'og_override_portee') THEN
    CREATE TYPE "og_override_portee" AS ENUM ('route', 'modele');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "og_overrides" (
  "id"              TEXT NOT NULL,
  "portee"          "og_override_portee" NOT NULL,
  "cible"           VARCHAR(1000) NOT NULL,
  "og_title"        VARCHAR(500),
  "og_description"  VARCHAR(500),
  "og_image"        VARCHAR(1000),
  "og_image_width"  INTEGER,
  "og_image_height" INTEGER,
  "og_eyebrow"      VARCHAR(200),
  "actif"           BOOLEAN NOT NULL DEFAULT true,
  "note"            TEXT,
  "created_by"      VARCHAR(120),
  "updated_by"      VARCHAR(120),
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "og_overrides_pkey" PRIMARY KEY ("id")
);

-- Une seule décision par cible et par portée : deux lignes concurrentes sur la
-- même URL feraient dépendre l'aperçu de l'ordre de lecture.
CREATE UNIQUE INDEX IF NOT EXISTS "og_overrides_portee_cible_key"
  ON "og_overrides" ("portee", "cible");

-- Le chargeur ne lit que les surcharges actives, à chaque régénération de page.
CREATE INDEX IF NOT EXISTS "og_overrides_actif_idx" ON "og_overrides" ("actif");
