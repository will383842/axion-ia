-- Lot L6, relecture du 2026-09-25 — deux colonnes ADDITIVES, nullables, sans défaut.
--
-- 1. `guide_requests.derniere_demande_formulaire_at` — date de la dernière demande du
--    guide faite PAR LA PERSONNE, depuis le formulaire public. C'est elle, avec
--    `first_click_at`, qui fait courir les 3 ans de conservation. `queued_at` et
--    `sent_at` ne le peuvent pas : la console (« Renvoyer le guide ») et le
--    rattrapage les avancent sans que la personne ait rien fait.
--    Écrite par `src/server/guide-ia/demande.ts` seulement, jamais par la console.
--
--    Lignes existantes : initialisée depuis `created_at` des lignes nées du
--    formulaire. Les lignes `origine = admin` restent NULL : un envoi console n'est
--    pas une demande de la personne. Une nouvelle demande ultérieure par le
--    formulaire l'avancera. (Une demande répétée AVANT cette migration n'a laissé
--    aucune trace fiable — `queued_at` mêle formulaire, console et rattrapage — :
--    on retient donc la plus ancienne date sûre, qui ne prolonge rien.)
--
-- 2. `newsletter_subscribers.bounced_at` — date du rebond DUR qui a fait passer
--    l'abonné en `bounced`. Les adresses rejetées sont gardées 3 ans APRÈS LE
--    REBOND (même règle que les désinscrits) ; sans cette date, seul `updated_at`
--    existait, que n'importe quelle écriture technique avance.
--    Lignes existantes : initialisée depuis `updated_at` des abonnés déjà `bounced`
--    (meilleure approximation disponible ; elle ne peut qu'être POSTÉRIEURE au
--    rebond, donc elle ne raccourcit jamais la durée annoncée).
--
-- ⚠️ Fenêtre app/worker : le worker atterrit ~50 min AVANT que l'app ne joue cette
-- migration. Les étapes de purge qui lisent ces colonnes sont chacune dans un
-- `try/catch` (`retention-purge-worker.ts`) : pendant la fenêtre, elles échouent
-- sans arrêter le reste de la purge, et repassent le lendemain.
--
-- Réversible : `ALTER TABLE … DROP COLUMN …` (aucune autre donnée n'en dépend).

ALTER TABLE "guide_requests" ADD COLUMN IF NOT EXISTS "derniere_demande_formulaire_at" TIMESTAMP(3);

UPDATE "guide_requests"
   SET "derniere_demande_formulaire_at" = "created_at"
 WHERE "origine" = 'formulaire'
   AND "derniere_demande_formulaire_at" IS NULL;

ALTER TABLE "newsletter_subscribers" ADD COLUMN IF NOT EXISTS "bounced_at" TIMESTAMP(3);

UPDATE "newsletter_subscribers"
   SET "bounced_at" = "updated_at"
 WHERE "status" = 'bounced'
   AND "bounced_at" IS NULL;
