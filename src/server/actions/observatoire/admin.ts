"use server";

// Observatoire IA 2026 — Server Actions ADMIN (requireAdmin + Sentry).
// Lecture des stats + recalcul du snapshot. (La génération d'articles
// `barometer_insight` est ajoutée avec le générateur — cf. tranche 8.)

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/actions/content-gen/_auth";
import {
  recomputeAndPersistSnapshot,
  readLatestSnapshot,
  type BarometerSnapshotPayload,
} from "@/server/observatoire/snapshot";

export interface BarometerAdminStats {
  readonly totalResponses: number;
  readonly seededResponses: number;
  readonly realResponses: number;
  readonly lastComputedAt: string | null;
  readonly snapshot: BarometerSnapshotPayload | null;
}

/** Stats admin : effectifs réels vs seedés + snapshot courant. */
export async function getBarometerStats(): Promise<BarometerAdminStats> {
  await requireAdmin();
  try {
    const [total, seeded, snapshotRow] = await Promise.all([
      prisma.barometerResponse.count(),
      prisma.barometerResponse.count({ where: { visitorId: { startsWith: "seed:" } } }),
      prisma.barometerSnapshot.findUnique({ where: { key: "latest" } }),
    ]);
    return {
      totalResponses: total,
      seededResponses: seeded,
      realResponses: total - seeded,
      lastComputedAt: snapshotRow?.computedAt.toISOString() ?? null,
      snapshot: (snapshotRow?.payload as unknown as BarometerSnapshotPayload) ?? null,
    };
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "observatoire", action: "getBarometerStats" } });
    return {
      totalResponses: 0,
      seededResponses: 0,
      realResponses: 0,
      lastComputedAt: null,
      snapshot: null,
    };
  }
}

export type RecomputeState = { ok: true; total: number } | { ok: false; error: string };

/** Recalcule et persiste `BarometerSnapshot("latest")`, puis revalide les pages. */
export async function recomputeBarometerSnapshot(): Promise<RecomputeState> {
  await requireAdmin();
  try {
    const payload = await recomputeAndPersistSnapshot();
    // Revalide la page publique (FR + EN pré-rendues) et la presse.
    revalidatePath("/fr/observatoire-ia");
    revalidatePath("/en/observatoire-ia");
    revalidatePath("/fr/presse");
    revalidatePath("/en/presse");
    return { ok: true, total: payload.totalResponses };
  } catch (e) {
    Sentry.captureException(e, {
      tags: { area: "observatoire", action: "recomputeBarometerSnapshot" },
    });
    return { ok: false, error: "Le recalcul a échoué." };
  }
}

/** Wrapper compatible `<form action>` (ignore le FormData). */
export async function recomputeBarometerSnapshotForm(_formData: FormData): Promise<void> {
  await recomputeBarometerSnapshot();
}

// Lecture directe du snapshot (utilitaire admin).
export async function getLatestSnapshot(): Promise<BarometerSnapshotPayload | null> {
  await requireAdmin();
  return readLatestSnapshot();
}
