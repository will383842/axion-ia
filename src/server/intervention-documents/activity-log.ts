// Helper ActivityLog local au module « documents interventions ».
// Écrit directement dans la table générique ActivityLog (audit RGPD art.30).
// Volontairement AUTONOME (pas d'import cross-module) pour respecter le
// cloisonnement : chaque module a son propre point d'écriture d'audit.
// Best-effort, fail-silent (un log raté n'invalide jamais l'action).

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export interface ActivityLogInput {
  readonly action: string;
  readonly targetType?: string;
  readonly targetId?: string | null;
  readonly changes?: unknown;
  readonly session: { readonly userId: string };
}

export async function logActivity(input: ActivityLogInput): Promise<void> {
  try {
    const h = await headers();
    const ipAddress =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      h.get("cf-connecting-ip") ||
      null;
    const userAgent = h.get("user-agent") || null;
    await prisma.activityLog.create({
      data: {
        adminUserId: input.session.userId,
        action: input.action.slice(0, 120),
        targetType: input.targetType?.slice(0, 80) ?? null,
        targetId: input.targetId ?? null,
        changes: (input.changes ?? null) as never,
        ipAddress: ipAddress?.slice(0, 64) ?? null,
        userAgent: userAgent?.slice(0, 2000) ?? null,
      },
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[intervention-documents/activity-log] persist failed (best-effort):",
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}
