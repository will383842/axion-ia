-- D5-5-04 (2026-08-24) — une demande de podcast etait INTROUVABLE par son adresse.
--
-- QUATRIEME occurrence de la meme faute. `podcast_requests.email` est chiffre
-- par `encryptPii` avec un IV aleatoire : deux chiffrements de la meme adresse
-- donnent deux valeurs differentes, donc `where: { email }` ne correspond
-- jamais. C'est mot pour mot ce que decrit deja l'en-tete de
-- `src/lib/security/email-hash.ts` a propos des submissions, et la migration
-- `20260820140000_job_application_email_hash` a propos des candidatures.
--
-- Aggravation propre a cette table : elle n'etait meme pas CITEE par la chaine
-- d'effacement. Ni traitee, ni exemptee. Une personne qui remplit le formulaire
-- public /podcast y laisse son nom, son adresse, son telephone, sa ville et son
-- activite ; la route art. 17 lui repondait « vos donnees identifiantes ont ete
-- effacees ou anonymisees » sans toucher une seule de ces colonnes.
--
-- Empreinte HMAC deterministe et indexee, comme les deux precedentes. Nullable :
-- les demandes anterieures n'en ont pas, et le service retombe sur un balayage
-- dechiffrant borne.

ALTER TABLE "podcast_requests"
  ADD COLUMN IF NOT EXISTS "email_hash" VARCHAR(64);

CREATE INDEX IF NOT EXISTS "podcast_requests_email_hash_idx"
  ON "podcast_requests" ("email_hash");
