-- Lot A9 — SIREN déduit du SIRET pour les fiches existantes.
--
-- Migration de DONNÉES seulement (aucun DDL, aucun DROP). Idempotente : seules
-- les fiches SANS SIREN dont le SIRET compte 14 chiffres sont écrites ; une
-- seconde passe ne trouve plus rien. Un SIREN déjà présent, même s'il contredit
-- le SIRET, n'est jamais écrasé (la fiche l'affiche avec un avertissement).
-- La clé de Luhn n'est pas recontrôlée ici : tout SIRET écrit par la console
-- l'a déjà passée (`checkSiretFormat`), et la lecture (`sirenDuClient`) la
-- recontrôle.
UPDATE "clients" SET "siren" = left("siret", 9) WHERE "siren" IS NULL AND "siret" ~ '^[0-9]{14}$';
