-- Méta-cert 2026-05-15 AGENT 12 P0 OWASP A04 — Idempotency booking submit.
--
-- Ajout colonne `idempotency_key` sur Booking + Submission pour neutraliser
-- les double-submits (clic visiteur répété, retry réseau, prefetch agressif).
-- Client génère un UUID v4 au mount du formulaire, transmis au Server Action.
-- Si un Booking existe déjà avec cette clé → retourne l'existant sans recréer.
--
-- Nullable (legacy bookings sans clé restent valides) + index UNIQUE partiel
-- (postgres : `UNIQUE INDEX ... WHERE column IS NOT NULL`).
--
-- Audit recovery 2026-05-16 : table names corrigés "Booking" → "bookings" et
-- "Submission" → "submissions" (Prisma models mappent vers snake_case via
-- @@map ; la migration référençait à tort le nom du model). Index names
-- conservés bookings_/submissions_ pour cohérence.

-- ---- bookings ----
ALTER TABLE "bookings" ADD COLUMN "idempotency_key" VARCHAR(64);
CREATE UNIQUE INDEX "bookings_idempotency_key_key"
  ON "bookings"("idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;

-- ---- submissions ----
-- La doctrine `createBookingAction` crée Submission+Booking dans la même
-- transaction. Pour rester cohérent (et permettre une dé-duplication aussi
-- côté Submission si jamais le flow se découple), on stocke aussi la clé.
ALTER TABLE "submissions" ADD COLUMN "idempotency_key" VARCHAR(64);
CREATE UNIQUE INDEX "submissions_idempotency_key_key"
  ON "submissions"("idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;
