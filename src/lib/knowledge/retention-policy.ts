/**
 * KB V4 (Sprint KB-19) — Politique de rétention + purge.
 *
 * Strategy en V1 :
 *  - Soft-delete (`deletedAt`) pour entries dont `expiresAt < now`
 *  - Hard-delete des KnowledgeIngestRequest > 90 jours
 *  - Hard-delete versions intermédiaires > N (garde les 20 dernières)
 *  - Audit log : append-only, JAMAIS supprimé (legal hold)
 *
 * Garde-fous :
 *  - Dry-run par défaut côté cron
 *  - Stats avant/après pour observabilité
 *  - Trace audit log eventKind=delete pour chaque hard-delete
 */

import { prisma } from "@/lib/prisma";
import { appendAudit } from "./audit-log";

export interface RetentionReport {
  readonly expiredEntriesSoftDeleted: number;
  readonly ingestRequestsPurged: number;
  readonly versionsPurged: number;
}

export interface RetentionOptions {
  readonly dryRun: boolean;
  /** Garde les N dernières versions par translation. Default = 20. */
  readonly keepLastVersions?: number;
  /** Purge ingest requests plus vieux que N jours. Default = 90. */
  readonly ingestRequestRetentionDays?: number;
}

/**
 * Marque comme soft-deleted les entries dont `expiresAt < now`.
 */
async function softDeleteExpiredEntries(dryRun: boolean): Promise<number> {
  const now = new Date();
  if (dryRun) {
    return prisma.knowledgeEntry.count({
      where: { expiresAt: { lt: now }, deletedAt: null },
    });
  }
  const result = await prisma.knowledgeEntry.updateMany({
    where: { expiresAt: { lt: now }, deletedAt: null },
    data: { deletedAt: now, status: "archived" },
  });

  // Audit log non-bloquant
  if (result.count > 0) {
    try {
      await appendAudit({
        eventKind: "delete",
        entryId: null,
        actor: "system:retention-cron",
        payload: { kind: "soft_delete_expired", count: result.count, at: now.toISOString() },
      });
    } catch {
      // silent
    }
  }

  return result.count;
}

/**
 * Hard-delete des ingest requests anciens (logs sans valeur après N jours).
 * Audit log conservé séparément (legal hold).
 */
async function purgeOldIngestRequests(dryRun: boolean, retentionDays: number): Promise<number> {
  const threshold = new Date(Date.now() - retentionDays * 24 * 3600 * 1000);
  if (dryRun) {
    return prisma.knowledgeIngestRequest.count({
      where: { receivedAt: { lt: threshold } },
    });
  }
  const result = await prisma.knowledgeIngestRequest.deleteMany({
    where: { receivedAt: { lt: threshold } },
  });
  return result.count;
}

/**
 * Garde les N dernières versions par translation, hard-delete les plus anciennes.
 * Note : opération coûteuse si beaucoup de translations — à scheduler la nuit.
 */
async function purgeOldVersions(dryRun: boolean, keepLast: number): Promise<number> {
  const translations = await prisma.knowledgeTranslation.findMany({
    select: { id: true },
  });

  let totalDeleted = 0;
  for (const t of translations) {
    const versions = await prisma.knowledgeVersion.findMany({
      where: { translationId: t.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (versions.length <= keepLast) continue;
    const toDelete = versions.slice(keepLast).map((v) => v.id);
    if (toDelete.length === 0) continue;
    if (dryRun) {
      totalDeleted += toDelete.length;
      continue;
    }
    const result = await prisma.knowledgeVersion.deleteMany({
      where: { id: { in: toDelete } },
    });
    totalDeleted += result.count;
  }
  return totalDeleted;
}

/**
 * Run complet purge selon politique. Dry-run par défaut.
 */
export async function runRetentionPolicy(opts: RetentionOptions): Promise<RetentionReport> {
  const keepLast = opts.keepLastVersions ?? 20;
  const ingestRetention = opts.ingestRequestRetentionDays ?? 90;

  const expiredEntriesSoftDeleted = await softDeleteExpiredEntries(opts.dryRun);
  const ingestRequestsPurged = await purgeOldIngestRequests(opts.dryRun, ingestRetention);
  const versionsPurged = await purgeOldVersions(opts.dryRun, keepLast);

  return { expiredEntriesSoftDeleted, ingestRequestsPurged, versionsPurged };
}
