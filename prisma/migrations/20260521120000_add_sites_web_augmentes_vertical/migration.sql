-- B.3 P1.5 — Ajout valeur sites_web_augmentes a l'enum ServiceSector.
-- Doctrine Prisma : ALTER TYPE ADD VALUE IF NOT EXISTS (idempotent, safe prod).
ALTER TYPE "ServiceSector" ADD VALUE IF NOT EXISTS 'sites_web_augmentes';
