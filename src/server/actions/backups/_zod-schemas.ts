/**
 * Backups & DR (ADR 0032) — schémas Zod d'ingestion.
 * Alignés sur les payloads émis par scripts/backup-lib.sh
 * (report_backup_run / report_restore_drill).
 */

import { z } from "zod";
import {
  BACKUP_COMPONENTS,
  BACKUP_KINDS,
  BACKUP_STATUSES,
  RESTORE_DRILL_STATUSES,
} from "@/server/backups/types";

const componentEnum = z.enum(BACKUP_COMPONENTS);

export const BackupIngestSchema = z.object({
  component: componentEnum,
  kind: z.enum(BACKUP_KINDS),
  status: z.enum(BACKUP_STATUSES),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullish(),
  durationSec: z.number().int().nonnegative().nullish(),
  sizeBytes: z.number().nonnegative().nullish(),
  checksum: z.string().max(128).nullish(),
  /** Le script envoie une destination unique (ex. "r2+storagebox"). */
  destination: z.string().max(64),
  remotePath: z.string().nullish(),
  failReason: z.string().nullish(),
  consecutiveFailures: z.number().int().nonnegative().default(0),
  source: z.string().max(32).default("cron_vps"),
  hostname: z.string().max(64).nullish(),
});
export type BackupIngestInput = z.infer<typeof BackupIngestSchema>;

export const DrillIngestSchema = z.object({
  component: componentEnum,
  status: z.enum(RESTORE_DRILL_STATUSES),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullish(),
  durationSec: z.number().int().nonnegative().nullish(),
  verifiedRows: z.number().nonnegative().nullish(),
  backupRef: z.string().nullish(),
  checks: z.unknown().nullish(),
  failReason: z.string().nullish(),
  source: z.string().max(32).default("cron_vps"),
});
export type DrillIngestInput = z.infer<typeof DrillIngestSchema>;
