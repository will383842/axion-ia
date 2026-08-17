-- Index de recherche pour les e-mails chiffrés des soumissions.
--
-- ── Le défaut corrigé ─────────────────────────────────────────────────────
-- `submissions.contact_email` reçoit des valeurs chiffrées en AES-256-GCM avec
-- un vecteur d'initialisation ALÉATOIRE (`src/lib/pii-crypto.ts`). Deux
-- chiffrements de la même adresse donnent donc deux valeurs différentes, et une
-- égalité SQL sur cette colonne ne peut JAMAIS correspondre.
--
-- Or c'est exactement ce que faisaient l'export RGPD (art. 15) et l'effacement
-- (art. 17) :
--     WHERE contact_email = 'jean@exemple.fr'
-- Résultat constaté le 2026-08-12 : l'export renvoyait une liste VIDE et
-- l'effacement anonymisait ZÉRO ligne, tous deux en répondant « succès ».
-- Panne silencieuse sur une obligation légale, pour TOUS les formulaires du
-- site (contact unifié, simulateur, candidatures, podcast, avis).
--
-- ── Ce que fait cette migration ───────────────────────────────────────────
-- Ajoute la colonne d'empreinte déterministe qui rend la recherche possible.
-- HMAC-SHA256, secret dérivé de PII_ENCRYPTION_KEY par séparation de domaine
-- (helper `src/lib/security/email-hash.ts`).
--
-- NULLABLE à dessein : les lignes existantes restent à NULL jusqu'au passage du
-- script de remplissage rétroactif
-- `prisma/scripts/backfill-submission-email-hash-2026-08-12.ts`, qui doit être
-- exécuté APRÈS déploiement (il lui faut la clé applicative pour déchiffrer).
-- La colonne est également remise à NULL après un effacement RGPD, pour que la
-- personne redevienne introuvable.
--
-- L'index `submissions_contact_email_idx` historique est CONSERVÉ : il ne sert
-- plus à rien depuis le chiffrement (il indexe des cryptogrammes tous
-- différents), mais le supprimer sort du périmètre de ce correctif.

ALTER TABLE "submissions"
  ADD COLUMN "contact_email_hash" VARCHAR(64);

CREATE INDEX "submissions_contact_email_hash_idx"
  ON "submissions" ("contact_email_hash");
