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
import type { ProviderKey, ProviderRole } from "../../../../prisma/generated/client";
import { requireAdmin } from "./_auth";

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

export async function updateProvider(input: UpdateProviderInput): Promise<void> {
  await requireAdmin();
  if (input.monthlyCapUsd < 0 || input.monthlyCapUsd > 100_000) {
    throw new Error("monthly_cap_out_of_range");
  }
  if (input.model.trim().length < 2) throw new Error("model_required");
  await prisma.providerConfig.update({
    where: { id: input.id },
    data: {
      enabled: input.enabled,
      model: input.model.trim(),
      monthlyCapUsd: input.monthlyCapUsd,
      rateLimitRpm: input.rateLimitRpm ?? null,
    },
  });
  revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/settings/providers`);
}

export async function resetProviderSpend(id: string): Promise<void> {
  await requireAdmin();
  await prisma.providerConfig.update({
    where: { id },
    data: { currentMonthSpentUsd: 0 },
  });
  revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/settings/providers`);
}
