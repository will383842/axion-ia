-- Sauvegardes & DR (ADR 0032) — tables de suivi alimentées par les scripts backup-*.sh
-- + restore-*-test*.sh via POST HMAC /api/internal/backups[/drills].
-- Migration additive (aucune table existante modifiée).

-- CreateEnum
CREATE TYPE "backup_component" AS ENUM ('postgres', 'postgres_pitr', 'redis', 'files_image_bank', 'docuseal', 'plausible_pg', 'plausible_clickhouse', 'secrets', 'git_mirror');

-- CreateEnum
CREATE TYPE "backup_kind" AS ENUM ('daily', 'weekly', 'monthly', 'pitr', 'manual');

-- CreateEnum
CREATE TYPE "backup_status" AS ENUM ('success', 'warning', 'failed', 'running', 'skipped');

-- CreateEnum
CREATE TYPE "restore_drill_status" AS ENUM ('passed', 'failed', 'partial', 'running');

-- CreateTable
CREATE TABLE "backup_runs" (
    "id" TEXT NOT NULL,
    "component" "backup_component" NOT NULL,
    "kind" "backup_kind" NOT NULL,
    "status" "backup_status" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationSec" INTEGER,
    "sizeBytes" BIGINT,
    "checksum" VARCHAR(128),
    "destinations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "remotePath" TEXT,
    "rpoTargetMin" INTEGER,
    "ageVsRpoMin" INTEGER,
    "failReason" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "source" VARCHAR(32) NOT NULL DEFAULT 'cron_vps',
    "idempotencyKey" VARCHAR(64),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restore_drills" (
    "id" TEXT NOT NULL,
    "component" "backup_component" NOT NULL,
    "status" "restore_drill_status" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationSec" INTEGER,
    "backupRef" TEXT,
    "verifiedRows" BIGINT,
    "checks" JSONB,
    "failReason" TEXT,
    "source" VARCHAR(32) NOT NULL DEFAULT 'cron_vps',
    "idempotencyKey" VARCHAR(64),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restore_drills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "backup_runs_idempotencyKey_key" ON "backup_runs"("idempotencyKey");

-- CreateIndex
CREATE INDEX "backup_runs_component_startedAt_idx" ON "backup_runs"("component", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "backup_runs_status_startedAt_idx" ON "backup_runs"("status", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "backup_runs_kind_startedAt_idx" ON "backup_runs"("kind", "startedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "restore_drills_idempotencyKey_key" ON "restore_drills"("idempotencyKey");

-- CreateIndex
CREATE INDEX "restore_drills_component_startedAt_idx" ON "restore_drills"("component", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "restore_drills_status_startedAt_idx" ON "restore_drills"("status", "startedAt" DESC);
