-- GEO V2-10 PR-1 — colonnes du Score IA PME (migration SEULE, additive).
-- Colonnes nullables, sans valeur par défaut : aucune ligne existante n'est
-- réécrite (NULL = canal historique). Aucun UPDATE/DELETE/DROP.
-- `source` est un VARCHAR (pas un enum Postgres) pour ne créer aucun contrat
-- d'énumération entre l'app et le worker. Aucun code ne lit ces colonnes ici.
ALTER TABLE "barometer_responses"
  ADD COLUMN "source" VARCHAR(40),
  ADD COLUMN "consent_version" VARCHAR(64),
  ADD COLUMN "code_retrait_hash" VARCHAR(64);

-- Index unique sur colonne nullable : plusieurs NULL admis par Postgres.
CREATE UNIQUE INDEX "barometer_responses_code_retrait_hash_key"
  ON "barometer_responses"("code_retrait_hash");
