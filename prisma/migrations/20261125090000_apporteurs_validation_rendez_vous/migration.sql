-- Réseau d'apporteurs, règle « validation d'une entreprise présentée au premier rendez-vous
-- tenu » — lot 1 : les DONNÉES seules. Deux tables nouvelles, sans clé étrangère, sans
-- énumération (fenêtre app/worker), comme `presentation_etablissement`. Aucun code ne les lit ni
-- ne les écrit encore. Ajout seul, rejouable (IF NOT EXISTS) : aucun UPDATE, DELETE ni DROP.

-- La réservation d'une présentation : une ligne au plus par présentation. Une présentation sans
-- ligne est d'avant cette règle.
CREATE TABLE IF NOT EXISTS "presentation_reservation" (
    "presentation_id" UUID NOT NULL,
    "regle" VARCHAR(20) NOT NULL,
    "reservee_jusqu_at" TIMESTAMPTZ(3) NOT NULL,
    "echue_at" TIMESTAMPTZ(3),
    "rendez_vous_pris_at" TIMESTAMPTZ(3),
    "rendez_vous_at" TIMESTAMPTZ(3),
    "rendez_vous_cle" VARCHAR(80),
    "validation_source" VARCHAR(20),
    "validee_at" TIMESTAMPTZ(3),
    "validee_par_id" VARCHAR(64),
    "cree_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maj_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "presentation_reservation_pkey" PRIMARY KEY ("presentation_id")
);

CREATE INDEX IF NOT EXISTS "presentation_reservation_reservee_jusqu_at_idx" ON "presentation_reservation"("reservee_jusqu_at");

-- Un rendez-vous qui pourrait valider une présentation réservée : proposé, puis retenu ou écarté.
CREATE TABLE IF NOT EXISTS "propositions_rendez_vous_presentation" (
    "id" UUID NOT NULL,
    "presentation_id" UUID NOT NULL,
    "rendez_vous_cle" VARCHAR(80) NOT NULL,
    "motif" VARCHAR(30) NOT NULL,
    "apporteur_cite" BOOLEAN NOT NULL DEFAULT false,
    "pris_at" TIMESTAMPTZ(3) NOT NULL,
    "rendez_vous_at" TIMESTAMPTZ(3),
    "cree_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ecartee_at" TIMESTAMPTZ(3),
    "ecartee_par_id" VARCHAR(64),
    "retenue_at" TIMESTAMPTZ(3),

    CONSTRAINT "propositions_rendez_vous_presentation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "propositions_rendez_vous_presentation_presentation_id_rende_key" ON "propositions_rendez_vous_presentation"("presentation_id", "rendez_vous_cle");

-- Un même rendez-vous ne peut jamais valider deux présentations (règle impérative : jamais deux
-- apporteurs commissionnés pour une même entreprise). Index uniques PARTIELS, écrits à la main :
-- Prisma ne sait pas les exprimer (précédent : trainer_statements_mission_unique). Ils ne
-- contraignent que les lignes déjà validées / retenues ; l'unicité par entreprise (SIREN/SIRET)
-- reste une décision du dirigeant, volontairement non prise ici.
CREATE UNIQUE INDEX IF NOT EXISTS "presentation_reservation_rendez_vous_valide_key" ON "presentation_reservation"("rendez_vous_cle") WHERE "validee_at" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "propositions_rendez_vous_presentation_retenue_key" ON "propositions_rendez_vous_presentation"("rendez_vous_cle") WHERE "retenue_at" IS NOT NULL;
