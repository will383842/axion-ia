/**
 * Content Generator — Kill switch global.
 *
 * § 12 + § 24.7 master prompt : 1 clic pour stopper toutes les générations
 * en cours. Stocké en DB (`ContentGenConfig.key="kill_switch"`).
 *
 * ⚠️ AUDIT 2026-07-21 — cet en-tête annonçait un « fallback `CONTENT_GEN_KILL_SWITCH`
 * env var ». CE FALLBACK N'EXISTE PAS : la variable n'est lue nulle part
 * (`readContentGenConfig` interroge Prisma et rien d'autre). La poser dans Coolify
 * ne gèle RIEN tout en donnant l'impression du contraire — sur un dispositif
 * d'arrêt d'urgence, c'est le pire des comportements possibles. Mention retirée.
 * La ligne DB est la seule source de vérité ; elle est lue sans cache, donc
 * l'effet est immédiat au job suivant, sans redémarrage.
 *
 * Comportement worker (Sprint 1 livré) : avant chaque pick de job, lit la
 * valeur et si `true` → throw `KillSwitchActive`, le job est requeue plus
 * tard. Pas de re-pick avant désactivation explicite Will.
 */

"use server";

import * as Sentry from "@sentry/nextjs";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/server/content-gen/shared/activity-log";
import { requireAdmin } from "./_auth";
import { readContentGenConfig, writeContentGenConfig } from "./_settings";

const KEY = "kill_switch";

// Sprint Final P1-3 — Zod runtime validation des inputs Server Actions.
const ActivateReasonSchema = z.string().min(1).max(1000);

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
  try {
    // Sprint Final P1-3 — Zod runtime validation.
    ActivateReasonSchema.parse(reason);
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
    revalidatePath(
      `/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/settings/kill-switch`,
    );
    await logActivity({
      session,
      action: "content-gen.kill-switch.activate",
      targetType: "ContentGenConfig",
      targetId: KEY,
      changes: { reason: reason.slice(0, 280) },
    });
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "activateKillSwitch" } });
    throw e;
  }
}

export async function deactivateKillSwitch(): Promise<void> {
  const session = await requireAdmin();
  try {
    await writeContentGenConfig(
      KEY,
      { active: false },
      session.userId,
      "Kill switch désactivé manuellement",
    );
    revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen`);
    revalidatePath(
      `/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/settings/kill-switch`,
    );
    await logActivity({
      session,
      action: "content-gen.kill-switch.deactivate",
      targetType: "ContentGenConfig",
      targetId: KEY,
    });
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "deactivateKillSwitch" } });
    throw e;
  }
}
