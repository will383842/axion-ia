-- Qualiopi — Corrige une dérive schéma↔migration : l'index unique
-- `enrollment_unique_per_session` était déclaré dans schema.prisma (@@unique
-- [sessionId, traineeId]) mais aucune migration ne le créait. Sans lui, des
-- doublons d'inscription (même stagiaire ×N sur une session) sont possibles et
-- l'upsert Prisma dégénère en find-then-create non atomique.
-- ADDITIVE. Pré-requis prod : dédupliquer d'éventuels enrollments en double
-- avant déploiement (en pratique aucun hors démo).

CREATE UNIQUE INDEX IF NOT EXISTS "enrollment_unique_per_session" ON "enrollments"("session_id", "trainee_id");
