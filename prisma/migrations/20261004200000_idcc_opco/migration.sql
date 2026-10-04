-- INT-T60-A — correspondance IDCC → OPCO importée de la table SIRO
-- (France compétences), et journal de ses changements.
-- AJOUTS SEULS : deux tables neuves, aucune colonne touchée ailleurs.
-- L'énumération "Opco" existe déjà (lot OPCO) : elle n'est pas modifiée.

CREATE TABLE "idcc_opco" (
    "idcc" CHAR(4) NOT NULL,
    "opco" "Opco" NOT NULL,
    "millesime_source" DATE NOT NULL,
    "source_url" TEXT NOT NULL,
    "importe_at" TIMESTAMPTZ(6) NOT NULL,
    "intitule" TEXT,
    "intitule_source" TEXT,

    CONSTRAINT "idcc_opco_pkey" PRIMARY KEY ("idcc", "opco")
);

CREATE TABLE "idcc_opco_changements" (
    "id" UUID NOT NULL,
    "idcc" CHAR(4) NOT NULL,
    "ancien_opco" "Opco",
    "nouvel_opco" "Opco",
    "millesime_source" DATE NOT NULL,
    "importe_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idcc_opco_changements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idcc_opco_opco_idx" ON "idcc_opco"("opco");
CREATE INDEX "idcc_opco_changements_idcc_importe_at_idx" ON "idcc_opco_changements"("idcc", "importe_at");

-- Un IDCC tient sur exactement quatre chiffres : « 123 » et « 12a4 » sont refusés.
ALTER TABLE "idcc_opco" ADD CONSTRAINT "idcc_opco_idcc_check"
  CHECK ("idcc" ~ '^[0-9]{4}$');
ALTER TABLE "idcc_opco_changements" ADD CONSTRAINT "idcc_opco_changements_idcc_check"
  CHECK ("idcc" ~ '^[0-9]{4}$');
-- Un changement a au moins un côté, et ses deux côtés diffèrent.
ALTER TABLE "idcc_opco_changements" ADD CONSTRAINT "idcc_opco_changements_cote_check"
  CHECK (("ancien_opco" IS NOT NULL OR "nouvel_opco" IS NOT NULL)
         AND ("ancien_opco" IS DISTINCT FROM "nouvel_opco"));
