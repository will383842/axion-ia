-- Fondation P1/P2 (2026-06-25) — additif uniquement.
-- Index (level, timestamp) sur generation_logs pour filtrer rapidement les logs
-- par niveau (error/warn/info) sur une fenêtre temporelle (dashboards / alerting).
-- Idempotent. CONCURRENTLY volontairement omis (Prisma 5.22 wrappe la migration
-- dans une transaction → CREATE INDEX CONCURRENTLY interdit, cf. P3018/E25001).
CREATE INDEX IF NOT EXISTS "generation_logs_level_timestamp_idx"
    ON "generation_logs"("level", "timestamp");
