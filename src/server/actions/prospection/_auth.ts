/**
 * Prospection — Garde RBAC des Server Actions (T6/T8).
 *
 * La logique de capacité PURE vit dans `rbac.ts` (testable, sans NextAuth). Ici :
 * le wrapper qui exige une capacité en s'appuyant sur `requireAdmin` (NextAuth).
 */

import { requireAdmin, type AdminSession } from "@/server/actions/content-gen/_auth";
import { canProspection, type ProspectionCapability } from "./rbac";

export { canProspection };
export type { ProspectionCapability, AdminSession };

/** Exige une capacité prospection. Throw `forbidden` sinon. */
export async function requireProspectionAccess(cap: ProspectionCapability): Promise<AdminSession> {
  const session = await requireAdmin();
  if (!canProspection(session.role, cap)) throw new Error("forbidden");
  return session;
}
