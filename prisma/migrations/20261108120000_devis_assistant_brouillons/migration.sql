-- S01 (2026-11-08) — assistant de création de devis : brouillons.
-- STRICTEMENT ADDITIF : une table neuve, ses index et ses clés étrangères. Aucune colonne ni
-- table existante modifiée, aucune énumération, aucune purge. Compatible avec l'ANCIEN
-- conteneur (qui ignore la table).
-- Dans cette PR, seul `charger.ts` la lit, et il n'est monté par AUCUNE page : rien ne la lit
-- encore en production. CONDITION DE MISE EN LIGNE : cette migration doit être appliquée en
-- production AVANT de monter `charger.ts` sur une page (fiches S06, S08, S12, S17).
-- Retour arrière (JAMAIS exécuté par défaut) : DROP TABLE "devis_assistant_brouillons";

-- CreateTable
CREATE TABLE "devis_assistant_brouillons" (
    "id" UUID NOT NULL,
    "created_by_admin_id" UUID NOT NULL,
    "client_id" UUID,
    "devis_id" UUID,
    "vente_brouillon_id" UUID,
    "etape" SMALLINT NOT NULL DEFAULT 1,
    "statut" VARCHAR(16) NOT NULL DEFAULT 'en_cours',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "payload_version" SMALLINT NOT NULL DEFAULT 1,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "derniere_sauvegarde_id" UUID,
    "verrou_depuis" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "devis_assistant_brouillons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "devis_assistant_brouillons_devis_id_key" ON "devis_assistant_brouillons"("devis_id");

-- CreateIndex
CREATE INDEX "devis_assistant_brouillons_created_by_admin_id_updated_at_idx" ON "devis_assistant_brouillons"("created_by_admin_id", "updated_at");

-- CreateIndex
CREATE INDEX "devis_assistant_brouillons_client_id_idx" ON "devis_assistant_brouillons"("client_id");

-- AddForeignKey
ALTER TABLE "devis_assistant_brouillons" ADD CONSTRAINT "devis_assistant_brouillons_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devis_assistant_brouillons" ADD CONSTRAINT "devis_assistant_brouillons_devis_id_fkey" FOREIGN KEY ("devis_id") REFERENCES "devis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
