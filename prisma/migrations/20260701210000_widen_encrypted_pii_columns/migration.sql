-- Élargit les colonnes PII chiffrées de la table `submissions` en TEXT.
--
-- Cause (audit 2026-07-01) : `contact_name` (encryptPii) et surtout
-- `contact_phone` (encryptPii) reçoivent des valeurs chiffrées AES-256-GCM au
-- format `enc:v1:<iv>:<ct>:<tag>` (~100+ caractères). Les types VARCHAR(255) /
-- VARCHAR(30) débordaient → Prisma P2000 « value too long for the column's
-- type » sur `submission.create` → TOUTES les soumissions de formulaire
-- échouaient dès que PII_ENCRYPTION_KEY est active en prod.
--
-- Additif / non destructif (élargissement de type). `contact_email` est déjà
-- Citext (illimité), inchangé.
ALTER TABLE "submissions" ALTER COLUMN "contact_phone" TYPE TEXT;
ALTER TABLE "submissions" ALTER COLUMN "contact_name" TYPE TEXT;
