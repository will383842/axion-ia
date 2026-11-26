-- Réseau d'apporteurs, TVA des commissions — lot 3 : le régime de TVA est FIGÉ sur chaque pièce de la
-- série AXI-APP (autofacture ou avoir), et l'historique des changements de régime a sa table.
-- Deux tables nouvelles, sans clé étrangère, sans énumération nouvelle (fenêtre app/worker : on
-- réutilise « regime_tva_apporteur »). Ajout seul, rejouable (IF NOT EXISTS) : aucun UPDATE, DELETE,
-- DROP ni ALTER sur une table existante. Le seul INSERT reprend les pièces déjà émises, à leur
-- régime ACTUEL (aucun changement de régime n'a pu avoir lieu : le code ne le permettait pas).

CREATE TABLE IF NOT EXISTS "pieces_autofacture_apporteur" (
    "numero" VARCHAR(40) NOT NULL,
    "apporteur_id" UUID NOT NULL,
    "genre" VARCHAR(10) NOT NULL,
    "regime_tva" "regime_tva_apporteur" NOT NULL,
    "numero_tva" VARCHAR(20),
    "total_ht_cents" INTEGER,
    "total_tva_cents" INTEGER,
    "total_ttc_cents" INTEGER,
    "facture_rectifiee" VARCHAR(40),
    "emise_at" TIMESTAMPTZ(3) NOT NULL,
    "origine" VARCHAR(20) NOT NULL,
    "cree_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pieces_autofacture_apporteur_pkey" PRIMARY KEY ("numero")
);

CREATE INDEX IF NOT EXISTS "pieces_autofacture_apporteur_apporteur_id_idx" ON "pieces_autofacture_apporteur"("apporteur_id");

CREATE TABLE IF NOT EXISTS "apporteur_regime_tva_changements" (
    "id" UUID NOT NULL,
    "apporteur_id" UUID NOT NULL,
    "regime_avant" "regime_tva_apporteur",
    "numero_tva_avant" VARCHAR(20),
    "regime_tva" "regime_tva_apporteur" NOT NULL,
    "numero_tva" VARCHAR(20),
    "effet_au" DATE NOT NULL,
    "saisi_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "saisi_par" UUID,
    "annule_at" TIMESTAMPTZ(3),

    CONSTRAINT "apporteur_regime_tva_changements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "apporteur_regime_tva_changements_apporteur_id_effet_au_idx" ON "apporteur_regime_tva_changements"("apporteur_id", "effet_au");

-- Reprise des autofactures déjà émises : une ligne par numéro, régime ACTUEL de la fiche.
-- Les totaux restent NULL : on ne reconstitue pas un TTC à partir de lignes qui ont pu bouger.
INSERT INTO "pieces_autofacture_apporteur" ("numero", "apporteur_id", "genre", "regime_tva", "numero_tva", "emise_at", "origine")
SELECT DISTINCT ON (c."autofacture_numero")
    c."autofacture_numero", c."apporteur_id", 'facture', a."regime_tva",
    CASE WHEN a."regime_tva" = 'assujetti' THEN a."numero_tva" END,
    COALESCE(c."autofacture_emise_at", c."maj_at"), 'reprise_migration'
FROM "commissions_apporteur" c JOIN "apporteurs_reseau" a ON a."id" = c."apporteur_id"
WHERE c."autofacture_numero" IS NOT NULL AND a."regime_tva" IS NOT NULL
ORDER BY c."autofacture_numero", COALESCE(c."autofacture_emise_at", c."maj_at")
ON CONFLICT ("numero") DO NOTHING;

-- Avoirs : même chose sur avoir_numero. `facture_rectifiee` reste NULL (l'origine se retrouve par le
-- palier « reprise-de: » ; le code sait le faire).
INSERT INTO "pieces_autofacture_apporteur" ("numero", "apporteur_id", "genre", "regime_tva", "numero_tva", "emise_at", "origine")
SELECT DISTINCT ON (c."avoir_numero")
    c."avoir_numero", c."apporteur_id", 'avoir', a."regime_tva",
    CASE WHEN a."regime_tva" = 'assujetti' THEN a."numero_tva" END,
    COALESCE(c."autofacture_emise_at", c."maj_at"), 'reprise_migration'
FROM "commissions_apporteur" c JOIN "apporteurs_reseau" a ON a."id" = c."apporteur_id"
WHERE c."avoir_numero" IS NOT NULL AND a."regime_tva" IS NOT NULL
ORDER BY c."avoir_numero", COALESCE(c."autofacture_emise_at", c."maj_at")
ON CONFLICT ("numero") DO NOTHING;
