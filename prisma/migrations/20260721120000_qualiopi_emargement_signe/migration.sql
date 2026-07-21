-- QUALIOPI T13 — Émargement électronique signé (étape C).
--
-- Preuve d'assiduité opposable (art. R.6313-3 : « tout élément probant »).
-- Signature électronique SIMPLE horodatée : l'art. 1366 C. civ. (identification
-- + intégrité) suffit à la VALIDITÉ. Le qualifié eIDAS n'apporte que la
-- présomption de fiabilité, non exigée ici (décision D1).
--
-- Trois tables, parce que le GRAIN diffère :
--   · emargement_tokens             → portée = une inscription
--   · emargement_signatures         → grain créneau (demi-journée) × stagiaire
--   · emargement_contresignatures   → grain session × date × demi-journée, le
--     formateur signant UNE fois pour tout le groupe. Loger la contresignature
--     avec les signatures stagiaires était l'erreur de conception de la v2.
--
-- Polymorphe dès la V1 (décision D9) : `contexte_type` distingue le collectif de
-- l'AFEST 1-to-1, pour ne pas créer une 5e façon de signer dans trois mois. Les
-- FK des deux contextes sont nullables, gardées par un CHECK d'exclusivité.
--
-- `ON DELETE RESTRICT` partout, explicitement : une preuve légale ne disparaît
-- jamais en cascade. Les tables voisines sont en `Cascade` — ce choix est un
-- écart assumé, pas un oubli.
--
-- Index UNIQUE PARTIELS (`WHERE revoked_at IS NULL`) : une clé unique totale
-- rendrait toute correction IMPOSSIBLE après révocation. Non exprimable en
-- Prisma, donc en SQL brut ici — même précédent que `session_formateur_un_principal`.
--
-- Migration ADDITIVE : aucun DROP, aucune colonne NOT NULL sans valeur par
-- défaut sur une table existante. Les deux enums sont NEUFS (`CREATE TYPE`), la
-- règle « ADD VALUE dans une migration séparée » ne s'applique donc pas.
-- CreateEnum
CREATE TYPE "EmargementContexte" AS ENUM ('collectif', 'afest_1to1');

-- CreateEnum
CREATE TYPE "EmargementMethode" AS ENUM ('canvas', 'confirmation_accessible', 'papier_scanne');

-- CreateTable
CREATE TABLE "emargement_tokens" (
    "id" UUID NOT NULL,
    "contexte_type" "EmargementContexte" NOT NULL,
    "enrollment_id" UUID,
    "coaching_id" UUID,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "revoked_by_id" UUID,
    "revoked_motif" TEXT,
    "created_ip_hash" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emargement_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emargement_signatures" (
    "id" UUID NOT NULL,
    "contexte_type" "EmargementContexte" NOT NULL,
    "creneau_id" UUID,
    "coaching_id" UUID,
    "token_id" UUID,
    "methode" "EmargementMethode" NOT NULL,
    "signature_key" TEXT,
    "signature_sha256" VARCHAR(64),
    "mime_type" VARCHAR(60),
    "size_bytes" INTEGER,
    "signataire_nom" VARCHAR(200) NOT NULL,
    "signataire_email" VARCHAR(255),
    "signe_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_hash" VARCHAR(64),
    "user_agent_sha256" VARCHAR(64),
    "prev_hash" VARCHAR(64),
    "self_hash" VARCHAR(64) NOT NULL,
    "hash_version" INTEGER NOT NULL DEFAULT 1,
    "mention_version" VARCHAR(20) NOT NULL,
    "consentement_version" VARCHAR(20),
    "suppression_prevue_at" TIMESTAMP(3),
    "image_purgee_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "revoked_by_id" UUID,
    "revoked_motif" TEXT,

    CONSTRAINT "emargement_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emargement_contresignatures" (
    "id" UUID NOT NULL,
    "contexte_type" "EmargementContexte" NOT NULL,
    "session_id" UUID,
    "coaching_id" UUID,
    "trainer_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "demi_journee" "DemiJournee" NOT NULL,
    "heure_debut" VARCHAR(5) NOT NULL,
    "heure_fin" VARCHAR(5) NOT NULL,
    "modules_snapshot" JSONB NOT NULL DEFAULT '[]',
    "formateur_nom" VARCHAR(200) NOT NULL,
    "methode" "EmargementMethode" NOT NULL,
    "signature_key" TEXT,
    "signature_sha256" VARCHAR(64),
    "mime_type" VARCHAR(60),
    "size_bytes" INTEGER,
    "signe_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_hash" VARCHAR(64),
    "user_agent_sha256" VARCHAR(64),
    "prev_hash" VARCHAR(64),
    "self_hash" VARCHAR(64) NOT NULL,
    "hash_version" INTEGER NOT NULL DEFAULT 1,
    "mention_version" VARCHAR(20) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "revoked_by_id" UUID,
    "revoked_motif" TEXT,

    CONSTRAINT "emargement_contresignatures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "emargement_tokens_token_hash_key" ON "emargement_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "emargement_tokens_enrollment_id_idx" ON "emargement_tokens"("enrollment_id");

-- CreateIndex
CREATE INDEX "emargement_tokens_coaching_id_idx" ON "emargement_tokens"("coaching_id");

-- CreateIndex
CREATE INDEX "emargement_tokens_expires_at_idx" ON "emargement_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "emargement_signatures_creneau_id_idx" ON "emargement_signatures"("creneau_id");

-- CreateIndex
CREATE INDEX "emargement_signatures_coaching_id_idx" ON "emargement_signatures"("coaching_id");

-- CreateIndex
CREATE INDEX "emargement_signatures_token_id_idx" ON "emargement_signatures"("token_id");

-- CreateIndex
CREATE INDEX "emargement_signatures_signe_at_idx" ON "emargement_signatures"("signe_at");

-- CreateIndex
CREATE INDEX "emargement_contresignatures_session_id_date_idx" ON "emargement_contresignatures"("session_id", "date");

-- CreateIndex
CREATE INDEX "emargement_contresignatures_coaching_id_idx" ON "emargement_contresignatures"("coaching_id");

-- CreateIndex
CREATE INDEX "emargement_contresignatures_trainer_id_idx" ON "emargement_contresignatures"("trainer_id");

-- AddForeignKey
ALTER TABLE "emargement_tokens" ADD CONSTRAINT "emargement_tokens_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emargement_tokens" ADD CONSTRAINT "emargement_tokens_coaching_id_fkey" FOREIGN KEY ("coaching_id") REFERENCES "coaching_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emargement_signatures" ADD CONSTRAINT "emargement_signatures_creneau_id_fkey" FOREIGN KEY ("creneau_id") REFERENCES "presence_creneaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emargement_signatures" ADD CONSTRAINT "emargement_signatures_coaching_id_fkey" FOREIGN KEY ("coaching_id") REFERENCES "coaching_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emargement_signatures" ADD CONSTRAINT "emargement_signatures_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "emargement_tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emargement_contresignatures" ADD CONSTRAINT "emargement_contresignatures_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "training_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emargement_contresignatures" ADD CONSTRAINT "emargement_contresignatures_coaching_id_fkey" FOREIGN KEY ("coaching_id") REFERENCES "coaching_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emargement_contresignatures" ADD CONSTRAINT "emargement_contresignatures_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- Contraintes NON exprimables dans `schema.prisma`
-- ─────────────────────────────────────────────────────────────────────────────

-- Exclusivité du contexte (polymorphisme D9) : exactement UNE des deux FK est
-- renseignée, et elle est cohérente avec `contexte_type`. Sans ce garde-fou, une
-- signature pourrait n'être rattachée à rien — donc ne rien prouver.
ALTER TABLE "emargement_tokens" ADD CONSTRAINT "ck_emargement_token_contexte"
  CHECK (
       ("contexte_type" = 'collectif'  AND "enrollment_id" IS NOT NULL AND "coaching_id" IS NULL)
    OR ("contexte_type" = 'afest_1to1' AND "coaching_id"   IS NOT NULL AND "enrollment_id" IS NULL)
  );

ALTER TABLE "emargement_signatures" ADD CONSTRAINT "ck_emargement_signature_contexte"
  CHECK (
       ("contexte_type" = 'collectif'  AND "creneau_id"  IS NOT NULL AND "coaching_id" IS NULL)
    OR ("contexte_type" = 'afest_1to1' AND "coaching_id" IS NOT NULL AND "creneau_id"  IS NULL)
  );

ALTER TABLE "emargement_contresignatures" ADD CONSTRAINT "ck_emargement_contresignature_contexte"
  CHECK (
       ("contexte_type" = 'collectif'  AND "session_id"  IS NOT NULL AND "coaching_id" IS NULL)
    OR ("contexte_type" = 'afest_1to1' AND "coaching_id" IS NOT NULL AND "session_id"  IS NULL)
  );

-- Une image sans son empreinte est indétectablement substituable sur R2 : le
-- hash porte sur l'IMAGE, pas sur la clé de stockage. `confirmation_accessible`
-- n'a pas d'image du tout, d'où la branche NULL.
ALTER TABLE "emargement_signatures" ADD CONSTRAINT "ck_emargement_signature_image_hashee"
  CHECK ("signature_key" IS NULL OR "signature_sha256" IS NOT NULL);

ALTER TABLE "emargement_contresignatures" ADD CONSTRAINT "ck_emargement_contresignature_image_hashee"
  CHECK ("signature_key" IS NULL OR "signature_sha256" IS NOT NULL);

-- Horaires RÉELS au format HH:MM. Exigence jurisprudentielle (CAA Nantes
-- 20/04/2021) : une feuille sans horaires exacts est insuffisamment probante.
-- La contrainte interdit d'y glisser un « 09h00-17h00 » approximatif.
ALTER TABLE "emargement_contresignatures" ADD CONSTRAINT "ck_emargement_contresignature_horaires"
  CHECK (
    "heure_debut" ~ '^[0-2][0-9]:[0-5][0-9]$' AND "heure_fin" ~ '^[0-2][0-9]:[0-5][0-9]$'
    AND "heure_fin" > "heure_debut"
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Index UNIQUE PARTIELS — l'unicité ne vaut que sur les lignes NON révoquées.
-- C'est ce qui rend une correction possible : révoquer, puis re-signer.
-- ─────────────────────────────────────────────────────────────────────────────

-- Un stagiaire ne signe qu'une fois par créneau (contexte collectif).
CREATE UNIQUE INDEX "emargement_signature_creneau_active"
  ON "emargement_signatures" ("creneau_id")
  WHERE "revoked_at" IS NULL AND "creneau_id" IS NOT NULL;

-- Un formateur ne contresigne qu'une fois par (session × jour × demi-journée).
-- `trainer_id` fait partie de la clé : en co-animation, deux formateurs peuvent
-- légitimement contresigner la même demi-journée.
CREATE UNIQUE INDEX "emargement_contresignature_creneau_active"
  ON "emargement_contresignatures" ("session_id", "date", "demi_journee", "trainer_id")
  WHERE "revoked_at" IS NULL AND "session_id" IS NOT NULL;

-- Un seul jeton vivant par inscription : sinon deux liens en circulation, et
-- révoquer le mauvais donne une fausse impression de sécurité.
CREATE UNIQUE INDEX "emargement_token_enrollment_actif"
  ON "emargement_tokens" ("enrollment_id")
  WHERE "revoked_at" IS NULL AND "enrollment_id" IS NOT NULL;
