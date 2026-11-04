import type { BaseAudit } from "../base-audit-schema";

/** JSON indenté de la base, tel quel (document INTERNE, pour les machines). */
export function baseEnJson(base: BaseAudit): string {
  return JSON.stringify(base, null, 2);
}
