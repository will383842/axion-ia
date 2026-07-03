/**
 * Prospection — Token-bucket distribué (Redis) pour le rate-limit GLOBAL par
 * source (T3). Complète le `limiter` BullMQ par-file : tient la limite globale
 * (ex. 7 req/s recherche-entreprises) malgré la concurrence multi-workers.
 *
 * Atomicité via un script Lua (refill + consume en une commande). La logique de
 * refill est aussi exposée en pur (`computeBucket`) pour être testée sans Redis.
 *
 * Défense en profondeur du rate-limit :
 *  1. **Limiter BullMQ** `limiter:{max,duration}` sur les Workers collect/enrich
 *     (T4/T5) = garde-fou DUR, Redis-coordonné par file (jamais > limite).
 *  2. **Ce token-bucket** = lissage GLOBAL multi-source par-dessus, fail-open
 *     (si Redis tombe, on autorise plutôt que bloquer toute la collecte — le
 *     limiter BullMQ (1) borne déjà le débit).
 */

export interface BucketState {
  tokens: number;
  lastRefillMs: number;
}

export interface BucketOptions {
  capacity: number;
  refillPerSec: number;
}

/** Refill puis tentative de consommation (pur, déterministe, testable). */
export function computeBucket(
  state: BucketState,
  opts: BucketOptions,
  nowMs: number,
  cost = 1,
): { allowed: boolean; newState: BucketState } {
  const elapsedSec = Math.max(0, (nowMs - state.lastRefillMs) / 1000);
  const refilled = Math.min(opts.capacity, state.tokens + elapsedSec * opts.refillPerSec);
  if (refilled >= cost) {
    return { allowed: true, newState: { tokens: refilled - cost, lastRefillMs: nowMs } };
  }
  return { allowed: false, newState: { tokens: refilled, lastRefillMs: nowMs } };
}

// Script Lua : KEYS[1]=clé bucket ; ARGV = capacity, refillPerSec, nowMs, cost, ttlSec.
// Retourne 1 si autorisé, 0 sinon. Miroir de computeBucket.
const LUA_TOKEN_BUCKET = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])
local ttl = tonumber(ARGV[5])
local data = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(data[1])
local ts = tonumber(data[2])
if tokens == nil then tokens = capacity; ts = now end
local elapsed = math.max(0, (now - ts) / 1000)
tokens = math.min(capacity, tokens + elapsed * refill)
local allowed = 0
if tokens >= cost then
  tokens = tokens - cost
  allowed = 1
end
redis.call('HMSET', key, 'tokens', tokens, 'ts', now)
redis.call('PEXPIRE', key, ttl * 1000)
return allowed
`;

/** Client Redis minimal requis (satisfait par ioredis et par le stub). */
export interface RedisEvalClient {
  eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>;
}

export class RedisTokenBucket {
  constructor(
    private readonly redis: RedisEvalClient,
    private readonly opts: BucketOptions,
    private readonly deps: { now?: () => number; ttlSec?: number } = {},
  ) {}

  /**
   * Tente d'acquérir `cost` jetons pour `key`. Fail-open (true) si Redis échoue
   * ou est en mode stub (le limiter BullMQ reste le garde-fou dur).
   */
  async tryAcquire(key: string, cost = 1): Promise<boolean> {
    const now = this.deps.now ? this.deps.now() : Date.now();
    const ttlSec = this.deps.ttlSec ?? Math.ceil(this.opts.capacity / this.opts.refillPerSec) + 60;
    try {
      const res = await this.redis.eval(
        LUA_TOKEN_BUCKET,
        1,
        `prospection:tb:${key}`,
        this.opts.capacity,
        this.opts.refillPerSec,
        now,
        cost,
        ttlSec,
      );
      if (res === null || res === undefined) return true; // stub → fail-open
      return Number(res) === 1;
    } catch {
      return true; // fail-open
    }
  }
}
