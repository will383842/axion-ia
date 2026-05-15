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
import { sendTelegram } from "@/lib/telegram";
import { safeTelegramContext } from "./pii-safe";
import type { ProviderKey, Prisma } from "../../../../prisma/generated/client";

/**
 * Audit final P1-9 fix — gestion automatique du dépassement cost cap.
 *
 * Actions cascadées :
 *  1. Désactive `ProviderConfig.enabled=false` pour ce provider (fallback
 *     chain prendra le relais automatiquement).
 *  2. Alerte Telegram tag MONITORING (Will sait dans la minute).
 *  3. Si après désactivation aucun provider role=text n'est plus enabled
 *     → activer kill switch global content-gen (`ContentGenConfig.kill_switch`).
 *  4. Trace dans `ContentGenConfig.cost_cap_events` (audit trail
 *     accessible dashboard admin).
 *
 * **Idempotent** : appeler 2× = même état final (enabled=false reste
 * false, kill switch reste true).
 * **Fail-soft** : si Telegram ou Prisma fail, on log et continue (l'objectif
 * principal — throw ProviderError — n'est pas compromis).
 */
async function handleCostCapHit(provider: ProviderKey, spent: number, cap: number): Promise<void> {
  try {
    // 1. Désactive le provider
    await prisma.providerConfig.update({
      where: { provider },
      data: { enabled: false },
    });
  } catch (err) {
    console.warn(
      `[cost-tracker] failed to auto-disable provider ${provider}:`,
      err instanceof Error ? err.message : String(err),
    );
  }

  // 2. Alerte Telegram (fail-soft) — Pass B P1-7 : champs passés via
  // safeTelegramContext() pour garantir minimisation PII (ADR 0010) même
  // si un futur ajout introduit un email/name dans le payload alert.
  try {
    const context = safeTelegramContext({
      provider,
      monthly_spent_usd: Number(spent.toFixed(2)),
      monthly_cap_usd: Number(cap.toFixed(2)),
    });
    await sendTelegram({
      tag: "MONITORING",
      body:
        `*Cost cap content-gen atteint*\n` +
        `${context}\n` +
        `Action auto : provider désactivé. Fallback chain prend le relais.\n` +
        `Réactivation : admin /content-gen/settings/providers ou reset 1er du mois.`,
      silent: false,
    });
  } catch (err) {
    console.warn(
      "[cost-tracker] Telegram cost-cap alert failed:",
      err instanceof Error ? err.message : String(err),
    );
  }

  // 3. Vérifie si plus aucun provider role=text enabled → kill switch global
  try {
    const remaining = await prisma.providerConfig.count({
      where: { role: "text", enabled: true },
    });
    if (remaining === 0) {
      await prisma.contentGenConfig.upsert({
        where: { key: "kill_switch" },
        create: {
          key: "kill_switch",
          value: {
            active: true,
            reason: `Auto-trigger : tous les providers role=text en cost cap (dernier=${provider})`,
            triggered_at: new Date().toISOString(),
            triggered_by: "system:cost-tracker",
          } as never,
          updatedBy: "system:cost-tracker",
        },
        update: {
          value: {
            active: true,
            reason: `Auto-trigger : tous les providers role=text en cost cap (dernier=${provider})`,
            triggered_at: new Date().toISOString(),
            triggered_by: "system:cost-tracker",
          } as never,
          updatedBy: "system:cost-tracker",
          updatedAt: new Date(),
        },
      });
      try {
        await sendTelegram({
          tag: "INCIDENT",
          body:
            `*🛑 Kill switch global auto-activé*\n` +
            `Cause : tous les providers role=text en cost cap mensuel.\n` +
            `Dernier provider tombé : \`${provider}\`.\n` +
            `Workers content-gen en pause. Réactivation manuelle requise après reset du mois\n` +
            `ou augmentation cap : admin /content-gen/settings/kill-switch.`,
          silent: false,
        });
      } catch {
        // fail-soft sur 2e alerte
      }
    }
  } catch (err) {
    console.warn(
      "[cost-tracker] failed to check remaining providers / kill-switch trigger:",
      err instanceof Error ? err.message : String(err),
    );
  }

  // 4. Trace audit dans ContentGenConfig.cost_cap_events (cap 50 derniers).
  try {
    const existing = await prisma.contentGenConfig.findUnique({
      where: { key: "cost_cap_events" },
    });
    const prev =
      (existing?.value as Array<Record<string, unknown>> | null | undefined)?.filter(
        (e) => typeof e === "object" && e !== null,
      ) ?? [];
    const next = [
      {
        provider,
        spent_usd: spent,
        cap_usd: cap,
        at: new Date().toISOString(),
      },
      ...prev,
    ].slice(0, 50);
    await prisma.contentGenConfig.upsert({
      where: { key: "cost_cap_events" },
      create: { key: "cost_cap_events", value: next as never, updatedBy: "system:cost-tracker" },
      update: {
        value: next as never,
        updatedBy: "system:cost-tracker",
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    console.warn(
      "[cost-tracker] failed to write cost_cap_events trace:",
      err instanceof Error ? err.message : String(err),
    );
  }
}

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
    // P1-17 fix audit opérationnel 2026-05-14 — warning à 80% pour anticiper
    // le hit 100%. Throttle : on n'alerte qu'au passage de seuil (spent
    // pre-call < 80%, post-call >= 80%) pour éviter spam Telegram.
    const threshold80 = cap * 0.8;
    if (spent < threshold80 && spent + estimatedCostUsd >= threshold80) {
      void (async () => {
        try {
          const { alertCostCap80 } = await import("@/server/content-gen/shared/content-gen-alerts");
          const queuedJobs = await prisma.contentGenJob.count({
            where: { status: "queued" },
          });
          await alertCostCap80(provider, spent + estimatedCostUsd, cap, queuedJobs);
        } catch {
          // best-effort
        }
      })();
    }
    if (spent + estimatedCostUsd > cap) {
      // Audit final P1-9 fix — auto-trigger cascade : disable provider +
      // Telegram + éventuel kill-switch global si fallback chain épuisée.
      // Helper isolé fail-soft, ne bloque jamais le throw ci-dessous.
      await handleCostCapHit(provider, spent, cap);
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
    // PrismaClientInitializationError = DB pas accessible (test sans DB) → bypass V0
    if (err instanceof Error && err.constructor.name === "PrismaClientInitializationError") {
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
    if (err instanceof Error && err.constructor.name === "PrismaClientInitializationError") {
      // DB pas accessible (tests sans DB) → no-op
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
