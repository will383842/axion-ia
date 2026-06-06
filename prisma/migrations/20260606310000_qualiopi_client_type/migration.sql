-- R-B2C (audit E2E 2026-06-06) — type de client entreprise|particulier.
-- Additif, non destructif : colonne NOT NULL avec DEFAULT 'entreprise'
-- (tous les clients existants restent entreprise).

CREATE TYPE "ClientType" AS ENUM ('entreprise', 'particulier');

ALTER TABLE "clients" ADD COLUMN "type" "ClientType" NOT NULL DEFAULT 'entreprise';
