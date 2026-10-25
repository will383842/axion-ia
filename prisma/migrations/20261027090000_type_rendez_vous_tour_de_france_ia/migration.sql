-- Tour de France IA (2026-10-25) — la visio de 30 min a désormais son propre type
-- de rendez-vous, classé à l'écriture (`server/calendly/type-rendez-vous.ts`).
--
-- Postgres ALTER TYPE ADD VALUE — additif, instantané, sans reprise de données.
-- La nouvelle valeur n'est utilisée par aucune instruction de cette transaction
-- (ce que Postgres interdirait). Les rendez-vous déjà réservés restent `autre`.
--
-- Fenêtre app/worker (AGENTS.md) : tant que la migration n'est pas passée, une
-- écriture portant la valeur échoue sur « TypeRendezVous » ; le classement du
-- worker retombe alors sur l'écriture sans colonnes (`estColonneTypeRendezVousAbsente`).

ALTER TYPE "type_rendez_vous" ADD VALUE IF NOT EXISTS 'tour_de_france_ia';
