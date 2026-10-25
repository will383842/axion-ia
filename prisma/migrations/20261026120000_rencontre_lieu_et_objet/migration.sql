-- Rendez-vous saisi dans la console (2026-10-25, demande de Will) : lieu et objet du rendez-vous.
-- ADDITIVE : deux colonnes NULLABLES sur "rencontres", sans défaut, sans index, sans énumération,
-- aucune donnée existante touchée, aucune forme de job BullMQ changée. RÉ-EXÉCUTABLE (IF NOT EXISTS).
-- Aucune donnée personnelle ajoutée : le téléphone du contact reste sur "client_contacts".
-- Migration livrée SEULE, AVANT le code qui l'écrit (deux conteneurs app/worker).
-- Retour arrière (JAMAIS exécuté par défaut) :
--   ALTER TABLE "rencontres" DROP COLUMN "objet";
--   ALTER TABLE "rencontres" DROP COLUMN "lieu";
ALTER TABLE "rencontres" ADD COLUMN IF NOT EXISTS "lieu" VARCHAR(200);
ALTER TABLE "rencontres" ADD COLUMN IF NOT EXISTS "objet" VARCHAR(255);
