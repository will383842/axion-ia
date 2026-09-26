-- Audit final du plan newsletter (2026-09-26) — une colonne ADDITIVE, nullable, sans défaut.
--
-- `guide_requests.last_click_at` — date du DERNIER clic sur le bouton de téléchargement
-- (POST de `/api/guide-ia/telecharger`). La mention du formulaire promet une conservation
-- de « 3 ans après votre dernier échange avec nous » ; seul le PREMIER clic
-- (`first_click_at`) était mesuré. La purge (`src/server/newsletter/retention.ts`) compte
-- désormais depuis `last_click_at` (et `derniere_demande_formulaire_at`).
--
-- Lignes existantes : initialisée depuis `first_click_at` (le seul clic connu ; elle ne
-- peut pas être antérieure au vrai dernier clic, donc elle ne raccourcit rien par rapport
-- à la règle d'avant).
--
-- ⚠️ Fenêtre app/worker : le worker atterrit ~50 min AVANT que l'app ne joue cette
-- migration. La purge (worker) qui lit la colonne attrape l'erreur P2022 et retombe sur
-- la règle d'avant (`first_click_at`) pendant la fenêtre. Seule l'app (route du
-- bouton, export RGPD) écrit ou lit la colonne autrement, et l'app ne démarre
-- qu'après la migration.
--
-- Réversible : `ALTER TABLE "guide_requests" DROP COLUMN "last_click_at";`

ALTER TABLE "guide_requests" ADD COLUMN IF NOT EXISTS "last_click_at" TIMESTAMP(3);

UPDATE "guide_requests"
   SET "last_click_at" = "first_click_at"
 WHERE "first_click_at" IS NOT NULL
   AND "last_click_at" IS NULL;
