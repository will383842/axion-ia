-- D5-5-03 (2026-08-20) — une candidature était INTROUVABLE par son adresse.
--
-- `job_applications.email` est chiffré par `encryptPii` avec un IV aléatoire :
-- deux chiffrements de la même adresse donnent deux valeurs différentes. Une
-- égalité SQL sur cette colonne ne peut donc jamais correspondre.
--
-- Conséquence : ni l'export (art. 15) ni l'effacement (art. 17) ne pouvaient
-- atteindre une candidature — alors qu'elle porte le CV, la photo et le
-- téléphone, les données les plus sensibles du dépôt.
--
-- Même remède que `submissions.contact_email_hash` : une empreinte HMAC
-- déterministe, indexée. Nullable — les candidatures antérieures n'en ont pas,
-- et le service retombe sur un balayage déchiffrant borné.

ALTER TABLE "job_applications"
  ADD COLUMN IF NOT EXISTS "email_hash" VARCHAR(64);

CREATE INDEX IF NOT EXISTS "job_applications_email_hash_idx"
  ON "job_applications" ("email_hash");
