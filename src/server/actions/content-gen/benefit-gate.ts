/**
 * Content Generator — Config du benefit-gate (PH4, plan §4/§6).
 *
 * Pilote la config `ContentGenConfig.key="benefit_gate"` consommée par le worker
 * (content-gen-worker) : active/désactive le benefit-gate COMMERCIAL (PH2) et son
 * juge LLM cost-tracké (PH3), + seuil minimal. Lecture seule = read ; mutation =
 * requireAdmin + Zod + audit (mirror du pattern kill-switch).
 *
 * ⚠️ Le gate ne mord QUE si l'env `QUALITY_PROFILES_ENABLED=true` (Coolify) est
 * aussi posée — ces deux verrous restent indépendants (cf. plan §8).
 */

"use server";

import * as Sentry from "@sentry/nextjs";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/server/content-gen/shared/activity-log";
import { requireAdmin } from "./_auth";
import { readContentGenConfig, writeContentGenConfig } from "./_settings";

const KEY = "benefit_gate";

export interface BenefitGateConfig {
  readonly enabled: boolean;
  readonly llmJudge: boolean;
  readonly minScore: number;
}

const DEFAULTS: BenefitGateConfig = { enabled: false, llmJudge: false, minScore: 70 };

const UpdateSchema = z.object({
  enabled: z.boolean(),
  llmJudge: z.boolean(),
  minScore: z.number().int().min(0).max(100),
});

export async function getBenefitGateConfig(): Promise<BenefitGateConfig> {
  return readContentGenConfig<BenefitGateConfig>(KEY, DEFAULTS);
}

export async function updateBenefitGateConfig(input: {
  enabled: boolean;
  llmJudge: boolean;
  minScore: number;
}): Promise<void> {
  const session = await requireAdmin();
  try {
    const parsed = UpdateSchema.parse(input);
    await writeContentGenConfig(
      KEY,
      parsed,
      session.userId,
      "Benefit-gate config (PH2 regex + PH3 juge LLM) — pilote v2",
    );
    const prefix = process.env.ADMIN_URL_PREFIX ?? "admin";
    revalidatePath(`/fr/${prefix}/content-gen`);
    revalidatePath(`/fr/${prefix}/content-gen/settings/benefit-gate`);
    await logActivity({
      session,
      action: "content-gen.benefit-gate.update",
      targetType: "ContentGenConfig",
      targetId: KEY,
      changes: parsed,
    });
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "updateBenefitGateConfig" } });
    throw e;
  }
}
