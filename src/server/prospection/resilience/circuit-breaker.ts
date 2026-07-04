/**
 * Prospection — Circuit breaker par source (T3).
 *
 * Ouvre après K échecs consécutifs → refuse les appels (la file doit se mettre
 * en pause + alerter), puis passe half-open après un cooldown (laisse passer une
 * sonde ; succès → referme, échec → ré-ouvre). Machine à états PURE (testable
 * sans Redis) + persistance Redis fail-open.
 */

export type BreakerState = "closed" | "open" | "half_open";

export interface BreakerData {
  state: BreakerState;
  failures: number;
  openUntilMs: number;
  /** Sonde half-open en vol jusqu'à ce timestamp (single-probe best-effort). */
  probeUntilMs: number;
}

export interface BreakerOptions {
  failuresToOpen: number;
  cooldownMs: number;
  /** Fenêtre pendant laquelle une sonde half-open est considérée « en vol » (une seule à la fois). */
  probeTimeoutMs: number;
}

export const INITIAL_BREAKER: BreakerData = {
  state: "closed",
  failures: 0,
  openUntilMs: 0,
  probeUntilMs: 0,
};

/**
 * Décide si un appel est autorisé (pur). Peut faire transiter open → half_open.
 * Half-open est **single-probe** : une seule sonde à la fois dans la fenêtre
 * `probeTimeoutMs` (best-effort — la persistance Redis get/set n'est pas un CAS
 * atomique, donc en concurrence stricte quelques sondes peuvent passer ; borné
 * au nombre de workers, jamais l'illimité d'avant).
 */
export function breakerAllows(
  data: BreakerData,
  opts: BreakerOptions,
  nowMs: number,
): { allowed: boolean; next: BreakerData } {
  if (data.state === "open") {
    if (nowMs >= data.openUntilMs) {
      // cooldown écoulé → réclame LA sonde half-open
      return {
        allowed: true,
        next: { ...data, state: "half_open", probeUntilMs: nowMs + opts.probeTimeoutMs },
      };
    }
    return { allowed: false, next: data };
  }
  if (data.state === "half_open") {
    // Une sonde déjà en vol → refuser jusqu'à son résultat (ou expiration).
    if (nowMs < data.probeUntilMs) return { allowed: false, next: data };
    // Sonde précédente expirée sans `record` → autoriser une nouvelle sonde.
    return { allowed: true, next: { ...data, probeUntilMs: nowMs + opts.probeTimeoutMs } };
  }
  return { allowed: true, next: data }; // closed
}

/** Applique le résultat d'un appel (pur). */
export function applyResult(
  data: BreakerData,
  opts: BreakerOptions,
  nowMs: number,
  success: boolean,
): BreakerData {
  if (success) {
    // Tout succès referme et réinitialise.
    return { state: "closed", failures: 0, openUntilMs: 0, probeUntilMs: 0 };
  }
  // Échec
  if (data.state === "half_open") {
    // La sonde a échoué → ré-ouvre pour un nouveau cooldown.
    return {
      state: "open",
      failures: data.failures + 1,
      openUntilMs: nowMs + opts.cooldownMs,
      probeUntilMs: 0,
    };
  }
  const failures = data.failures + 1;
  if (failures >= opts.failuresToOpen) {
    return { state: "open", failures, openUntilMs: nowMs + opts.cooldownMs, probeUntilMs: 0 };
  }
  return { state: "closed", failures, openUntilMs: 0, probeUntilMs: 0 };
}

/** Store Redis minimal (satisfait par ioredis et le stub). */
export interface RedisKvClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
}

export class CircuitBreaker {
  constructor(
    private readonly redis: RedisKvClient,
    private readonly opts: BreakerOptions,
    private readonly deps: { now?: () => number } = {},
  ) {}

  private key(source: string): string {
    return `prospection:breaker:${source}`;
  }

  private async load(source: string): Promise<BreakerData> {
    try {
      const raw = await this.redis.get(this.key(source));
      if (!raw) return { ...INITIAL_BREAKER };
      const parsed = JSON.parse(raw) as Partial<BreakerData>;
      return {
        state: parsed.state ?? "closed",
        failures: parsed.failures ?? 0,
        openUntilMs: parsed.openUntilMs ?? 0,
        probeUntilMs: parsed.probeUntilMs ?? 0,
      };
    } catch {
      return { ...INITIAL_BREAKER };
    }
  }

  private async save(source: string, data: BreakerData): Promise<void> {
    try {
      await this.redis.set(this.key(source), JSON.stringify(data));
    } catch {
      // fail-soft : un breaker non persisté ne doit pas casser la collecte
    }
  }

  /** True si un appel à `source` est autorisé (met à jour l'état half-open si besoin). */
  async canProceed(source: string): Promise<boolean> {
    const now = this.deps.now ? this.deps.now() : Date.now();
    const data = await this.load(source);
    const { allowed, next } = breakerAllows(data, this.opts, now);
    if (next !== data) await this.save(source, next);
    return allowed;
  }

  /** Enregistre le résultat d'un appel à `source`. */
  async record(source: string, success: boolean): Promise<BreakerData> {
    const now = this.deps.now ? this.deps.now() : Date.now();
    const data = await this.load(source);
    const next = applyResult(data, this.opts, now, success);
    await this.save(source, next);
    return next;
  }

  /** État courant (lecture seule) — pour le dashboard/alertes. */
  async peek(source: string): Promise<BreakerData> {
    return this.load(source);
  }
}
