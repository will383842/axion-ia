-- MIGRATION ADDITIVE. Chaîne éditoriale C12 : page d'origine d'une réservation directe.
-- Une table NOUVELLE, sans clé étrangère ni énumération. Aucun UPDATE, DELETE, DROP, RENAME.
-- Retour arrière : voir rollback.sql.

CREATE TABLE IF NOT EXISTS "contenu_rendez_vous_origines" (
    "id" TEXT NOT NULL,
    "event_uri" VARCHAR(255) NOT NULL,
    "page_origine" VARCHAR(300) NOT NULL,
    "choix" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contenu_rendez_vous_origines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "contenu_rendez_vous_origines_event_uri_key" ON "contenu_rendez_vous_origines"("event_uri");
CREATE INDEX IF NOT EXISTS "contenu_rendez_vous_origines_page_origine_created_at_idx" ON "contenu_rendez_vous_origines"("page_origine", "created_at");
