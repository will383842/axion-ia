-- Changement d'IBAN d'un apporteur après la signature (plan docs/plans/apporteurs-changement-iban-2026-11-25.md, lot 1).
-- ADDITIF SEUL, compatible avec les DEUX conteneurs (app et worker) : quatre tables neuves, aucune clé étrangère,
-- aucune colonne ajoutée à une table existante, aucune énumération Postgres (le statut est un texte contraint),
-- aucun DROP. Rien ne lit ces tables avant le lot 4 ; tout lecteur tolère la table absente (P2021).
-- Retour arrière : voir docs/runbooks/apporteurs-changement-iban-retour-arriere.md (les tables restent en place).

-- ── A. Les demandes ────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE "apporteur_changements_iban" (
  "id" UUID NOT NULL,
  "apporteur_id" UUID NOT NULL,
  "statut" VARCHAR(16) NOT NULL DEFAULT 'a_confirmer',
  "iban" TEXT NOT NULL,
  "iban_empreinte" CHAR(64) NOT NULL,
  "iban_fin4" CHAR(4) NOT NULL,
  "ancien_iban_empreinte" CHAR(64),
  "ancien_iban_fin4" CHAR(4),
  "origine" VARCHAR(8) NOT NULL,
  "demandee_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "demande_ip_hash" VARCHAR(64),
  "demande_navigateur" VARCHAR(80),
  "avis_envoye_at" TIMESTAMPTZ(3),
  "confirmee_at" TIMESTAMPTZ(3),
  "confirmation_ip_hash" VARCHAR(64),
  "confirmation_navigateur" VARCHAR(80),
  "opposee_at" TIMESTAMPTZ(3),
  "annulee_at" TIMESTAMPTZ(3),
  "expiree_at" TIMESTAMPTZ(3),
  "traitee_at" TIMESTAMPTZ(3),
  "traitee_par" UUID,
  "motif_refus" TEXT,
  "controles" JSONB,
  CONSTRAINT "apporteur_changements_iban_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "apporteur_changements_iban_apporteur_idx" ON "apporteur_changements_iban" ("apporteur_id", "demandee_at");
CREATE INDEX "apporteur_changements_iban_statut_idx" ON "apporteur_changements_iban" ("statut", "confirmee_at");

-- Une seule demande OUVERTE par apporteur (deux onglets : la seconde est refusée par la base).
CREATE UNIQUE INDEX "apporteur_changements_iban_une_ouverte"
  ON "apporteur_changements_iban" ("apporteur_id")
  WHERE "statut" IN ('a_confirmer', 'confirmee');

ALTER TABLE "apporteur_changements_iban" ADD CONSTRAINT "apporteur_changements_iban_statut" CHECK (
  "statut" IN ('a_confirmer', 'confirmee', 'validee', 'refusee', 'opposee', 'annulee', 'expiree')
);
ALTER TABLE "apporteur_changements_iban" ADD CONSTRAINT "apporteur_changements_iban_origine" CHECK (
  "origine" IN ('espace', 'console')
);
-- L'IBAN n'est JAMAIS en clair : le FORMAT complet de `encryptPii` v2 (`iv:chiffré:tag` en hexadécimal) est exigé,
-- un simple préfixe laisserait passer « enc:v2:FR76… ». ⚠️ L'IBAN de la fiche est en `enc:v1` : le copier tel quel
-- dans l'historique est REFUSÉ ; le code déchiffre puis rechiffre en v2 avec la donnée liée (plan §3.2).
ALTER TABLE "apporteur_changements_iban" ADD CONSTRAINT "apporteur_changements_iban_iban_chiffre" CHECK (
  "iban" ~ '^enc:v2:[0-9a-f]{24}:[0-9a-f]+:[0-9a-f]{32}$'
);
ALTER TABLE "apporteur_changements_iban" ADD CONSTRAINT "apporteur_changements_iban_empreintes" CHECK (
  "iban_empreinte" ~ '^[0-9a-f]{64}$'
  AND ("ancien_iban_empreinte" IS NULL OR "ancien_iban_empreinte" ~ '^[0-9a-f]{64}$')
  AND "iban_fin4" ~ '^[A-Z0-9]{4}$'
  AND ("ancien_iban_fin4" IS NULL OR "ancien_iban_fin4" ~ '^[A-Z0-9]{4}$')
);
-- Cohérence : un état ne se prétend pas atteint sans sa date ; une décision porte son auteur ; un refus son motif.
ALTER TABLE "apporteur_changements_iban" ADD CONSTRAINT "apporteur_changements_iban_coherence" CHECK (
  ("statut" NOT IN ('confirmee', 'validee') OR "confirmee_at" IS NOT NULL)
  AND ("statut" <> 'validee' OR ("traitee_at" IS NOT NULL AND "traitee_par" IS NOT NULL))
  AND ("statut" <> 'refusee' OR ("traitee_at" IS NOT NULL AND "traitee_par" IS NOT NULL
        AND "motif_refus" IS NOT NULL AND length(btrim("motif_refus")) > 0))
  -- Défense en profondeur du délai d'opposition : une validation date d'au moins 72 h après la confirmation.
  AND ("statut" <> 'validee' OR "traitee_at" >= "confirmee_at" + interval '72 hours')
  AND ("statut" <> 'opposee' OR "opposee_at" IS NOT NULL)
  AND ("statut" <> 'annulee' OR "annulee_at" IS NOT NULL)
  AND ("statut" <> 'expiree' OR "expiree_at" IS NOT NULL)
);

-- Une demande n'est jamais supprimée ni vidée : preuve de la décision.
CREATE FUNCTION "apporteur_changements_iban_refuse_delete"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'apporteur_changements_iban : suppression interdite (une demande est une preuve)';
END;
$$ LANGUAGE plpgsql;

-- Le coeur d'une demande ne change plus après sa création : la fiche, l'IBAN demandé (chiffré, empreinte, quatre
-- derniers caractères), l'ancien compte, l'origine, la date et la preuve de la demande. Seuls avancent le statut et
-- les champs de suivi. Une demande décidée (validée, refusée, opposée, annulée, expirée) est figée en entier.
CREATE FUNCTION "apporteur_changements_iban_garde_update"() RETURNS trigger AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."apporteur_id" IS DISTINCT FROM OLD."apporteur_id"
     OR NEW."iban" IS DISTINCT FROM OLD."iban"
     OR NEW."iban_empreinte" IS DISTINCT FROM OLD."iban_empreinte"
     OR NEW."iban_fin4" IS DISTINCT FROM OLD."iban_fin4"
     OR NEW."ancien_iban_empreinte" IS DISTINCT FROM OLD."ancien_iban_empreinte"
     OR NEW."ancien_iban_fin4" IS DISTINCT FROM OLD."ancien_iban_fin4"
     OR NEW."origine" IS DISTINCT FROM OLD."origine"
     OR NEW."demandee_at" IS DISTINCT FROM OLD."demandee_at"
     OR NEW."demande_ip_hash" IS DISTINCT FROM OLD."demande_ip_hash"
     OR NEW."demande_navigateur" IS DISTINCT FROM OLD."demande_navigateur" THEN
    RAISE EXCEPTION 'apporteur_changements_iban : le coeur d''une demande ne change pas';
  END IF;
  IF OLD."statut" IN ('validee', 'refusee', 'opposee', 'annulee', 'expiree')
     AND (NEW."statut" IS DISTINCT FROM OLD."statut"
          OR NEW."confirmee_at" IS DISTINCT FROM OLD."confirmee_at"
          OR NEW."traitee_at" IS DISTINCT FROM OLD."traitee_at"
          OR NEW."traitee_par" IS DISTINCT FROM OLD."traitee_par"
          OR NEW."motif_refus" IS DISTINCT FROM OLD."motif_refus"
          OR NEW."opposee_at" IS DISTINCT FROM OLD."opposee_at"
          OR NEW."annulee_at" IS DISTINCT FROM OLD."annulee_at"
          OR NEW."expiree_at" IS DISTINCT FROM OLD."expiree_at"
          OR NEW."controles" IS DISTINCT FROM OLD."controles"
          OR NEW."avis_envoye_at" IS DISTINCT FROM OLD."avis_envoye_at"
          OR NEW."confirmation_ip_hash" IS DISTINCT FROM OLD."confirmation_ip_hash"
          OR NEW."confirmation_navigateur" IS DISTINCT FROM OLD."confirmation_navigateur") THEN
    RAISE EXCEPTION 'apporteur_changements_iban : une demande décidée est figée';
  END IF;
  -- La preuve de la confirmation ne se réécrit pas une fois posée (le délai de 72 h repose sur `confirmee_at`).
  IF (OLD."confirmee_at" IS NOT NULL AND NEW."confirmee_at" IS DISTINCT FROM OLD."confirmee_at")
     OR (OLD."confirmation_ip_hash" IS NOT NULL AND NEW."confirmation_ip_hash" IS DISTINCT FROM OLD."confirmation_ip_hash")
     OR (OLD."confirmation_navigateur" IS NOT NULL AND NEW."confirmation_navigateur" IS DISTINCT FROM OLD."confirmation_navigateur") THEN
    RAISE EXCEPTION 'apporteur_changements_iban : la preuve de la confirmation ne change plus';
  END IF;
  -- Chaque champ de suivi ne s'écrit qu'avec la transition qui le porte (jamais seul, jamais sur une autre).
  IF ((NEW."confirmee_at" IS DISTINCT FROM OLD."confirmee_at"
       OR NEW."confirmation_ip_hash" IS DISTINCT FROM OLD."confirmation_ip_hash"
       OR NEW."confirmation_navigateur" IS DISTINCT FROM OLD."confirmation_navigateur")
      AND NOT (OLD."statut" = 'a_confirmer' AND NEW."statut" = 'confirmee'))
     OR (NEW."opposee_at" IS DISTINCT FROM OLD."opposee_at" AND NEW."statut" <> 'opposee')
     OR (NEW."annulee_at" IS DISTINCT FROM OLD."annulee_at" AND NEW."statut" <> 'annulee')
     OR (NEW."expiree_at" IS DISTINCT FROM OLD."expiree_at" AND NEW."statut" <> 'expiree')
     OR ((NEW."traitee_at" IS DISTINCT FROM OLD."traitee_at" OR NEW."traitee_par" IS DISTINCT FROM OLD."traitee_par"
          OR NEW."motif_refus" IS DISTINCT FROM OLD."motif_refus") AND NEW."statut" NOT IN ('validee', 'refusee'))
     OR (OLD."avis_envoye_at" IS NOT NULL AND NEW."avis_envoye_at" IS DISTINCT FROM OLD."avis_envoye_at") THEN
    RAISE EXCEPTION 'apporteur_changements_iban : un champ de suivi ne s''écrit qu''avec sa transition';
  END IF;
  -- Une demande confirmée ne revient pas en arrière ; on ne saute pas à « validée » sans être passé par « confirmée ».
  IF NEW."statut" IS DISTINCT FROM OLD."statut" THEN
    IF NOT (
      (OLD."statut" = 'a_confirmer' AND NEW."statut" IN ('confirmee', 'opposee', 'annulee', 'expiree'))
      OR (OLD."statut" = 'confirmee' AND NEW."statut" IN ('validee', 'refusee', 'opposee', 'annulee'))
    ) THEN
      RAISE EXCEPTION 'apporteur_changements_iban : transition % -> % interdite', OLD."statut", NEW."statut";
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Une demande NAÎT « à confirmer », sans aucune trace d'étape ultérieure : on ne l'insère jamais déjà confirmée,
-- ni validée, ni avec une confirmation antidatée (le délai de 72 h et l'e-mail de confirmation ne se contournent pas).
CREATE FUNCTION "apporteur_changements_iban_garde_insert"() RETURNS trigger AS $$
BEGIN
  IF NEW."statut" <> 'a_confirmer'
     OR NEW."avis_envoye_at" IS NOT NULL OR NEW."confirmee_at" IS NOT NULL
     OR NEW."confirmation_ip_hash" IS NOT NULL OR NEW."confirmation_navigateur" IS NOT NULL
     OR NEW."opposee_at" IS NOT NULL OR NEW."annulee_at" IS NOT NULL OR NEW."expiree_at" IS NOT NULL
     OR NEW."traitee_at" IS NOT NULL OR NEW."traitee_par" IS NOT NULL
     OR NEW."motif_refus" IS NOT NULL OR NEW."controles" IS NOT NULL THEN
    RAISE EXCEPTION 'apporteur_changements_iban : une demande naît « a_confirmer », sans trace d''étape ultérieure';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Les dates d'étape sont POSÉES par la base (`clock_timestamp()`), jamais fournies par l'appelant : toute valeur
-- passée pour `demandee_at`, `confirmee_at`, `traitee_at`, `opposee_at`, `annulee_at` ou `expiree_at` à la
-- transition qui la porte est ÉCRASÉE. Une confirmation ne s'antidate donc pas (le délai d'opposition est exact,
-- pas « 72 h moins une minute »), une validation ne se date pas dans le futur, et le code applicatif n'a aucune
-- date à fournir (pas de dépendance à son horloge). Le contrôle des 72 h se lit sur `OLD.confirmee_at`.
-- Fonction à part : un test peut désactiver ce seul déclencheur (dans une transaction annulée) pour fabriquer des
-- demandes anciennes, sans désactiver les gardes de transition.
CREATE FUNCTION "apporteur_changements_iban_garde_horloge"() RETURNS trigger AS $$
DECLARE
  maintenant timestamptz := clock_timestamp();
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW."demandee_at" := maintenant;
    RETURN NEW;
  END IF;
  IF NEW."statut" IS DISTINCT FROM OLD."statut" THEN
    IF NEW."statut" = 'confirmee' THEN
      NEW."confirmee_at" := maintenant;
    ELSIF NEW."statut" IN ('validee', 'refusee') THEN
      NEW."traitee_at" := maintenant;
    ELSIF NEW."statut" = 'opposee' THEN
      NEW."opposee_at" := maintenant;
    ELSIF NEW."statut" = 'annulee' THEN
      NEW."annulee_at" := maintenant;
    ELSIF NEW."statut" = 'expiree' THEN
      NEW."expiree_at" := maintenant;
    END IF;
    IF NEW."statut" = 'validee' AND maintenant < OLD."confirmee_at" + interval '72 hours' THEN
      RAISE EXCEPTION 'apporteur_changements_iban : validation avant la fin du délai d''opposition de 72 heures';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "apporteur_changements_iban_horloge"
  BEFORE INSERT OR UPDATE ON "apporteur_changements_iban"
  FOR EACH ROW EXECUTE FUNCTION "apporteur_changements_iban_garde_horloge"();

CREATE TRIGGER "apporteur_changements_iban_no_delete"
  BEFORE DELETE ON "apporteur_changements_iban"
  FOR EACH ROW EXECUTE FUNCTION "apporteur_changements_iban_refuse_delete"();
CREATE TRIGGER "apporteur_changements_iban_no_truncate"
  BEFORE TRUNCATE ON "apporteur_changements_iban"
  FOR EACH STATEMENT EXECUTE FUNCTION "apporteur_changements_iban_refuse_delete"();
CREATE TRIGGER "apporteur_changements_iban_garde_ins"
  BEFORE INSERT ON "apporteur_changements_iban"
  FOR EACH ROW EXECUTE FUNCTION "apporteur_changements_iban_garde_insert"();
CREATE TRIGGER "apporteur_changements_iban_garde"
  BEFORE UPDATE ON "apporteur_changements_iban"
  FOR EACH ROW EXECUTE FUNCTION "apporteur_changements_iban_garde_update"();

-- ── B. Le RIB joint à la demande ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE "apporteur_changements_iban_rib" (
  "demande_id" UUID NOT NULL,
  "octets" BYTEA,
  "sha256" CHAR(64) NOT NULL,
  "type_mime" VARCHAR(100) NOT NULL,
  "taille" INTEGER NOT NULL,
  "nom_fichier" VARCHAR(255),
  "depose_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "purge_at" TIMESTAMPTZ(3),
  CONSTRAINT "apporteur_changements_iban_rib_pkey" PRIMARY KEY ("demande_id")
);
-- Même plafond que `TAILLE_MAX_PIECE` (10 Mo) : le contrôle de la base double celui du code.
ALTER TABLE "apporteur_changements_iban_rib" ADD CONSTRAINT "apporteur_changements_iban_rib_taille" CHECK (
  "taille" > 0 AND "taille" <= 10485760
);
ALTER TABLE "apporteur_changements_iban_rib" ADD CONSTRAINT "apporteur_changements_iban_rib_sha256" CHECK (
  "sha256" ~ '^[0-9a-f]{64}$'
);
-- Les octets sont soit là, soit purgés (et alors `purge_at` le dit) : jamais un RIB à moitié effacé.
ALTER TABLE "apporteur_changements_iban_rib" ADD CONSTRAINT "apporteur_changements_iban_rib_purge" CHECK (
  ("octets" IS NULL) = ("purge_at" IS NOT NULL)
);
-- Des octets présents sont ceux de l'enveloppe chiffrée (`AXB1`) : jamais un PDF en clair.
ALTER TABLE "apporteur_changements_iban_rib" ADD CONSTRAINT "apporteur_changements_iban_rib_chiffre" CHECK (
  "octets" IS NULL OR substring("octets" FROM 1 FOR 4) = '\x41584231'::bytea
);

-- Un RIB joint n'est ni supprimé ni remplacé : seule la PURGE est permise (octets -> NULL avec `purge_at`).
CREATE FUNCTION "apporteur_changements_iban_rib_refuse_delete"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'apporteur_changements_iban_rib : suppression interdite (seule la purge des octets est permise)';
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "apporteur_changements_iban_rib_garde_update"() RETURNS trigger AS $$
BEGIN
  IF NEW."demande_id" IS DISTINCT FROM OLD."demande_id"
     OR NEW."sha256" IS DISTINCT FROM OLD."sha256"
     OR NEW."type_mime" IS DISTINCT FROM OLD."type_mime"
     OR NEW."taille" IS DISTINCT FROM OLD."taille"
     OR NEW."nom_fichier" IS DISTINCT FROM OLD."nom_fichier"
     OR NEW."depose_at" IS DISTINCT FROM OLD."depose_at" THEN
    RAISE EXCEPTION 'apporteur_changements_iban_rib : seule la purge des octets est permise';
  END IF;
  IF NEW."octets" IS DISTINCT FROM OLD."octets" AND NOT (NEW."octets" IS NULL AND OLD."octets" IS NOT NULL) THEN
    RAISE EXCEPTION 'apporteur_changements_iban_rib : les octets ne sont jamais remplacés, seulement purgés';
  END IF;
  IF OLD."purge_at" IS NOT NULL AND NEW."purge_at" IS DISTINCT FROM OLD."purge_at" THEN
    RAISE EXCEPTION 'apporteur_changements_iban_rib : la date de purge ne change plus';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "apporteur_changements_iban_rib_no_delete"
  BEFORE DELETE ON "apporteur_changements_iban_rib"
  FOR EACH ROW EXECUTE FUNCTION "apporteur_changements_iban_rib_refuse_delete"();
CREATE TRIGGER "apporteur_changements_iban_rib_no_truncate"
  BEFORE TRUNCATE ON "apporteur_changements_iban_rib"
  FOR EACH STATEMENT EXECUTE FUNCTION "apporteur_changements_iban_rib_refuse_delete"();
CREATE TRIGGER "apporteur_changements_iban_rib_garde"
  BEFORE UPDATE ON "apporteur_changements_iban_rib"
  FOR EACH ROW EXECUTE FUNCTION "apporteur_changements_iban_rib_garde_update"();

-- ── C. L'historique des comptes (ajout seul) ───────────────────────────────────────────────────────────────────
CREATE TABLE "apporteur_iban_historique" (
  "id" UUID NOT NULL,
  "apporteur_id" UUID NOT NULL,
  "iban" TEXT NOT NULL,
  "iban_empreinte" CHAR(64) NOT NULL,
  "iban_fin4" CHAR(4) NOT NULL,
  "en_vigueur_de" TIMESTAMPTZ(3),
  "en_vigueur_jusqua" TIMESTAMPTZ(3),
  "origine" VARCHAR(16) NOT NULL,
  "demande_id" UUID,
  "piece_rib_id" UUID,
  "cree_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "apporteur_iban_historique_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "apporteur_iban_historique_apporteur_idx" ON "apporteur_iban_historique" ("apporteur_id", "cree_at");
CREATE INDEX "apporteur_iban_historique_empreinte_idx" ON "apporteur_iban_historique" ("iban_empreinte");
-- Un seul compte EN VIGUEUR par apporteur, et une seule ligne d'historique par demande (rejeu du script de reprise).
CREATE UNIQUE INDEX "apporteur_iban_historique_un_courant"
  ON "apporteur_iban_historique" ("apporteur_id") WHERE "en_vigueur_jusqua" IS NULL;
CREATE UNIQUE INDEX "apporteur_iban_historique_une_par_demande"
  ON "apporteur_iban_historique" ("demande_id") WHERE "demande_id" IS NOT NULL;

ALTER TABLE "apporteur_iban_historique" ADD CONSTRAINT "apporteur_iban_historique_origine" CHECK (
  "origine" IN ('dossier_initial', 'changement')
);
ALTER TABLE "apporteur_iban_historique" ADD CONSTRAINT "apporteur_iban_historique_iban_chiffre" CHECK (
  "iban" ~ '^enc:v2:[0-9a-f]{24}:[0-9a-f]+:[0-9a-f]{32}$'
);
ALTER TABLE "apporteur_iban_historique" ADD CONSTRAINT "apporteur_iban_historique_empreinte" CHECK (
  "iban_empreinte" ~ '^[0-9a-f]{64}$' AND "iban_fin4" ~ '^[A-Z0-9]{4}$'
);
ALTER TABLE "apporteur_iban_historique" ADD CONSTRAINT "apporteur_iban_historique_periode" CHECK (
  "en_vigueur_jusqua" IS NULL OR "en_vigueur_de" IS NULL OR "en_vigueur_jusqua" >= "en_vigueur_de"
);
-- Un compte « changement » vient d'une demande.
ALTER TABLE "apporteur_iban_historique" ADD CONSTRAINT "apporteur_iban_historique_demande" CHECK (
  "origine" <> 'changement' OR "demande_id" IS NOT NULL
);

CREATE FUNCTION "apporteur_iban_historique_refuse_delete"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'apporteur_iban_historique : suppression interdite (ajout seul)';
END;
$$ LANGUAGE plpgsql;

-- Seule `en_vigueur_jusqua` peut changer, et seulement de NULL à une date.
CREATE FUNCTION "apporteur_iban_historique_garde_update"() RETURNS trigger AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."apporteur_id" IS DISTINCT FROM OLD."apporteur_id"
     OR NEW."iban" IS DISTINCT FROM OLD."iban"
     OR NEW."iban_empreinte" IS DISTINCT FROM OLD."iban_empreinte"
     OR NEW."iban_fin4" IS DISTINCT FROM OLD."iban_fin4"
     OR NEW."en_vigueur_de" IS DISTINCT FROM OLD."en_vigueur_de"
     OR NEW."origine" IS DISTINCT FROM OLD."origine"
     OR NEW."demande_id" IS DISTINCT FROM OLD."demande_id"
     OR NEW."piece_rib_id" IS DISTINCT FROM OLD."piece_rib_id"
     OR NEW."cree_at" IS DISTINCT FROM OLD."cree_at" THEN
    RAISE EXCEPTION 'apporteur_iban_historique : ajout seul, seule la fin de validité peut être posée';
  END IF;
  IF OLD."en_vigueur_jusqua" IS NOT NULL
     AND NEW."en_vigueur_jusqua" IS DISTINCT FROM OLD."en_vigueur_jusqua" THEN
    RAISE EXCEPTION 'apporteur_iban_historique : la fin de validité posée ne change plus';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "apporteur_iban_historique_no_delete"
  BEFORE DELETE ON "apporteur_iban_historique"
  FOR EACH ROW EXECUTE FUNCTION "apporteur_iban_historique_refuse_delete"();
CREATE TRIGGER "apporteur_iban_historique_no_truncate"
  BEFORE TRUNCATE ON "apporteur_iban_historique"
  FOR EACH STATEMENT EXECUTE FUNCTION "apporteur_iban_historique_refuse_delete"();
CREATE TRIGGER "apporteur_iban_historique_garde"
  BEFORE UPDATE ON "apporteur_iban_historique"
  FOR EACH ROW EXECUTE FUNCTION "apporteur_iban_historique_garde_update"();

-- ── D. Sur quel compte un virement est parti (ajout seul) ──────────────────────────────────────────────────────
CREATE TABLE "apporteur_virements_compte" (
  "id" UUID NOT NULL,
  "autofacture_numero" VARCHAR(40) NOT NULL,
  "apporteur_id" UUID NOT NULL,
  "iban_empreinte" CHAR(64) NOT NULL,
  "iban_fin4" CHAR(4) NOT NULL,
  -- Instant du « Virement fait » (le même que `commissions_apporteur.versee_at`) : une autofacture peut être
  -- versée en PLUSIEURS fois (complément après une ligne suspendue), sur des comptes différents.
  "verse_at" TIMESTAMPTZ(3) NOT NULL,
  "declare_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "declare_par" VARCHAR(64) NOT NULL,
  "premier_sur_ce_compte" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "apporteur_virements_compte_pkey" PRIMARY KEY ("id")
);
-- Le rejeu d'un même « Virement fait » (même autofacture, même instant) n'écrit pas deux lignes.
CREATE UNIQUE INDEX "apporteur_virements_compte_numero_verse_key"
  ON "apporteur_virements_compte" ("autofacture_numero", "verse_at");
CREATE INDEX "apporteur_virements_compte_apporteur_idx" ON "apporteur_virements_compte" ("apporteur_id", "declare_at");
ALTER TABLE "apporteur_virements_compte" ADD CONSTRAINT "apporteur_virements_compte_empreinte" CHECK (
  "iban_empreinte" ~ '^[0-9a-f]{64}$' AND "iban_fin4" ~ '^[A-Z0-9]{4}$'
);

CREATE FUNCTION "apporteur_virements_compte_ajout_seul"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'apporteur_virements_compte : ajout seul (ni modification, ni suppression)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "apporteur_virements_compte_no_update_delete"
  BEFORE UPDATE OR DELETE ON "apporteur_virements_compte"
  FOR EACH ROW EXECUTE FUNCTION "apporteur_virements_compte_ajout_seul"();
CREATE TRIGGER "apporteur_virements_compte_no_truncate"
  BEFORE TRUNCATE ON "apporteur_virements_compte"
  FOR EACH STATEMENT EXECUTE FUNCTION "apporteur_virements_compte_ajout_seul"();
