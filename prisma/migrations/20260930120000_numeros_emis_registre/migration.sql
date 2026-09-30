-- Registre append-only des numéros émis (2026-09-30) — ADDITIF uniquement.
--
-- ## Le défaut constaté en production
--
-- Le 19/08/2026, les données de deux actions ont été supprimées directement en
-- base. `nextNumero` (src/server/qualiopi/numbering/allocate.ts) prenait
-- MAX(séquence) des seules lignes ENCORE PRÉSENTES dans la table métier : la
-- série est repartie à 001 et AXI-FACT-2026-001 a été émis une SECONDE fois le
-- 15/09 (CGI, art. 242 nonies A ann. II : séquence continue, sans réemploi).
-- Engagement ouvert du registre des incidents Qualiopi : « empêcher la
-- réattribution d'un numéro déjà émis ».
--
-- ## Ce que pose cette migration
--
--   1. la table `numeros_emis` (numero PK, table_source, emis_le) ;
--   2. la fonction `numeros_emis_enregistrer`, et un déclencheur
--      `AFTER INSERT OR UPDATE OF <colonne>` sur CHAQUE table dont un
--      allocateur `nextNumero` lit la série (9 tables, 18 sites d'appel) :
--      tout numéro écrit — par l'app neuve, par l'ancienne app encore en vol,
--      par le worker, par un script ou à la main — entre au registre, dans la
--      MÊME transaction que la ligne métier (annulée avec elle) ;
--   3. le refus en base de UPDATE, DELETE et TRUNCATE sur `numeros_emis` ;
--   4. le backfill des numéros PRÉSENTS aujourd'hui, et d'eux seuls.
--
-- La liste des tables est DÉRIVÉE des sites d'appel par
-- `tests/unit/ci/tout-allocateur-alimente-le-registre-des-numeros.spec.ts`,
-- qui rougit si un allocateur lit une table sans déclencheur ici.
--
-- ⚠️ Le doublon AXI-FACT-2026-001 n'est PAS réparé ici : c'est une
-- régularisation comptable qui appartient au dirigeant. Le backfill enregistre
-- ce qui est présent ; le premier AXI-FACT-2026-001, supprimé le 19/08, n'est
-- plus dans aucune table et ne peut pas être reconstitué par SQL.
--
-- ## Fenêtre app/worker (~50 min) et migration best-effort
--
-- Le code neuf peut tourner AVANT cette migration (worker bâti en ~3 min,
-- entrypoint de l'app en best-effort) : `nextNumero` attrape alors l'erreur
-- P2021 « table inexistante » et retombe sur l'ancien calcul. L'ANCIEN code,
-- lui, n'a rien à savoir : les déclencheurs alimentent le registre sans lui.
-- Les deux versions tolèrent donc l'ordre inverse.
--
-- ## Ordre des instructions
--
-- Déclencheurs AVANT backfill : une ligne insérée par l'app en vol entre les
-- deux est vue au moins une fois (ON CONFLICT DO NOTHING absorbe le doublon).
--
-- ## Réversible
--
--   DROP TRIGGER IF EXISTS "numeros_emis_pas_de_truncate" ON "numeros_emis";
--   DROP TRIGGER IF EXISTS "numeros_emis_ajout_seul" ON "numeros_emis";
--   DROP TRIGGER IF EXISTS "reclamations_numero_emis" ON "reclamations";
--   DROP TRIGGER IF EXISTS "factures_formation_numero_emis" ON "factures_formation";
--   DROP TRIGGER IF EXISTS "devis_numero_emis" ON "devis";
--   DROP TRIGGER IF EXISTS "audit_missions_numero_emis" ON "audit_missions";
--   DROP TRIGGER IF EXISTS "trainer_statements_numero_emis" ON "trainer_statements";
--   DROP TRIGGER IF EXISTS "documents_generes_numero_emis" ON "documents_generes";
--   DROP TRIGGER IF EXISTS "clients_numero_emis" ON "clients";
--   DROP TRIGGER IF EXISTS "formations_numero_emis" ON "formations";
--   DROP TRIGGER IF EXISTS "training_sessions_numero_emis" ON "training_sessions";
--   DROP FUNCTION IF EXISTS "numeros_emis_ajout_seul"();
--   DROP FUNCTION IF EXISTS "numeros_emis_enregistrer"();
--   DROP TABLE IF EXISTS "numeros_emis";
-- (Le retrait détruit la mémoire des numéros émis : à ne jouer qu'en
-- connaissance de cause.)

-- CreateTable
CREATE TABLE "numeros_emis" (
    "numero" VARCHAR(60) NOT NULL,
    "table_source" VARCHAR(63) NOT NULL,
    "emis_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "numeros_emis_pkey" PRIMARY KEY ("numero")
);

-- ── Alimentation ─────────────────────────────────────────────────────────────
--
-- La colonne est passée en argument (TG_ARGV[0]) : `trainer_statements` porte
-- sa série sur `numero_facture`, toutes les autres sur `numero`. La valeur est
-- lue par `to_jsonb(NEW)`, sans SQL dynamique. Un numéro NULL (auto-facture
-- pas encore émise) n'est pas un numéro émis : rien n'est écrit.
--
-- Tout numéro entre au registre, y compris les brouillons `BROUILLON-<uuid>`
-- et les fixtures `-DEMO-` : `parseSequence` les écarte à la lecture, comme il
-- le fait déjà pour la table métier. Filtrer ici créerait une seconde règle
-- d'appartenance à la série, que rien ne testerait.
CREATE FUNCTION "numeros_emis_enregistrer"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  valeur text := to_jsonb(NEW) ->> TG_ARGV[0];
BEGIN
  IF valeur IS NOT NULL THEN
    INSERT INTO "numeros_emis" ("numero", "table_source")
    VALUES (valeur, TG_TABLE_NAME)
    ON CONFLICT ("numero") DO NOTHING;
  END IF;
  RETURN NULL;
END
$$;

CREATE TRIGGER "reclamations_numero_emis" AFTER INSERT OR UPDATE OF "numero" ON "reclamations"
  FOR EACH ROW EXECUTE FUNCTION "numeros_emis_enregistrer"('numero');

CREATE TRIGGER "factures_formation_numero_emis" AFTER INSERT OR UPDATE OF "numero" ON "factures_formation"
  FOR EACH ROW EXECUTE FUNCTION "numeros_emis_enregistrer"('numero');

CREATE TRIGGER "devis_numero_emis" AFTER INSERT OR UPDATE OF "numero" ON "devis"
  FOR EACH ROW EXECUTE FUNCTION "numeros_emis_enregistrer"('numero');

CREATE TRIGGER "audit_missions_numero_emis" AFTER INSERT OR UPDATE OF "numero" ON "audit_missions"
  FOR EACH ROW EXECUTE FUNCTION "numeros_emis_enregistrer"('numero');

CREATE TRIGGER "trainer_statements_numero_emis" AFTER INSERT OR UPDATE OF "numero_facture" ON "trainer_statements"
  FOR EACH ROW EXECUTE FUNCTION "numeros_emis_enregistrer"('numero_facture');

CREATE TRIGGER "documents_generes_numero_emis" AFTER INSERT OR UPDATE OF "numero" ON "documents_generes"
  FOR EACH ROW EXECUTE FUNCTION "numeros_emis_enregistrer"('numero');

CREATE TRIGGER "clients_numero_emis" AFTER INSERT OR UPDATE OF "numero" ON "clients"
  FOR EACH ROW EXECUTE FUNCTION "numeros_emis_enregistrer"('numero');

CREATE TRIGGER "formations_numero_emis" AFTER INSERT OR UPDATE OF "numero" ON "formations"
  FOR EACH ROW EXECUTE FUNCTION "numeros_emis_enregistrer"('numero');

CREATE TRIGGER "training_sessions_numero_emis" AFTER INSERT OR UPDATE OF "numero" ON "training_sessions"
  FOR EACH ROW EXECUTE FUNCTION "numeros_emis_enregistrer"('numero');

-- ── Ajout seul ───────────────────────────────────────────────────────────────
--
-- Un numéro émis ne se retire ni ne se modifie : c'est tout l'objet du
-- registre. Aucune exception, pas même sous le drapeau d'effacement RGPD
-- (le registre ne porte aucune donnée personnelle). TRUNCATE ne déclenche pas
-- les déclencheurs de ligne : il a le sien.
CREATE FUNCTION "numeros_emis_ajout_seul"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'numeros_emis : registre en ajout seul — un numéro émis ne se retire ni ne se modifie (CGI art. 242 nonies A ann. II)'
    USING ERRCODE = 'AXN01';
END
$$;

CREATE TRIGGER "numeros_emis_ajout_seul" BEFORE UPDATE OR DELETE ON "numeros_emis"
  FOR EACH ROW EXECUTE FUNCTION "numeros_emis_ajout_seul"();

CREATE TRIGGER "numeros_emis_pas_de_truncate" BEFORE TRUNCATE ON "numeros_emis"
  FOR EACH STATEMENT EXECUTE FUNCTION "numeros_emis_ajout_seul"();

-- ── Backfill : les numéros PRÉSENTS, et eux seuls ────────────────────────────
--
-- `emis_le` reprend `created_at` de la ligne (stocké en UTC sans fuseau par
-- Prisma) : c'est une borne inférieure de l'émission (un brouillon numéroté
-- plus tard porte la date de sa création), jamais une date inventée.
--
-- En cas de même numéro dans deux tables (7 cas hérités, ADR 0035 §4), la
-- première table insérée garde `table_source` : les tables d'ENTITÉS passent
-- avant `documents_generes`, dont les numéros hérités ne sont que des cotes.
INSERT INTO "numeros_emis" ("numero", "table_source", "emis_le")
SELECT "numero", 'factures_formation', "created_at" AT TIME ZONE 'UTC' FROM "factures_formation" WHERE "numero" IS NOT NULL
ON CONFLICT ("numero") DO NOTHING;

INSERT INTO "numeros_emis" ("numero", "table_source", "emis_le")
SELECT "numero_facture", 'trainer_statements', "created_at" AT TIME ZONE 'UTC' FROM "trainer_statements" WHERE "numero_facture" IS NOT NULL
ON CONFLICT ("numero") DO NOTHING;

INSERT INTO "numeros_emis" ("numero", "table_source", "emis_le")
SELECT "numero", 'devis', "created_at" AT TIME ZONE 'UTC' FROM "devis" WHERE "numero" IS NOT NULL
ON CONFLICT ("numero") DO NOTHING;

INSERT INTO "numeros_emis" ("numero", "table_source", "emis_le")
SELECT "numero", 'clients', "created_at" AT TIME ZONE 'UTC' FROM "clients" WHERE "numero" IS NOT NULL
ON CONFLICT ("numero") DO NOTHING;

INSERT INTO "numeros_emis" ("numero", "table_source", "emis_le")
SELECT "numero", 'formations', "created_at" AT TIME ZONE 'UTC' FROM "formations" WHERE "numero" IS NOT NULL
ON CONFLICT ("numero") DO NOTHING;

INSERT INTO "numeros_emis" ("numero", "table_source", "emis_le")
SELECT "numero", 'training_sessions', "created_at" AT TIME ZONE 'UTC' FROM "training_sessions" WHERE "numero" IS NOT NULL
ON CONFLICT ("numero") DO NOTHING;

INSERT INTO "numeros_emis" ("numero", "table_source", "emis_le")
SELECT "numero", 'reclamations', "created_at" AT TIME ZONE 'UTC' FROM "reclamations" WHERE "numero" IS NOT NULL
ON CONFLICT ("numero") DO NOTHING;

INSERT INTO "numeros_emis" ("numero", "table_source", "emis_le")
SELECT "numero", 'audit_missions', "created_at" AT TIME ZONE 'UTC' FROM "audit_missions" WHERE "numero" IS NOT NULL
ON CONFLICT ("numero") DO NOTHING;

INSERT INTO "numeros_emis" ("numero", "table_source", "emis_le")
SELECT "numero", 'documents_generes', "created_at" AT TIME ZONE 'UTC' FROM "documents_generes" WHERE "numero" IS NOT NULL
ON CONFLICT ("numero") DO NOTHING;
