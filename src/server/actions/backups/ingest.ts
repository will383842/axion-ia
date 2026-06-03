/**
 * Backups & DR (ADR 0032) — ingestion d'un BackupRun.
 *
 * Appelée par la route POST /api/internal/backups (auth HMAC).
 * Enrichit rpoTargetMin/ageVsRpoMin à partir de la map RPO_TARGETS_MIN (source
 * unique côté serveur — les scripts restent "bêtes"). Idempotent via la clé header.
 */

import { prisma } from "@/lib/prisma";
import { RPO_TARGETS_MIN } from "@/server/backups/types";
import type { BackupIngestInput } from "./_zod-schemas";

export interface IngestResult {
  created: boolean;
  id: string;
}

/** Découpe "r2+storagebox" → ["r2","storagebox"]. */
function parseDestinations(destination: string): string[] {
  return destination
    .split("+")
    .map((d) => d.trim())
    .filter(Boolean);
}

export async function ingestBackupRun(
  input: BackupIngestInput,
  idempotencyKey: string,
): Promise<IngestResult> {
  const existing = await prisma.backupRun.findUnique({
    where: { idempotencyKey },
    select: { id: true },
  });
  if (existing) return { created: false, id: existing.id };

  const startedAt = new Date(input.startedAt);
  const rpoTargetMin = RPO_TARGETS_MIN[input.component];
  const minutesSince = Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 60_000));
  const ageVsRpoMin = Math.max(0, minutesSince - rpoTargetMin);

  const run = await prisma.backupRun.create({
    data: {
      component: input.component,
      kind: input.kind,
      status: input.status,
      startedAt,
      finishedAt: input.finishedAt ? new Date(input.finishedAt) : null,
      durationSec: input.durationSec ?? null,
      sizeBytes: input.sizeBytes != null ? BigInt(Math.round(input.sizeBytes)) : null,
      checksum: input.checksum ?? null,
      destinations: parseDestinations(input.destination),
      remotePath: input.remotePath ?? null,
      rpoTargetMin,
      ageVsRpoMin,
      failReason: input.failReason ?? null,
      consecutiveFailures: input.consecutiveFailures,
      source: input.source,
      idempotencyKey,
      ...(input.hostname ? { metadata: { hostname: input.hostname } } : {}),
    },
    select: { id: true },
  });
  return { created: true, id: run.id };
}
