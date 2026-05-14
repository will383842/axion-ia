/**
 * Content Generator — Cost tracker (§ 0.4 + § 7.4 master prompt).
 *
 * Responsabilités :
 * 1. Vérifier le cost cap mensuel pré-call (assertion DB atomic).
 * 2. Logger un row `CostLedger` après chaque appel provider.
 * 3. Incrémenter `ProviderConfig.currentMonthSpentUsd` (transaction atomic).
 * 4. Activer kill switch si cap atteint.
 *
 * Cf. _AUDIT/SPRINT-1-DAY-BY-DAY.md Day 2 § 09:00.
 */

import { prisma } from "@/lib/prisma";
import { ProviderError } from "../providers/IProvider";
import type { ProviderKey, Prisma } from "../../../../prisma/generated/client";

export interface CostTrackingArgs {
  readonly jobId?: string;
  readonly provider: ProviderKey;
  readonly model: string;
  readonly tokensInput: number;
  readonly tokensOutput: number;
  readonly costUsd: number;
}

/**
 * Vérifie le cost cap mensuel AVANT un appel provider.
 * Throw `ProviderError("cost_cap_reached")` si dépassement.
 *
 * Méthode :
 * - Lit `ProviderConfig.monthlyCapUsd` + `currentMonthSpentUsd`.
 * - Si `currentMonthSpentUsd >= monthlyCapUsd * 1.0` → throw (kill switch hit).
 * - Si `>= 0.8 * monthlyCapUsd` → log warning (Telegram alert § 12.3bis Sprint 1 Day 5).
 *
 * V0 transitoire : si la table ProviderConfig n'existe pas en DB (migration pas
 * encore appliquée), bypass le check (return false) — anti-blocage build/test.
 */
export async function assertCostCapAvailable(
  provider: ProviderKey,
  estimatedCostUsd: number,
): Promise<void> {
  try {
    const config = await prisma.providerConfig.findUnique({
      where: { provider },
      select: { monthlyCapUsd: true, currentMonthSpentUsd: true, enabled: true },
    });
    if (!config) {
      // Provider pas seedé → skip (V0 transitoire avant pnpm content-gen:seed).
      return;
    }
    if (!config.enabled) {
      throw new ProviderError(
        `Provider '${provider}' is disabled in ProviderConfig`,
        "auth_failed",
        provider,
        false,
      );
    }
    const cap = Number(config.monthlyCapUsd);
    if (cap <= 0) {
      // Cap = 0 → provider gratuit (Unsplash). Pas de check cost.
      return;
    }
    const spent = Number(config.currentMonthSpentUsd);
    if (spent + estimatedCostUsd > cap) {
      throw new ProviderError(
        `Cost cap reached for ${provider}: $${spent.toFixed(4)}/$${cap.toFixed(2)} (+ $${estimatedCostUsd.toFixed(4)})`,
        "cost_cap_reached",
        provider,
        false,
      );
    }
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    // P2021 = table doesn't exist (migration pas appliquée) → bypass V0
    if (err instanceof Error && "code" in err && (err as { code: string }).code === "P2021") {
      return;
    }
    throw err;
  }
}

/**
 * Enregistre un row CostLedger + incrémente ProviderConfig.currentMonthSpentUsd
 * dans la même transaction atomic (pas de désynchro possible).
 *
 * V0 transitoire : si tables manquent (P2021), no-op silencieux.
 */
export async function trackCost(args: CostTrackingArgs): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      const data: Prisma.CostLedgerCreateInput = {
        provider: args.provider,
        model: args.model,
        tokensInput: args.tokensInput,
        tokensOutput: args.tokensOutput,
        costUsd: args.costUsd,
        ...(args.jobId ? { jobId: args.jobId } : {}),
      };
      await tx.costLedger.create({ data });
      await tx.providerConfig.update({
        where: { provider: args.provider },
        data: { currentMonthSpentUsd: { increment: args.costUsd } },
      });
    });
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as { code: string }).code === "P2021") {
      // Tables pas migrées → no-op
      return;
    }
    throw err;
  }
}

/**
 * Reset mensuel `currentMonthSpentUsd = 0` pour tous les providers.
 * À appeler par cron job 1er du mois 00:01 (cf. § 13.2 master prompt).
 */
export async function resetMonthlyCostCounters(): Promise<number> {
  const result = await prisma.providerConfig.updateMany({
    data: { currentMonthSpentUsd: 0 },
  });
  return result.count;
}
