"use server";

// Observatoire IA 2026 — Server Actions ADMIN (requireAdmin + Sentry).
// Lecture des stats + recalcul du snapshot. (La génération d'articles
// `barometer_insight` est ajoutée avec le générateur — cf. tranche 8.)

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/actions/content-gen/_auth";
import { enqueueDirectGen } from "@/server/actions/content-gen/enqueue";
import {
  recomputeAndPersistSnapshot,
  readLatestSnapshot,
  countRealResponses,
  type BarometerSnapshotPayload,
} from "@/server/observatoire/snapshot";
import { SNAPSHOT_KEY_LATEST } from "@/content/observatoire/study";

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
      prisma.barometerSnapshot.findUnique({ where: { key: SNAPSHOT_KEY_LATEST } }),
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

const INSIGHT_ANGLE: Record<string, string> = {
  competitors_use_ai: "concurrence et adoption de l'IA dans les entreprises françaises",
  no_formal_strategy: "stratégie IA des entreprises françaises en 2026",
  rgpd_concern: "souveraineté des données et IA en France",
  investment_intent: "intentions d'investissement IA des entreprises françaises",
};

export type GenerateArticleState = { ok: true; jobId: string } | { ok: false; error: string };

/**
 * Crée un job de génération d'article `barometer_insight` (review-queue).
 * INTÉGRITÉ : refuse si aucun échantillon réel — jamais d'article sans chiffres.
 */
export async function generateBarometerArticle(insightKey?: string): Promise<GenerateArticleState> {
  await requireAdmin();
  try {
    // Garde d'intégrité : on s'appuie sur le compte RÉEL (hors seed), pas sur
    // `snap.totalResponses` qui inclut la fixture dev — sinon le seed pourrait
    // être publié comme une vraie étude (risque L121-2).
    const [snap, realResponses] = await Promise.all([readLatestSnapshot(), countRealResponses()]);
    if (!snap || realResponses === 0) {
      return {
        ok: false,
        error: "Aucune réponse réelle — impossible de générer un article sans chiffres vérifiés.",
      };
    }
    const primaryKeyword =
      (insightKey && INSIGHT_ANGLE[insightKey]) ||
      "état de l'adoption de l'IA dans les entreprises françaises 2026";
    const res = await enqueueDirectGen({
      contentType: "barometer_insight",
      targetSearchIntent: "ai_overview",
      primaryKeyword,
    });
    return { ok: true, jobId: res.jobId };
  } catch (e) {
    Sentry.captureException(e, {
      tags: { area: "observatoire", action: "generateBarometerArticle" },
    });
    return { ok: false, error: "La génération a échoué." };
  }
}

/** Wrapper compatible `<form action>` — lit l'angle optionnel `insightKey`. */
export async function generateBarometerArticleForm(formData: FormData): Promise<void> {
  const k = formData.get("insightKey");
  await generateBarometerArticle(typeof k === "string" && k.length > 0 ? k : undefined);
}
