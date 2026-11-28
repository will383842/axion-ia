-- Lot I (#2464, point 4) : la table des primes de challenge.
-- Ajout seul : une table NEUVE, aucune clé étrangère, aucune énumération Postgres (statut en VARCHAR + CHECK).
-- Fenêtre app/worker : tout lecteur tolère la table absente (P2021).

CREATE TABLE "challenges_primes" (
    "id" UUID NOT NULL,
    "challenge_id" UUID NOT NULL,
    "apporteur_id" UUID NOT NULL,
    "statut" VARCHAR(20) NOT NULL DEFAULT 'a_valider',
    "atteint_le" DATE NOT NULL,
    "nb_journees" INTEGER NOT NULL,
    "preuves" JSONB NOT NULL,
    "decidee_par" VARCHAR(64),
    "decidee_at" TIMESTAMPTZ(3),
    "motif" VARCHAR(300),
    "commission_id" UUID,
    "cree_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maj_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "challenges_primes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "challenges_primes_statut_check" CHECK ("statut" IN ('a_valider', 'validee', 'refusee', 'a_reprendre', 'reprise')),
    CONSTRAINT "challenges_primes_nb_journees_check" CHECK ("nb_journees" >= 1),
    CONSTRAINT "challenges_primes_refus_motive_check" CHECK ("statut" <> 'refusee' OR "motif" IS NOT NULL)
);

CREATE UNIQUE INDEX "challenges_primes_challenge_id_apporteur_id_key" ON "challenges_primes"("challenge_id", "apporteur_id");
CREATE INDEX "challenges_primes_statut_idx" ON "challenges_primes"("statut");

-- Jamais deux primes sur une même période : seconde barrière (la publication refuse déjà les chevauchements).
CREATE OR REPLACE FUNCTION "challenges_primes_une_par_periode"() RETURNS trigger AS $$
BEGIN
  IF NEW."statut" <> 'refusee' AND EXISTS (
    SELECT 1
    FROM "challenges_primes" p
    JOIN "challenges_apporteur" autre ON autre."id" = p."challenge_id"
    JOIN "challenges_apporteur" ce ON ce."id" = NEW."challenge_id"
    WHERE p."apporteur_id" = NEW."apporteur_id"
      AND p."statut" <> 'refusee'
      AND ce."debut_le" <= autre."fin_le" AND autre."debut_le" <= ce."fin_le"
  ) THEN
    RAISE EXCEPTION 'challenges_primes : une seule prime par apporteur et par période';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "challenges_primes_une_par_periode_trg"
  BEFORE INSERT ON "challenges_primes"
  FOR EACH ROW EXECUTE FUNCTION "challenges_primes_une_par_periode"();

-- Pas de DELETE : une prime se refuse, se reprend ou est mise à l'écart, jamais supprimée.
CREATE OR REPLACE FUNCTION "challenges_primes_pas_de_delete"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'challenges_primes : une prime ne se supprime pas';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "challenges_primes_pas_de_delete_trg"
  BEFORE DELETE ON "challenges_primes"
  FOR EACH ROW EXECUTE FUNCTION "challenges_primes_pas_de_delete"();
