-- Point 11 (#2464, PR C) : les annexes jointes aux e-mails des apporteurs sont figées, hachées et tracées.
-- Migration ADDITIVE : deux tables neuves, aucune clé étrangère, aucune énumération, aucune table existante touchée
-- (fenêtre app/worker : l'ancien code ignore ces tables, le nouveau tolère leur absence).

-- ── A. Les versions d'un document annexe (une ligne par fichier déposé, clé R2 immuable) ───────────────────────────
CREATE TABLE "documents_annexes_versions" (
  "id" UUID NOT NULL,
  "document_id" VARCHAR(40) NOT NULL,
  "sha256" CHAR(64) NOT NULL,
  "cle_r2" VARCHAR(300) NOT NULL,
  "taille" INTEGER NOT NULL,
  "depose_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "depose_par" VARCHAR(64),
  "retiree_at" TIMESTAMPTZ(3),
  CONSTRAINT "documents_annexes_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "documents_annexes_versions_cle_r2_key" ON "documents_annexes_versions" ("cle_r2");
CREATE UNIQUE INDEX "documents_annexes_versions_document_id_sha256_key" ON "documents_annexes_versions" ("document_id", "sha256");
CREATE INDEX "documents_annexes_versions_document_id_depose_at_idx" ON "documents_annexes_versions" ("document_id", "depose_at");

ALTER TABLE "documents_annexes_versions" ADD CONSTRAINT "documents_annexes_versions_document" CHECK (
  "document_id" IN ('fiche-commissions', 'livret', 'guide-demarrage')
);
ALTER TABLE "documents_annexes_versions" ADD CONSTRAINT "documents_annexes_versions_sha256" CHECK (
  "sha256" ~ '^[0-9a-f]{64}$'
);

-- ── B. Ce qui a été REMIS à un apporteur (ajout seul) ──────────────────────────────────────────────────────────────
CREATE TABLE "apporteur_documents_remis" (
  "id" UUID NOT NULL,
  "apporteur_id" UUID NOT NULL,
  "document_id" VARCHAR(40) NOT NULL,
  "version_sha256" CHAR(64) NOT NULL,
  "cle_r2" VARCHAR(300) NOT NULL,
  "contexte" VARCHAR(30) NOT NULL,
  "email_job_id" VARCHAR(120),
  "remis_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "apporteur_documents_remis_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "apporteur_documents_remis_apporteur_id_document_id_version__key"
  ON "apporteur_documents_remis" ("apporteur_id", "document_id", "version_sha256", "contexte", "email_job_id");
CREATE INDEX "apporteur_documents_remis_apporteur_id_remis_at_idx" ON "apporteur_documents_remis" ("apporteur_id", "remis_at");

ALTER TABLE "apporteur_documents_remis" ADD CONSTRAINT "apporteur_documents_remis_document" CHECK (
  "document_id" IN ('fiche-commissions', 'livret', 'guide-demarrage')
);
ALTER TABLE "apporteur_documents_remis" ADD CONSTRAINT "apporteur_documents_remis_contexte" CHECK (
  "contexte" IN ('contrat_signe', 'renvoi_contrat', 'lien_dossier')
);
ALTER TABLE "apporteur_documents_remis" ADD CONSTRAINT "apporteur_documents_remis_sha256" CHECK (
  "version_sha256" ~ '^[0-9a-f]{64}$'
);

-- ── C. Déclencheurs : ni DELETE ni TRUNCATE ; UPDATE restreint ──────────────────────────────────────────────────────
CREATE FUNCTION "documents_annexes_versions_refuse_delete"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'documents_annexes_versions : suppression interdite (une version déposée est une preuve)';
END;
$$ LANGUAGE plpgsql;

-- Seule `retiree_at` peut changer, et seulement de NULL à une date.
CREATE FUNCTION "documents_annexes_versions_garde_update"() RETURNS trigger AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."document_id" IS DISTINCT FROM OLD."document_id"
     OR NEW."sha256" IS DISTINCT FROM OLD."sha256"
     OR NEW."cle_r2" IS DISTINCT FROM OLD."cle_r2"
     OR NEW."taille" IS DISTINCT FROM OLD."taille"
     OR NEW."depose_at" IS DISTINCT FROM OLD."depose_at"
     OR NEW."depose_par" IS DISTINCT FROM OLD."depose_par" THEN
    RAISE EXCEPTION 'documents_annexes_versions : ajout seul, seule la date de retrait peut être posée';
  END IF;
  IF OLD."retiree_at" IS NOT NULL AND NEW."retiree_at" IS DISTINCT FROM OLD."retiree_at" THEN
    RAISE EXCEPTION 'documents_annexes_versions : la date de retrait posée ne change plus';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "documents_annexes_versions_no_delete"
  BEFORE DELETE ON "documents_annexes_versions"
  FOR EACH ROW EXECUTE FUNCTION "documents_annexes_versions_refuse_delete"();
CREATE TRIGGER "documents_annexes_versions_no_truncate"
  BEFORE TRUNCATE ON "documents_annexes_versions"
  FOR EACH STATEMENT EXECUTE FUNCTION "documents_annexes_versions_refuse_delete"();
CREATE TRIGGER "documents_annexes_versions_garde"
  BEFORE UPDATE ON "documents_annexes_versions"
  FOR EACH ROW EXECUTE FUNCTION "documents_annexes_versions_garde_update"();

CREATE FUNCTION "apporteur_documents_remis_refuse_delete"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'apporteur_documents_remis : suppression interdite (ce qui a été remis est une preuve)';
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "apporteur_documents_remis_garde_update"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'apporteur_documents_remis : ajout seul, aucune ligne ne change';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "apporteur_documents_remis_no_delete"
  BEFORE DELETE ON "apporteur_documents_remis"
  FOR EACH ROW EXECUTE FUNCTION "apporteur_documents_remis_refuse_delete"();
CREATE TRIGGER "apporteur_documents_remis_no_truncate"
  BEFORE TRUNCATE ON "apporteur_documents_remis"
  FOR EACH STATEMENT EXECUTE FUNCTION "apporteur_documents_remis_refuse_delete"();
CREATE TRIGGER "apporteur_documents_remis_garde"
  BEFORE UPDATE ON "apporteur_documents_remis"
  FOR EACH ROW EXECUTE FUNCTION "apporteur_documents_remis_garde_update"();
