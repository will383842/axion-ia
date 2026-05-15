/**
 * Content Generator — Kill switch global.
 *
 * § 12 + § 24.7 master prompt : 1 clic pour stopper toutes les générations
 * en cours. Stocké en DB (`ContentGenConfig.key="kill_switch"`) ET fallback
 * `CONTENT_GEN_KILL_SWITCH` env var.
 *
 * Comportement worker (Sprint 1 livré) : avant chaque pick de job, lit la
 * valeur et si `true` → throw `KillSwitchActive`, le job est requeue plus
 * tard. Pas de re-pick avant désactivation explicite Will.
 */

"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/server/content-gen/shared/activity-log";
import { requireAdmin } from "./_auth";
import { readContentGenConfig, writeContentGenConfig } from "./_settings";

const KEY = "kill_switch";

export interface KillSwitchState {
  readonly active: boolean;
  readonly activatedAt?: string;
  readonly reason?: string;
}

export async function getKillSwitch(): Promise<KillSwitchState> {
  return readContentGenConfig<KillSwitchState>(KEY, { active: false });
}

export async function activateKillSwitch(reason: string): Promise<void> {
  const session = await requireAdmin();
  await writeContentGenConfig(
    KEY,
    {
      active: true,
      activatedAt: new Date().toISOString(),
      reason: reason.slice(0, 280),
    },
    session.userId,
    "Kill switch global content-gen — stop all generations",
  );
  revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen`);
  revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/settings/kill-switch`);
  await logActivity({
    session,
    action: "content-gen.kill-switch.activate",
    targetType: "ContentGenConfig",
    targetId: KEY,
    changes: { reason: reason.slice(0, 280) },
  });
}

export async function deactivateKillSwitch(): Promise<void> {
  const session = await requireAdmin();
  await writeContentGenConfig(
    KEY,
    { active: false },
    session.userId,
    "Kill switch désactivé manuellement",
  );
  revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen`);
  revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/settings/kill-switch`);
  await logActivity({
    session,
    action: "content-gen.kill-switch.deactivate",
    targetType: "ContentGenConfig",
    targetId: KEY,
  });
}
