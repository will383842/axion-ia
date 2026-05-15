/**
 * Content Generator — ActivityLog audit trail helper (P1-F fix audit
 * opérationnel 2026-05-15).
 *
 * Master prompt § 12.3bis + § 0.5 RGPD Article 30 — chaque action admin
 * sensible doit laisser une trace audit (qui, quand, sur quoi, quel diff).
 * GenerationLog couvre uniquement les étapes worker BG ; ActivityLog couvre
 * les actions humaines admin.
 *
 * Pattern : appeler `logActivity({...})` après chaque Server Action mutante
 * réussie. Best-effort fail-silent (un log raté n'invalide jamais l'action).
 *
 * Page admin de consultation : `/[adminPrefix]/activity-logs` (filtrable par
 * `target_type=content-gen`).
 */

"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { AdminSession } from "@/server/actions/content-gen/_auth";

export interface ActivityLogInput {
  /** Identifiant canonique de l'action ex. "content-gen.review.approve". */
  readonly action: string;
  /** Type de cible ex. "ReviewQueue", "Article", "CoverageCampaign". */
  readonly targetType?: string;
  /** ID de la cible (uuid). */
  readonly targetId?: string | null;
  /** Diff/payload sérialisable (anonymisé si PII). */
  readonly changes?: unknown;
  /** Session admin obtenue via `requireAdmin()`. */
  readonly session: AdminSession;
}

/**
 * Persiste une entrée ActivityLog. Best-effort : toute erreur Prisma (table
 * absente migration non appliquée, contention) est swallow + warn dev only.
 *
 * Récupère IP + User-Agent depuis `headers()` Next 16 — robuste aux requêtes
 * sans header (CLI, tests, worker reentry).
 */
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
        "[activity-log] persist failed (best-effort):",
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}
