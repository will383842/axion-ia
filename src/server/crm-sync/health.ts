/**
 * SANTÉ de la synchro CRM (lot L5) — le modèle de lecture de la console.
 *
 * Une seule fonction, un seul aller-retour de pensée : « est-ce que ça passe,
 * et sinon depuis quand ». Les compteurs sont dérivés des statuts de l'outbox
 * (plan §2.9) et rien n'est stocké en double — une métrique recopiée dans une
 * table dérive, une métrique calculée ne peut pas mentir.
 *
 * 🔴 Lecture SEULE, sans le moindre effet de bord. La carte de la console ne
 * doit ni émettre, ni alerter, ni marquer quoi que ce soit : afficher un
 * tableau de bord ne doit jamais changer ce qu'il mesure.
 */

import { prisma } from "@/lib/prisma";

import { CRM_SYNC_BACKLOG_THRESHOLD } from "./alerts";
import { crmSyncSecret, crmSyncUrl, isCrmSyncCandidatesEnabled, isCrmSyncEnabled } from "./config";
import { collectReconciliation, type ReconcileReport } from "./reconcile";

/** Statuts possibles d'une ligne d'outbox (miroir de l'enum Prisma). */
export const CRM_SYNC_STATUSES = ["pending", "sent", "failed", "gave_up"] as const;
export type CrmSyncStatusName = (typeof CRM_SYNC_STATUSES)[number];

/** Nombre de lignes en erreur détaillées sous la carte. */
export const CRM_SYNC_ERROR_ROWS = 20;

export interface CrmSyncErrorRow {
  id: string;
  eventType: string;
  subjectRef: string;
  universe: string;
  status: CrmSyncStatusName;
  attempts: number;
  responseStatus: number | null;
  lastError: string | null;
  lastAttemptAt: Date | null;
  createdAt: Date;
  /** Corps exact qui aurait dû partir, pour diagnostic (replié dans l'UI). */
  payload: unknown;
}

export interface CrmSyncHealth {
  /** Drapeaux — une carte vide n'est une anomalie que si la synchro est allumée. */
  enabled: boolean;
  candidatesEnabled: boolean;
  /** URL + secret présents : sans eux aucune émission n'est possible. */
  configured: boolean;

  counts: Record<CrmSyncStatusName, number>;
  /** `pending` + `failed` : ce qui reste à passer. */
  backlog: number;
  backlogThreshold: number;
  /** Lignes dont la dernière tentative a échoué dans les 24 h. */
  failures24h: number;
  /** Lignes acquittées par le CRM dans les 24 h. */
  sent24h: number;
  lastSentAt: Date | null;
  /** Âge du plus vieux `pending`/`failed` — le RETARD MAX du plan. */
  oldestPendingAt: Date | null;
  oldestPendingMinutes: number | null;

  /** Événements reçus du CRM (consentements, sens inverse). */
  inbound: { total: number; last24h: number; lastAt: Date | null };

  /** Écart source ↔ outbox, recalculé à l'affichage (aucun effet de bord). */
  reconciliation: ReconcileReport;

  errors: CrmSyncErrorRow[];
}

export async function getCrmSyncHealth(): Promise<CrmSyncHealth> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [grouped, failures24h, sent24h, lastSent, oldest, inboundTotal, inbound24h, lastInbound] =
    await Promise.all([
      prisma.crmSyncOutbox.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.crmSyncOutbox.count({
        where: { status: { in: ["failed", "gave_up"] }, lastAttemptAt: { gte: since24h } },
      }),
      prisma.crmSyncOutbox.count({ where: { status: "sent", sentAt: { gte: since24h } } }),
      prisma.crmSyncOutbox.findFirst({
        where: { status: "sent" },
        orderBy: { sentAt: "desc" },
        select: { sentAt: true },
      }),
      prisma.crmSyncOutbox.findFirst({
        where: { status: { in: ["pending", "failed"] } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
      prisma.crmInboundEvent.count(),
      prisma.crmInboundEvent.count({ where: { createdAt: { gte: since24h } } }),
      prisma.crmInboundEvent.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

  const counts: Record<CrmSyncStatusName, number> = {
    pending: 0,
    sent: 0,
    failed: 0,
    gave_up: 0,
  };
  for (const row of grouped) {
    const status = row.status as CrmSyncStatusName;
    if (status in counts) counts[status] = row._count._all;
  }

  const errors = await prisma.crmSyncOutbox.findMany({
    where: { status: { in: ["failed", "gave_up"] } },
    // Trié par date de tentative et non de création : ce qu'on veut voir en
    // premier, c'est ce qui vient de casser, pas ce qui traîne depuis huit jours.
    orderBy: [{ lastAttemptAt: "desc" }, { createdAt: "desc" }],
    take: CRM_SYNC_ERROR_ROWS,
    select: {
      id: true,
      eventType: true,
      subjectRef: true,
      universe: true,
      status: true,
      attempts: true,
      responseStatus: true,
      lastError: true,
      lastAttemptAt: true,
      createdAt: true,
      payload: true,
    },
  });

  const oldestPendingAt = oldest?.createdAt ?? null;

  return {
    enabled: isCrmSyncEnabled(),
    candidatesEnabled: isCrmSyncCandidatesEnabled(),
    configured: crmSyncUrl() !== null && crmSyncSecret() !== null,
    counts,
    backlog: counts.pending + counts.failed,
    backlogThreshold: CRM_SYNC_BACKLOG_THRESHOLD,
    failures24h,
    sent24h,
    lastSentAt: lastSent?.sentAt ?? null,
    oldestPendingAt,
    oldestPendingMinutes: oldestPendingAt
      ? Math.round((Date.now() - oldestPendingAt.getTime()) / 60_000)
      : null,
    inbound: {
      total: inboundTotal,
      last24h: inbound24h,
      lastAt: lastInbound?.createdAt ?? null,
    },
    reconciliation: await collectReconciliation(),
    errors: errors.map((row) => ({
      ...row,
      status: row.status as CrmSyncStatusName,
    })),
  };
}
