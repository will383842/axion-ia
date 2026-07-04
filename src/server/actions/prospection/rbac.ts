/**
 * Prospection — RBAC PUR (T6/T8, sans dépendance NextAuth → testable).
 *
 * Rôles métier `viewer|operator|dpo|admin` (04-SPEC §6) mappés sur les rôles user
 * réels (`super_admin|admin|editor`) — décision D-T0-2. Export/bulk/opt-out
 * réservés `dpo|admin` (= super_admin/admin) ; consultation/opération = tout admin.
 */

export type ProspectionCapability = "view" | "operate" | "export" | "config";

const ROLE_CAPS: Record<string, ReadonlySet<ProspectionCapability>> = {
  super_admin: new Set(["view", "operate", "export", "config"]),
  admin: new Set(["view", "operate", "export", "config"]),
  editor: new Set(["view", "operate"]), // operator : consulte + opère, PAS d'export/opt-out
};

/** Vrai si le rôle a la capacité (pur). */
export function canProspection(role: string, cap: ProspectionCapability): boolean {
  return ROLE_CAPS[role]?.has(cap) ?? false;
}
