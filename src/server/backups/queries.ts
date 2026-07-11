/**
 * Backups & DR (ADR 0032) — lectures pour le dashboard admin /infra/backups.
 * Lecture seule (prisma.backupRun / prisma.restoreDrill). Aucune écriture.
 */

import { prisma } from "@/lib/prisma";
import {
  ACCEPTED_GAP_COMPONENTS,
  BACKUP_COMPONENTS,
  COMPONENT_LABELS_FR,
  DRILL_STALE_DAYS,
  RPO_TARGETS_MIN,
  type BackupBanners,
  type BackupComponentValue,
  type BackupHistoryItem,
  type BackupHistoryPage,
  type BackupOverviewRow,
  type BackupStatusValue,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

function toneFor(
  status: BackupStatusValue | null,
  ageVsRpoMin: number | null,
): BackupOverviewRow["tone"] {
  if (status == null || status === "failed") return "destructive";
  if (status === "warning" || status === "skipped" || (ageVsRpoMin != null && ageVsRpoMin > 0)) {
    return "warning";
  }
  return "success";
}

/** Vue d'ensemble : dernier backup + dernier drill réussi, par composant. */
export async function getBackupOverview(): Promise<BackupOverviewRow[]> {
  const rows = await Promise.all(
    BACKUP_COMPONENTS.map(async (component) => {
      const [lastRun, lastDrill] = await Promise.all([
        prisma.backupRun.findFirst({
          where: { component },
          orderBy: { startedAt: "desc" },
          select: {
            status: true,
            startedAt: true,
            sizeBytes: true,
            durationSec: true,
            destinations: true,
            ageVsRpoMin: true,
          },
        }),
        prisma.restoreDrill.findFirst({
          where: { component, status: "passed" },
          orderBy: { startedAt: "desc" },
          select: { startedAt: true },
        }),
      ]);

      const lastStatus = (lastRun?.status ?? null) as BackupStatusValue | null;
      const ageVsRpoMin = lastRun?.ageVsRpoMin ?? null;
      const lastDrillAt = lastDrill?.startedAt ?? null;
      const acceptedGap = ACCEPTED_GAP_COMPONENTS.has(component);
      const drillStale =
        !acceptedGap &&
        (lastDrillAt == null || Date.now() - lastDrillAt.getTime() > DRILL_STALE_DAYS * DAY_MS);

      return {
        component: component as BackupComponentValue,
        label: COMPONENT_LABELS_FR[component],
        lastStatus,
        lastAt: lastRun?.startedAt ?? null,
        sizeBytes: lastRun?.sizeBytes ?? null,
        durationSec: lastRun?.durationSec ?? null,
        destinations: lastRun?.destinations ?? [],
        rpoTargetMin: RPO_TARGETS_MIN[component],
        ageVsRpoMin,
        tone: acceptedGap ? "neutral" : toneFor(lastStatus, ageVsRpoMin),
        lastDrillAt,
        drillStale,
        acceptedGap,
      } satisfies BackupOverviewRow;
    }),
  );
  return rows;
}

/** Historique paginé (optionnellement filtré par composant). */
export async function getBackupHistory(opts: {
  page: number;
  pageSize?: number;
  component?: BackupComponentValue;
}): Promise<BackupHistoryPage> {
  const pageSize = opts.pageSize ?? 25;
  const page = Math.max(1, opts.page);
  const where = opts.component ? { component: opts.component } : {};

  const [total, runs] = await Promise.all([
    prisma.backupRun.count({ where }),
    prisma.backupRun.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        component: true,
        kind: true,
        status: true,
        startedAt: true,
        durationSec: true,
        sizeBytes: true,
        destinations: true,
        ageVsRpoMin: true,
        failReason: true,
      },
    }),
  ]);

  const items: BackupHistoryItem[] = runs.map((r) => ({
    id: r.id,
    component: r.component as BackupComponentValue,
    componentLabel: COMPONENT_LABELS_FR[r.component as BackupComponentValue],
    kind: r.kind,
    status: r.status as BackupStatusValue,
    startedAt: r.startedAt,
    durationSec: r.durationSec,
    sizeBytes: r.sizeBytes,
    destinations: r.destinations,
    ageVsRpoMin: r.ageVsRpoMin,
    failReason: r.failReason,
  }));

  return { items, total, page, pageSize };
}

/** Bandeaux d'alerte calculés depuis la vue d'ensemble. */
export function computeBanners(overview: ReadonlyArray<BackupOverviewRow>): BackupBanners {
  const missed = overview.filter(
    (o) => !o.acceptedGap && (o.tone === "destructive" || (o.ageVsRpoMin ?? 0) > 0),
  );
  const stale = overview.filter((o) => !o.acceptedGap && o.drillStale);
  const details: string[] = [];
  for (const o of missed) {
    details.push(
      o.lastStatus == null
        ? `${o.label} : jamais sauvegardé`
        : `${o.label} : ${o.lastStatus === "failed" ? "dernier backup en échec" : "en retard vs RPO"}`,
    );
  }
  return {
    missedBackup: missed.length > 0,
    cascading: false, // affiné via getBackupAlerts (consecutiveFailures)
    staleDrill: stale.length > 0,
    details,
  };
}

// ─── Intégration /alerts (source "backups", lecture DB locale) ───────────────
export interface BackupAlert {
  source: "backups";
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  url: string | null;
  createdAt: string | null;
}

/**
 * Alertes backups pour la page /alerts : dernier run failed, retard RPO, ou
 * drill périmé. `adminPrefix` pour pointer vers /infra/backups.
 */
export async function getBackupAlerts(adminPrefix: string): Promise<BackupAlert[]> {
  const overview = await getBackupOverview();
  const url = `/fr/${adminPrefix}/infra/backups`;
  const alerts: BackupAlert[] = [];
  for (const o of overview) {
    if (o.acceptedGap) continue; // trou de sauvegarde assumé → aucune alerte
    if (o.lastStatus === "failed" || o.lastStatus == null) {
      alerts.push({
        source: "backups",
        severity: "critical",
        title: `Backup ${o.label}`,
        detail: o.lastStatus == null ? "jamais sauvegardé" : "dernier backup en échec",
        url,
        createdAt: o.lastAt ? o.lastAt.toISOString() : null,
      });
    } else if ((o.ageVsRpoMin ?? 0) > 0) {
      alerts.push({
        source: "backups",
        severity: "warning",
        title: `Backup ${o.label} en retard`,
        detail: `retard de ${o.ageVsRpoMin} min vs RPO`,
        url,
        createdAt: o.lastAt ? o.lastAt.toISOString() : null,
      });
    }
    if (o.drillStale) {
      alerts.push({
        source: "backups",
        severity: "warning",
        title: `Drill ${o.label} périmé`,
        detail: `aucun test de restauration réussi depuis > ${DRILL_STALE_DAYS} j`,
        url,
        createdAt: o.lastDrillAt ? o.lastDrillAt.toISOString() : null,
      });
    }
  }
  return alerts;
}
