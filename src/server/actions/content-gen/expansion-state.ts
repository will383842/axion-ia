/**
 * Content Generator — Démarrage progressif 4 phases A→D (Sprint v7 Phase 9).
 *
 * Pattern : feature flag global stocké dans ContentGenConfig key="expansion_state".
 * Le worker orchestrator + admin UI lisent cette config pour filtrer les villes
 * × verticales × types autorisés à chaque tick.
 *
 * Transition phases :
 *   - phase_a : 1 verticale × 5 villes pilotes (mois 0-3, validation MVP)
 *   - phase_b : 3 verticales × 50 villes (mois 4-6, scale prudent)
 *   - phase_c : 5 verticales × 500 villes (mois 7-12, montée vitesse)
 *   - phase_d : 5 verticales × 2150 villes (mois 13-24, nationale full)
 *
 * Transitions semi-auto via `phase-transition-monitor.ts` worker (Sessions +).
 * Pour cette V1 : transition manuelle admin via setCurrentExpansionPhase().
 */

"use server";

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requireAdmin, requireAdminWriteRateLimited } from "./_auth";
import { readContentGenConfig, writeContentGenConfig } from "./_settings";

const EXPANSION_PHASES = ["phase_a", "phase_b", "phase_c", "phase_d"] as const;
export type ExpansionPhaseSlug = (typeof EXPANSION_PHASES)[number];

const ExpansionStateSchema = z
  .object({
    currentPhase: z.enum(EXPANSION_PHASES),
    activatedAt: z.string().datetime().nullable().optional(),
    previousPhase: z.enum(EXPANSION_PHASES).nullable().optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict();

export interface ExpansionState {
  readonly currentPhase: ExpansionPhaseSlug;
  readonly activatedAt: string | null;
  readonly previousPhase: ExpansionPhaseSlug | null;
  readonly notes: string;
}

const DEFAULT_STATE: ExpansionState = {
  currentPhase: "phase_a",
  activatedAt: null,
  previousPhase: null,
  notes: "",
};

/**
 * Quotas indicatifs par phase (villes × verticales × dailyArticles plafonné).
 * Consommés par admin UI + worker orchestrator (filtre safety net).
 */
export const PHASE_QUOTAS: Record<
  ExpansionPhaseSlug,
  {
    readonly verticalesCount: number;
    readonly villesCount: number;
    readonly maxDailyArticles: number;
    readonly humanLabel: string;
  }
> = {
  phase_a: {
    verticalesCount: 1,
    villesCount: 5,
    maxDailyArticles: 10,
    humanLabel: "MVP pilote (mois 0-3)",
  },
  phase_b: {
    verticalesCount: 3,
    villesCount: 50,
    maxDailyArticles: 30,
    humanLabel: "Scale prudent (mois 4-6)",
  },
  phase_c: {
    verticalesCount: 5,
    villesCount: 500,
    maxDailyArticles: 100,
    humanLabel: "Montée vitesse (mois 7-12)",
  },
  phase_d: {
    verticalesCount: 5,
    villesCount: 2150,
    maxDailyArticles: 300,
    humanLabel: "Nationale full (mois 13-24)",
  },
};

export async function getCurrentExpansionPhase(): Promise<ExpansionState> {
  return readContentGenConfig<ExpansionState>("expansion_state", DEFAULT_STATE);
}

export async function setCurrentExpansionPhase(
  nextPhase: ExpansionPhaseSlug,
  notes?: string,
): Promise<ExpansionState> {
  const session = await requireAdminWriteRateLimited("setCurrentExpansionPhase", { limit: 5 });
  const current = await getCurrentExpansionPhase();

  try {
    if (current.currentPhase === nextPhase) {
      return current; // idempotent — no-op si déjà sur la même phase
    }
    const newState: ExpansionState = {
      currentPhase: nextPhase,
      activatedAt: new Date().toISOString(),
      previousPhase: current.currentPhase,
      notes: notes ?? `Transition ${current.currentPhase} → ${nextPhase} par ${session.email}`,
    };
    // Re-parse pour s'assurer du contrat Zod avant write.
    const parsed = ExpansionStateSchema.parse(newState);
    await writeContentGenConfig(
      "expansion_state",
      parsed,
      session.userId,
      `Expansion phase ${current.currentPhase} → ${nextPhase}`,
    );
    return newState;
  } catch (e) {
    Sentry.captureException(e, {
      tags: { area: "content-gen", action: "setCurrentExpansionPhase" },
      extra: { adminUserId: session.userId, from: current.currentPhase, to: nextPhase },
    });
    throw e;
  }
}

/**
 * Verifie qu'une campagne (count villes + count verticales + dailyArticles)
 * respecte les quotas de la phase courante. Throw 'phase_quota_exceeded' sinon.
 *
 * Appelé par campaign-wizard.createCampaignFromWizard avant insert DB.
 */
export async function assertWithinPhaseQuotas(input: {
  villesCount: number;
  verticalesCount: number;
  dailyArticles: number;
}): Promise<void> {
  await requireAdmin();
  const state = await getCurrentExpansionPhase();
  const quotas = PHASE_QUOTAS[state.currentPhase];
  if (input.villesCount > quotas.villesCount) {
    throw new Error(
      `phase_quota_exceeded:villes:${input.villesCount}>${quotas.villesCount} (phase ${state.currentPhase})`,
    );
  }
  if (input.verticalesCount > quotas.verticalesCount) {
    throw new Error(
      `phase_quota_exceeded:verticales:${input.verticalesCount}>${quotas.verticalesCount} (phase ${state.currentPhase})`,
    );
  }
  if (input.dailyArticles > quotas.maxDailyArticles) {
    throw new Error(
      `phase_quota_exceeded:dailyArticles:${input.dailyArticles}>${quotas.maxDailyArticles} (phase ${state.currentPhase})`,
    );
  }
}
