/**
 * Content Generator — CRUD ProviderConfig (admin /settings/providers).
 *
 * § 12.5 + § 7.2 master prompt : toggles ON/OFF, cost caps, modèle par défaut,
 * rate-limits, fallback chain. Cost-cap reset mensuel via cron (Sprint 5).
 *
 * Lecture pure. Mutations strictement par Server Action.
 */

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/server/content-gen/audit-log";
import type { ProviderKey, ProviderRole } from "../../../../prisma/generated/client";
import { requireAdminWriteRateLimited } from "./_auth";

export interface ProviderRow {
  readonly id: string;
  readonly provider: ProviderKey;
  readonly role: ProviderRole;
  readonly enabled: boolean;
  readonly primary: boolean;
  readonly model: string;
  readonly fallbackProviderId: string | null;
  readonly monthlyCapUsd: string;
  readonly currentMonthSpentUsd: string;
  readonly rateLimitRpm: number | null;
  readonly rateLimitTpm: number | null;
  readonly apiKeyEnvVar: string;
  readonly updatedAt: Date;
}

export async function listProviders(): Promise<ReadonlyArray<ProviderRow>> {
  const rows = await prisma.providerConfig.findMany({
    orderBy: [{ role: "asc" }, { provider: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    role: r.role,
    enabled: r.enabled,
    primary: r.primary,
    model: r.model,
    fallbackProviderId: r.fallbackProviderId,
    monthlyCapUsd: r.monthlyCapUsd.toString(),
    currentMonthSpentUsd: r.currentMonthSpentUsd.toString(),
    rateLimitRpm: r.rateLimitRpm,
    rateLimitTpm: r.rateLimitTpm,
    apiKeyEnvVar: r.apiKeyEnvVar,
    updatedAt: r.updatedAt,
  }));
}

export interface UpdateProviderInput {
  readonly id: string;
  readonly enabled: boolean;
  readonly model: string;
  readonly monthlyCapUsd: number;
  readonly rateLimitRpm?: number;
}

/**
 * Mutate ProviderConfig (toggle, model, cap, rate-limit).
 *
 * Sprint S+3 P0-1 (audit 2026-05-18 09-ADMIN-UI §2.7) — chokepoint financier
 * (caps mensuels USD, clés API env, fallback chain) durci par :
 *   1. `requireAdminWriteRateLimited` (60/min/admin/providerId, isolation cf.
 *      _auth.ts P1-30) — bloque les abus loop-script.
 *   2. `writeAuditLog` SOC2 (cf. content-gen/audit-log.ts P1-9) — diff
 *      oldValue → newValue tracé, best-effort fail-soft.
 */
export async function updateProvider(input: UpdateProviderInput): Promise<void> {
  // Rate-limit + auth admin (60 writes/min/admin/providerId — isolation par
  // provider pour permettre toggles parallèles sans bloquer l'admin).
  const session = await requireAdminWriteRateLimited(`updateProvider:${input.id}`);

  if (input.monthlyCapUsd < 0 || input.monthlyCapUsd > 100_000) {
    throw new Error("monthly_cap_out_of_range");
  }
  if (input.model.trim().length < 2) throw new Error("model_required");

  // SOC2 audit trail — lecture AVANT update pour capturer le delta.
  // Read-then-update n'est pas atomique vs lecture concurrente ; tolérable
  // car les écritures sont human-paced côté admin UI.
  const existing = await prisma.providerConfig.findUnique({
    where: { id: input.id },
    select: {
      enabled: true,
      model: true,
      monthlyCapUsd: true,
      rateLimitRpm: true,
    },
  });
  const oldValue = existing
    ? {
        enabled: existing.enabled,
        model: existing.model,
        monthlyCapUsd: existing.monthlyCapUsd.toString(),
        rateLimitRpm: existing.rateLimitRpm,
      }
    : null;

  const newValue = {
    enabled: input.enabled,
    model: input.model.trim(),
    monthlyCapUsd: input.monthlyCapUsd,
    rateLimitRpm: input.rateLimitRpm ?? null,
  };

  await prisma.providerConfig.update({
    where: { id: input.id },
    data: newValue,
  });

  // Audit log best-effort (helper writeAuditLog swallow déjà côté impl, mais
  // try/catch de défense en profondeur pour garantir que update n'échoue pas
  // si la table audit log devient indisponible).
  try {
    await writeAuditLog({
      action: "updateProvider",
      settingKey: `provider:${input.id}`,
      oldValue,
      newValue,
      actorUserId: session.userId,
      actorEmail: session.email,
    });
  } catch {
    // SOC2 tolère perte partielle si tracée. Best-effort — ne pas casser
    // l'update admin pour un problème observability.
  }

  revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/settings/providers`);
}

/**
 * Reset le compteur `currentMonthSpentUsd` d'un provider (manuel admin).
 *
 * Sprint S+3 P0-1 — opération SOC2-sensible (touche directement la métrique
 * cost-cap qui gouverne les budgets LLM mensuels). Cap stricte 10/heure/admin
 * pour bloquer un reset accidentel ou abusif en boucle.
 */
export async function resetProviderSpend(id: string): Promise<void> {
  // Rate-limit serré : 10/heure (window 3600s). Un reset doit rester une
  // action exceptionnelle (typiquement après bascule de billing cycle).
  const session = await requireAdminWriteRateLimited(`resetProviderSpend:${id}`, {
    limit: 10,
    windowSec: 3600,
  });

  // Capture l'ancien spend pour audit log (montre combien a été "remis à
  // zéro" — important pour reconstituer les caps mensuels en cas d'enquête).
  const existing = await prisma.providerConfig.findUnique({
    where: { id },
    select: { currentMonthSpentUsd: true },
  });
  const oldSpend = existing ? existing.currentMonthSpentUsd.toString() : null;

  await prisma.providerConfig.update({
    where: { id },
    data: { currentMonthSpentUsd: 0 },
  });

  try {
    await writeAuditLog({
      action: "resetProviderSpend",
      settingKey: `provider:${id}`,
      oldValue: { currentMonthSpentUsd: oldSpend },
      newValue: { currentMonthSpentUsd: "0" },
      actorUserId: session.userId,
      actorEmail: session.email,
    });
  } catch {
    // Best-effort (cf. updateProvider).
  }

  revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/settings/providers`);
}
