// BullMQ Redis connection (Sprint 15 / M8 step 4).
//
// BullMQ exige une connexion ioredis avec maxRetriesPerRequest=null pour
// les blocking commands (BLPOP, BRPOPLPUSH...) sinon Worker plante au boot.
//
// On garde une connexion separee de `src/lib/redis.ts` (qui sert au rate-limit)
// car les options BullMQ sont incompatibles avec le client rate-limit.

import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6381";

let _bullConnection: Redis | null = null;

export function getBullConnection(): Redis {
  if (_bullConnection) return _bullConnection;
  _bullConnection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null, // requis BullMQ
    enableReadyCheck: false,
  });
  _bullConnection.on("error", (err: Error) => {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[bullmq-redis]", err.message);
    }
  });
  return _bullConnection;
}
