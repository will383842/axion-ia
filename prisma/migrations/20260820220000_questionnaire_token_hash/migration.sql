-- 🔴 `D4-5-S1` — le jeton du questionnaire était stocké EN CLAIR.
--
-- Ce jeton ouvre le questionnaire d'un stagiaire ou l'enquête d'une entreprise
-- cliente : il permet de LIRE les réponses déjà données et d'en ÉCRIRE d'autres
-- au nom du répondant. Les notes qu'il porte alimentent le taux de satisfaction
-- Qualiopi (indicateurs 30-31). En clair dans la table, toute lecture — dump,
-- sauvegarde, accès en lecture — rendait une liste de sésames utilisables.
--
-- La table voisine `portail_acces` a été convertie la veille (`D4-4-A`) ; celle
-- -ci était restée. Le correctif avait traité une instance, pas la classe.
--
-- ⚠️ Les jetons DÉJÀ ÉMIS sont repris par HACHAGE, pas révoqués : les liens
-- envoyés dans les enquêtes entreprise restent valables. Le hachage est le même
-- que celui du service (`hacher-token.ts` : SHA-256 hex minuscule de l'UTF-8),
-- sans quoi les liens en circulation cesseraient de fonctionner en silence.

ALTER TABLE "questionnaires" ADD COLUMN "token_hash" VARCHAR(64);

-- `sha256(bytea)` est en coeur PostgreSQL depuis la 11 — pas besoin de pgcrypto.
UPDATE "questionnaires" SET "token_hash" = encode(sha256("token"::bytea), 'hex');

ALTER TABLE "questionnaires" ALTER COLUMN "token_hash" SET NOT NULL;

DROP INDEX IF EXISTS "questionnaires_token_key";
ALTER TABLE "questionnaires" DROP COLUMN "token";

CREATE UNIQUE INDEX "questionnaires_token_hash_key" ON "questionnaires"("token_hash");
