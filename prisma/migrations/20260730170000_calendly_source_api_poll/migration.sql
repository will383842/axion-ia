-- ADR 0038 — /appel affiche désormais les créneaux Calendly rendus côté serveur.
-- Cliquer un créneau ouvre calendly.com dans un nouvel onglet : la réservation
-- se fait donc HORS de notre page, et le `postMessage` de l'iframe — seule voie
-- de capture jusqu'ici — ne peut plus la signaler.
--
-- Ces réservations sont désormais découvertes par le sondage horaire
-- (`src/server/calendly/discover.ts`, appelé par `api/internal/calendly-refresh`).
-- Elles ont besoin d'une provenance distincte : ni `embed_js` (aucune iframe),
-- ni `manual_import` (personne ne l'a saisie), ni `webhook` (Calendly Free n'en
-- émet aucun).
--
-- Postgres ALTER TYPE ADD VALUE — additif, instantané, sans lock long ni
-- migration de données. La nouvelle valeur n'est utilisée par aucune instruction
-- de cette même transaction, ce que Postgres interdirait.

ALTER TYPE "calendly_event_source" ADD VALUE IF NOT EXISTS 'api_poll';
