-- Relevé MENSUEL d'information des apporteurs (plan docs/plans/PLAN-RELEVE-MENSUEL-APPORTEURS.md § 4, lot 3a ; ADR 0078).
-- ADDITIF SEUL, compatible avec les DEUX conteneurs (app et worker) : un type et deux tables NEUFS, deux colonnes
-- NULLABLES sur `commissions_apporteur`, index, triggers. Aucun DROP, aucun UPDATE, aucun remplissage rétroactif ;
-- rien de recréé de l'existant (autofacture, mandat, TVA figée). Rien ne lit ces objets avant les lots suivants ;
-- tout lecteur tolère la table absente (P2021).

-- CreateEnum
CREATE TYPE "statut_releve_mensuel" AS ENUM ('prepare', 'envoi_en_cours', 'envoye', 'echec', 'ecarte');

-- AlterTable
ALTER TABLE "commissions_apporteur" ADD COLUMN     "regle_appliquee" VARCHAR(40),
ADD COLUMN     "version_contrat" VARCHAR(10);

-- CreateTable
CREATE TABLE "releves_mensuels_apporteur" (
    "id" UUID NOT NULL,
    "numero" VARCHAR(40) NOT NULL,
    "apporteur_id" UUID NOT NULL,
    "periode" CHAR(7) NOT NULL,
    "rang" INTEGER NOT NULL DEFAULT 0,
    "rectifie_id" UUID,
    "statut" "statut_releve_mensuel" NOT NULL DEFAULT 'prepare',
    "format_version" INTEGER NOT NULL DEFAULT 1,
    "coupure_at" TIMESTAMPTZ(3) NOT NULL,
    "contenu" JSONB NOT NULL,
    "empreinte_sha256" CHAR(64) NOT NULL,
    "pdf_r2_key" VARCHAR(300),
    "pdf_sha256" CHAR(64),
    "nb_lignes" INTEGER NOT NULL DEFAULT 0,
    "factures_ht_cents" INTEGER NOT NULL DEFAULT 0,
    "avoirs_ht_cents" INTEGER NOT NULL DEFAULT 0,
    "vires_ttc_cents" INTEGER NOT NULL DEFAULT 0,
    "en_attente_ht_cents" INTEGER NOT NULL DEFAULT 0,
    "cumul_annee_ht_cents" INTEGER NOT NULL DEFAULT 0,
    "email_job_id" VARCHAR(120),
    "prepare_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pris_at" TIMESTAMPTZ(3),
    "envoye_at" TIMESTAMPTZ(3),
    "envoye_par" VARCHAR(60),
    "lot_id" UUID,
    "motif_ecart" VARCHAR(300),
    "erreur" VARCHAR(300),
    "cree_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maj_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "releves_mensuels_apporteur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lots_releve_mensuel" (
    "id" UUID NOT NULL,
    "periode" CHAR(7) NOT NULL,
    "declenche_par" VARCHAR(60) NOT NULL,
    "debut_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fin_at" TIMESTAMPTZ(3),
    "abandonne_at" TIMESTAMPTZ(3),
    "nb_cibles" INTEGER NOT NULL DEFAULT 0,
    "nb_envoyes" INTEGER NOT NULL DEFAULT 0,
    "nb_deja_envoyes" INTEGER NOT NULL DEFAULT 0,
    "nb_echecs" INTEGER NOT NULL DEFAULT 0,
    "nb_bloques" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "lots_releve_mensuel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "releves_mensuels_apporteur_numero_key" ON "releves_mensuels_apporteur"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "releves_mensuels_apporteur_email_job_id_key" ON "releves_mensuels_apporteur"("email_job_id");

-- CreateIndex
CREATE INDEX "releves_mensuels_apporteur_periode_statut_idx" ON "releves_mensuels_apporteur"("periode", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "releves_mensuels_apporteur_apporteur_id_periode_rang_key" ON "releves_mensuels_apporteur"("apporteur_id", "periode", "rang");

-- CreateIndex
CREATE INDEX "lots_releve_mensuel_periode_idx" ON "lots_releve_mensuel"("periode");

-- AddForeignKey
ALTER TABLE "releves_mensuels_apporteur" ADD CONSTRAINT "releves_mensuels_apporteur_apporteur_id_fkey" FOREIGN KEY ("apporteur_id") REFERENCES "apporteurs_reseau"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ── Un seul lot VIVANT par période, garanti en base (plan § 6.3) ───────────────────────────────────────────────
-- Index unique PARTIEL (absent du schéma Prisma, qui ne sait pas l'exprimer) : un second lot refuse d'être inséré.
CREATE UNIQUE INDEX "lots_releve_mensuel_un_en_cours"
  ON "lots_releve_mensuel" ("periode")
  WHERE "fin_at" IS NULL AND "abandonne_at" IS NULL;

-- ── Le relevé envoyé est FIGÉ en base (plan § 2.4) ─────────────────────────────────────────────────────────────
-- Dès que l'ancien statut n'est plus `prepare`, ni le numéro, ni la période, ni le contenu, ni l'empreinte, ni le
-- PDF ne changent ; un relevé `envoye` ne revient jamais à un autre statut. Une erreur se corrige par un rectificatif.
CREATE FUNCTION "releves_mensuels_apporteur_garde_update"() RETURNS trigger AS $$
BEGIN
  IF (OLD."statut" <> 'prepare' OR OLD."pris_at" IS NOT NULL OR OLD."email_job_id" IS NOT NULL)
     AND (NEW."id" IS DISTINCT FROM OLD."id"
          OR NEW."rectifie_id" IS DISTINCT FROM OLD."rectifie_id"
          OR NEW."format_version" IS DISTINCT FROM OLD."format_version"
          OR NEW."numero" IS DISTINCT FROM OLD."numero"
          OR NEW."apporteur_id" IS DISTINCT FROM OLD."apporteur_id"
          OR NEW."periode" IS DISTINCT FROM OLD."periode"
          OR NEW."rang" IS DISTINCT FROM OLD."rang"
          OR NEW."coupure_at" IS DISTINCT FROM OLD."coupure_at"
          OR NEW."contenu" IS DISTINCT FROM OLD."contenu"
          OR NEW."empreinte_sha256" IS DISTINCT FROM OLD."empreinte_sha256"
          OR NEW."pdf_r2_key" IS DISTINCT FROM OLD."pdf_r2_key"
          OR NEW."pdf_sha256" IS DISTINCT FROM OLD."pdf_sha256"
          OR (OLD."pris_at" IS NOT NULL AND NEW."pris_at" IS DISTINCT FROM OLD."pris_at")
          OR (OLD."email_job_id" IS NOT NULL AND NEW."email_job_id" IS DISTINCT FROM OLD."email_job_id")) THEN
    RAISE EXCEPTION 'releves_mensuels_apporteur : un relevé qui n''est plus « prepare » est figé (rectificatif requis)';
  END IF;
  IF OLD."statut" = 'envoye' AND NEW."statut" <> 'envoye' THEN
    RAISE EXCEPTION 'releves_mensuels_apporteur : un relevé envoyé ne change plus de statut';
  END IF;
  -- Un relevé envoyé garde aussi les chiffres que la console montre et la trace de son envoi.
  IF OLD."statut" = 'envoye'
     AND (NEW."nb_lignes" IS DISTINCT FROM OLD."nb_lignes"
          OR NEW."factures_ht_cents" IS DISTINCT FROM OLD."factures_ht_cents"
          OR NEW."avoirs_ht_cents" IS DISTINCT FROM OLD."avoirs_ht_cents"
          OR NEW."vires_ttc_cents" IS DISTINCT FROM OLD."vires_ttc_cents"
          OR NEW."en_attente_ht_cents" IS DISTINCT FROM OLD."en_attente_ht_cents"
          OR NEW."cumul_annee_ht_cents" IS DISTINCT FROM OLD."cumul_annee_ht_cents"
          OR NEW."envoye_at" IS DISTINCT FROM OLD."envoye_at"
          OR NEW."envoye_par" IS DISTINCT FROM OLD."envoye_par") THEN
    RAISE EXCEPTION 'releves_mensuels_apporteur : les totaux et la trace d''envoi d''un relevé envoyé sont figés';
  END IF;
  -- La prise (§ 6.4) se fait depuis `prepare` ou `echec` seulement, jamais depuis `ecarte`.
  IF OLD."statut" = 'ecarte' AND NEW."statut" = 'envoi_en_cours' THEN
    RAISE EXCEPTION 'releves_mensuels_apporteur : un relevé écarté n''est pas pris pour envoi (prepare ou echec seulement)';
  END IF;
  -- Un relevé pris pour envoi ne revient jamais à « prepare » (sinon le contenu serait réécrit après coup).
  IF OLD."statut" IN ('envoi_en_cours', 'echec', 'envoye') AND NEW."statut" = 'prepare' THEN
    RAISE EXCEPTION 'releves_mensuels_apporteur : un relevé pris pour envoi ne revient jamais à « prepare »';
  END IF;
  -- Une ligne en plein envoi (e-mail peut-être déjà enfilé) ne s'écarte pas : seule la reprise (§ 6.4) tranche
  -- entre `envoye` et `echec`. Sans cela : envoi_en_cours → ecarte → prepare contournait le figement.
  IF OLD."statut" = 'envoi_en_cours' AND NEW."statut" = 'ecarte' THEN
    RAISE EXCEPTION 'releves_mensuels_apporteur : un relevé en cours d''envoi ne s''écarte pas';
  END IF;
  -- Désécarter (`ecarte` → `prepare`) n'est permis qu'à une ligne qui n'a JAMAIS été prise ni portée par un job.
  IF NEW."statut" = 'prepare' AND OLD."statut" <> 'prepare'
     AND (OLD."pris_at" IS NOT NULL OR OLD."email_job_id" IS NOT NULL) THEN
    RAISE EXCEPTION 'releves_mensuels_apporteur : un relevé déjà pris pour envoi ne revient jamais à « prepare »';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "releves_mensuels_apporteur_garde_update"
  BEFORE UPDATE ON "releves_mensuels_apporteur"
  FOR EACH ROW EXECUTE FUNCTION "releves_mensuels_apporteur_garde_update"();

-- Une ligne qui n'est plus `prepare` (pièce d'information envoyée, écartée avec motif) n'est jamais supprimée.
CREATE FUNCTION "releves_mensuels_apporteur_refuse_delete"() RETURNS trigger AS $$
BEGIN
  IF OLD."statut" <> 'prepare' OR OLD."pris_at" IS NOT NULL OR OLD."email_job_id" IS NOT NULL THEN
    RAISE EXCEPTION 'releves_mensuels_apporteur : suppression interdite d''un relevé qui n''est plus « prepare »';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "releves_mensuels_apporteur_refuse_delete"
  BEFORE DELETE ON "releves_mensuels_apporteur"
  FOR EACH ROW EXECUTE FUNCTION "releves_mensuels_apporteur_refuse_delete"();

-- Un TRUNCATE ne déclenche pas les triggers de ligne : il vidait la table, relevés envoyés compris.
CREATE FUNCTION "releves_mensuels_apporteur_refuse_truncate"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'releves_mensuels_apporteur : TRUNCATE interdit (relevés envoyés à conserver)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "releves_mensuels_apporteur_refuse_truncate"
  BEFORE TRUNCATE ON "releves_mensuels_apporteur"
  FOR EACH STATEMENT EXECUTE FUNCTION "releves_mensuels_apporteur_refuse_truncate"();

-- La chaîne des rectificatifs ne pointe jamais dans le vide (table neuve et vide : pose gratuite).
ALTER TABLE "releves_mensuels_apporteur"
  ADD CONSTRAINT "releves_mensuels_apporteur_rectifie_id_fkey"
  FOREIGN KEY ("rectifie_id") REFERENCES "releves_mensuels_apporteur"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ── Contraintes CHECK (tables neuves et vides : pose gratuite) ──────────────────────────────────────────────────
ALTER TABLE "releves_mensuels_apporteur"
  ADD CONSTRAINT "releves_mensuels_apporteur_periode_format"
    CHECK ("periode" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  ADD CONSTRAINT "releves_mensuels_apporteur_rang_coherent"
    CHECK ("rang" >= 0 AND ("rang" = 0) = ("rectifie_id" IS NULL)),
  ADD CONSTRAINT "releves_mensuels_apporteur_ecart_motive"
    CHECK ("statut" <> 'ecarte' OR "motif_ecart" IS NOT NULL),
  ADD CONSTRAINT "releves_mensuels_apporteur_envoye_complet"
    CHECK ("statut" <> 'envoye' OR ("envoye_at" IS NOT NULL AND "email_job_id" IS NOT NULL)),
  ADD CONSTRAINT "releves_mensuels_apporteur_prise_tracee"
    CHECK ("statut" NOT IN ('envoi_en_cours', 'echec', 'envoye') OR "pris_at" IS NOT NULL),
  ADD CONSTRAINT "releves_mensuels_apporteur_empreinte_format"
    CHECK ("empreinte_sha256" ~ '^[0-9a-f]{64}$');
