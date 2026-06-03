/**
 * Backups & DR (ADR 0032) — ingestion d'un RestoreDrill.
 * Appelée par POST /api/internal/backups/drills (auth HMAC). Idempotent.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../../prisma/generated/client";
import type { DrillIngestInput } from "./_zod-schemas";
import type { IngestResult } from "./ingest";

export async function ingestRestoreDrill(
  input: DrillIngestInput,
  idempotencyKey: string,
): Promise<IngestResult> {
  const existing = await prisma.restoreDrill.findUnique({
    where: { idempotencyKey },
    select: { id: true },
  });
  if (existing) return { created: false, id: existing.id };

  const drill = await prisma.restoreDrill.create({
    data: {
      component: input.component,
      status: input.status,
      startedAt: new Date(input.startedAt),
      finishedAt: input.finishedAt ? new Date(input.finishedAt) : null,
      durationSec: input.durationSec ?? null,
      verifiedRows: input.verifiedRows != null ? BigInt(Math.round(input.verifiedRows)) : null,
      backupRef: input.backupRef ?? null,
      ...(input.checks != null ? { checks: input.checks as Prisma.InputJsonValue } : {}),
      failReason: input.failReason ?? null,
      source: input.source,
      idempotencyKey,
    },
    select: { id: true },
  });
  return { created: true, id: drill.id };
}
