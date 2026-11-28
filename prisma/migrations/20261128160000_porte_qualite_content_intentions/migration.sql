-- Porte qualité des contenus, PR Q5a (CONCEPTION-PORTE-QUALITE.md § 7.1 et § 13).
-- MIGRATION ADDITIVE : une table NOUVELLE et ses index. Aucun ALTER, UPDATE, DELETE ni DROP
-- sur une table existante, aucune énumération, aucune clé étrangère. Compatible avec l'ancien et
-- le nouveau conteneur (AGENTS.md « DEUX conteneurs ») : ni l'app ni le worker ne lisent ni
-- n'écrivent cette table en Q5a ; le code qui le fera (Q5) tolérera une table absente (P2021).

-- CreateTable
CREATE TABLE "content_intentions" (
    "id" TEXT NOT NULL,
    "requete_normalisee" VARCHAR(300) NOT NULL,
    "intention" VARCHAR(40),
    "persona" VARCHAR(200),
    "sous_questions" JSONB,
    "page_type" VARCHAR(60),
    "page_proprietaire" VARCHAR(500),
    "etat" VARCHAR(20) NOT NULL DEFAULT 'libre',
    "source" VARCHAR(60),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_intentions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "content_intentions_requete_normalisee_key" ON "content_intentions"("requete_normalisee");

-- CreateIndex
CREATE INDEX "content_intentions_etat_idx" ON "content_intentions"("etat");

-- CreateIndex
CREATE INDEX "content_intentions_page_proprietaire_idx" ON "content_intentions"("page_proprietaire");
