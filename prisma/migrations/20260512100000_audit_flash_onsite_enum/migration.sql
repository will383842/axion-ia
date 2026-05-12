-- Sprint 14.10.8 (Will 2026-05-12) — ajout valeur enum `audit_flash_onsite`
-- pour permettre la réservation directe sur calendrier du diagnostic Flash
-- terrain (890 € HT) depuis le hub /audit refondu en 2 axes (taille / situation).
--
-- Postgres ALTER TYPE ADD VALUE — non transactionnel mais sûr (l'ajout d'une
-- valeur enum est instantané, pas de lock long, pas de migration data).

ALTER TYPE "InterventionType" ADD VALUE IF NOT EXISTS 'audit_flash_onsite';
