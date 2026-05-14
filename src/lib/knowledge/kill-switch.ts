/**
 * KB V4 (Sprint KB-17) — Kill switch global pour ingest factory.
 *
 * 2 niveaux :
 *  - Env var `KB_INGEST_KILL_SWITCH=true` : kill switch hard (déploiement-level)
 *  - Future Redis flag (V2) : kill switch dynamique sans redeploy
 *
 * Si activé : POST /api/internal/kb/ingest → 503 Service Unavailable.
 * Logué dans KnowledgeAuditLog avec eventKind=kill_switch_engaged si tentative pendant kill.
 */

export interface KillSwitchStatus {
  readonly engaged: boolean;
  readonly source: "env" | "redis" | null;
  readonly reason?: string;
}

/**
 * Retourne le statut du kill switch.
 * V1 : check env var uniquement. V2 : check Redis également.
 */
export function getKillSwitchStatus(): KillSwitchStatus {
  if (process.env.KB_INGEST_KILL_SWITCH === "true") {
    return {
      engaged: true,
      source: "env",
      reason: process.env.KB_INGEST_KILL_SWITCH_REASON ?? "Manual env kill switch",
    };
  }
  return { engaged: false, source: null };
}

/**
 * Helper pour middleware API : throw si engaged.
 */
export class KillSwitchEngagedError extends Error {
  public readonly status: number = 503;
  public readonly source: "env" | "redis";
  constructor(source: "env" | "redis", reason: string) {
    super(`KB ingest kill switch engaged (source=${source}): ${reason}`);
    this.name = "KillSwitchEngagedError";
    this.source = source;
  }
}

export function assertKillSwitchInactive(): void {
  const status = getKillSwitchStatus();
  if (status.engaged) {
    throw new KillSwitchEngagedError(status.source ?? "env", status.reason ?? "engaged");
  }
}
