-- Questionnaire du Baromètre 2027 : une table nouvelle, sans clé étrangère, sans énumération.
-- Ajout seul, rejouable (IF NOT EXISTS) : aucun UPDATE, DELETE, DROP ni ALTER sur une table existante.
-- Aucune colonne d'IP, d'e-mail, d'agent navigateur ni d'horodatage précis.

CREATE TABLE IF NOT EXISTS "barometre_questionnaire_reponses" (
    "id" UUID NOT NULL,
    "campagne" VARCHAR(40) NOT NULL DEFAULT 'barometre-2027',
    "questionnaire_version" VARCHAR(20) NOT NULL,
    "consent_version" VARCHAR(64) NOT NULL,
    "code_retrait_hash" VARCHAR(64) NOT NULL,
    "jour" DATE NOT NULL,
    "reponses" JSONB NOT NULL,
    "texte_usage" VARCHAR(1000),
    "texte_question" VARCHAR(1000),

    CONSTRAINT "barometre_questionnaire_reponses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "barometre_questionnaire_reponses_code_retrait_hash_key" ON "barometre_questionnaire_reponses"("code_retrait_hash");

CREATE INDEX IF NOT EXISTS "barometre_questionnaire_reponses_campagne_jour_idx" ON "barometre_questionnaire_reponses"("campagne", "jour");
