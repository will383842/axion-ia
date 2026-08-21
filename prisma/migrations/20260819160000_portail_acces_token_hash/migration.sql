-- 🔴 `D4-4-A` — le jeton d'accès au portail stagiaire était stocké EN CLAIR.
--
-- Ce jeton EST le mot de passe du portail : il ouvre l'espace stagiaire
-- (besoins d'adaptation, données de santé, pièces nominatives), il vaut cookie
-- de session, et il vit 90 jours. En clair dans `portail_acces`, toute lecture
-- de la table — sauvegarde, dump, accès en lecture, injection — rendait une
-- liste de sésames directement utilisables, pour tous les stagiaires d'un coup.
--
-- Les trois autres canaux de jeton du dépôt stockaient déjà un SHA-256
-- (`document_signature_tokens.token_hash`, `emargement_tokens`). Celui-ci était
-- l'exception, et c'était le seul à valoir une session persistante.
--
-- ⚠️ Les jetons DÉJÀ ÉMIS sont repris par hachage, et non révoqués : les liens
-- envoyés dans les convocations restent valables. Les révoquer en masse aurait
-- coupé l'accès de tous les stagiaires en cours de parcours sans prévenir
-- personne, pour un incident qui n'a pas eu lieu.

ALTER TABLE "portail_acces" ADD COLUMN "token_hash" VARCHAR(64);

-- `sha256(bytea)` est en coeur PostgreSQL depuis la 11 — pas besoin de pgcrypto.
-- Le hachage est le MÊME que celui du service (SHA-256 hex minuscule de l'UTF-8),
-- sans quoi les liens en circulation cesseraient de fonctionner en silence.
UPDATE "portail_acces" SET "token_hash" = encode(sha256("token"::bytea), 'hex');

ALTER TABLE "portail_acces" ALTER COLUMN "token_hash" SET NOT NULL;

DROP INDEX IF EXISTS "portail_acces_token_key";
ALTER TABLE "portail_acces" DROP COLUMN "token";

CREATE UNIQUE INDEX "portail_acces_token_hash_key" ON "portail_acces"("token_hash");
