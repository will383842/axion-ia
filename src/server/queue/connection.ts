// BullMQ Redis connection (Sprint 15 / M8 step 4).
//
// BullMQ exige une connexion ioredis avec maxRetriesPerRequest=null pour
// les blocking commands (BLPOP, BRPOPLPUSH...) sinon Worker plante au boot.
//
// On garde une connexion separee de `src/lib/redis.ts` (qui sert au rate-limit)
// car les options BullMQ sont incompatibles avec le client rate-limit.
//
// Toggle dev : `BULLMQ_DISABLED=true` → retourne `null`. Permet `pnpm dev`
// en local sans Redis (sinon ioredis spam `[bullmq-redis]` errors en boucle
// → OOM Node après ~45min). Toujours `false` en production.

import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6381";

let _bullConnection: Redis | null = null;

export function isBullmqDisabled(): boolean {
  return process.env.BULLMQ_DISABLED === "true";
}

export function getBullConnection(): Redis | null {
  if (isBullmqDisabled()) return null;
  if (_bullConnection) return _bullConnection;
  _bullConnection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null, // requis BullMQ
    enableReadyCheck: false,
    // Defer connection until first BullMQ command. Same rationale as
    // src/lib/redis.ts — avoids blocking Node boot via queues.ts top-level
    // Queue instantiation when Redis is unreachable.
    lazyConnect: true,
  });
  _bullConnection.on("error", (err: Error) => {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[bullmq-redis]", err.message);
    }
  });
  return _bullConnection;
}

/**
 * Variante non-null pour les workers BullMQ (qui n'existent que si Redis OK).
 * Throw si `BULLMQ_DISABLED=true` — caller doit avoir guard en amont via
 * `isBullmqDisabled()` (cf. `worker.ts::main()`).
 */
export function getBullConnectionOrThrow(): Redis {
  const conn = getBullConnection();
  if (!conn) {
    throw new Error(
      "[bullmq] getBullConnectionOrThrow called while BULLMQ_DISABLED=true — caller must guard.",
    );
  }
  return conn;
}
