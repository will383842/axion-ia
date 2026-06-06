/**
 * Qualiopi — RBAC guards + audit trail pour les Server Actions.
 *
 * Réutilise les guards RBAC de la Knowledge Base (NextAuth 5, rôles
 * super_admin/admin/editor/reader) — AUCUN nouveau rôle NextAuth. Les rôles
 * métier (formateur interne/externe, auditeur) sont modélisés par-dessus via
 * des tables applicatives + token auditeur (livrés en T11/T12), pas ici.
 *
 * `logQualiopiActivity()` = miroir du pattern `logActivity()` content-gen
 * (best-effort, fail-silent) → trace toute mutation Qualiopi dans `ActivityLog`
 * (RGPD art. 30 + preuve d'audit Qualiopi). targetType préfixé `qualiopi.`.
 */

"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  requireAdminRead,
  requireAdminWrite,
  requireAdminPublish,
  requireAdminDelete,
  type AdminSession,
} from "@/server/actions/knowledge/_guards";

export { requireAdminRead, requireAdminWrite, requireAdminPublish, requireAdminDelete };
export type { AdminSession };

export interface QualiopiActivityInput {
  /** Action canonique ex. "qualiopi.config.set", "qualiopi.formation.publish". */
  readonly action: string;
  /** Type de cible ex. "SiteSetting", "Formation", "TrainingSession". */
  readonly targetType?: string;
  /** ID de la cible. */
  readonly targetId?: string | null;
  /** Diff/payload sérialisable (anonymisé si PII). */
  readonly changes?: unknown;
  /** Session admin (via requireAdmin*). */
  readonly session: AdminSession;
}

/**
 * Persiste une entrée ActivityLog pour une action Qualiopi. Best-effort :
 * un log raté n'invalide jamais l'action métier.
 */
export async function logQualiopiActivity(input: QualiopiActivityInput): Promise<void> {
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
        targetType: (input.targetType ?? "qualiopi").slice(0, 80),
        targetId: input.targetId ?? null,
        changes: (input.changes ?? null) as never,
        ipAddress: ipAddress?.slice(0, 64) ?? null,
        userAgent: userAgent?.slice(0, 2000) ?? null,
      },
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[qualiopi-activity-log] persist failed (best-effort):",
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}
