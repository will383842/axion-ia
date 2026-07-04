import { describe, it, expect } from "vitest";
import {
  computeBucket,
  RedisTokenBucket,
  type BucketState,
  type RedisEvalClient,
} from "./token-bucket-redis";

const OPTS = { capacity: 7, refillPerSec: 7 };

describe("computeBucket (pur)", () => {
  it("consomme un jeton quand disponible", () => {
    const s: BucketState = { tokens: 7, lastRefillMs: 1000 };
    const r = computeBucket(s, OPTS, 1000, 1);
    expect(r.allowed).toBe(true);
    expect(r.newState.tokens).toBe(6);
  });
  it("refuse quand vide, sans refill suffisant", () => {
    const s: BucketState = { tokens: 0, lastRefillMs: 1000 };
    const r = computeBucket(s, OPTS, 1000, 1);
    expect(r.allowed).toBe(false);
    expect(r.newState.tokens).toBe(0);
  });
  it("recharge avec le temps (1s → +7 jetons, plafonné à la capacité)", () => {
    const s: BucketState = { tokens: 0, lastRefillMs: 1000 };
    const r = computeBucket(s, OPTS, 2000, 1); // +1s → +7, cap 7
    expect(r.allowed).toBe(true);
    expect(r.newState.tokens).toBe(6);
  });
  it("ne dépasse jamais la capacité", () => {
    const s: BucketState = { tokens: 7, lastRefillMs: 0 };
    const r = computeBucket(s, OPTS, 100000, 0);
    expect(r.newState.tokens).toBe(7);
  });
  it("jamais plus de refillPerSec/s sur la durée (garde-fou débit)", () => {
    // 10 tentatives en 1s à capacité 7, refill 7/s → au plus ~7 acceptées au départ.
    let state: BucketState = { tokens: 7, lastRefillMs: 0 };
    let allowed = 0;
    for (let i = 0; i < 10; i++) {
      const r = computeBucket(state, OPTS, 0, 1); // même instant → pas de refill
      state = r.newState;
      if (r.allowed) allowed++;
    }
    expect(allowed).toBe(7); // exactement la capacité, pas plus
  });
});

describe("RedisTokenBucket — fail-open", () => {
  it("autorise si Redis renvoie null (stub)", async () => {
    const stub: RedisEvalClient = {
      async eval() {
        return null;
      },
    };
    const tb = new RedisTokenBucket(stub, OPTS);
    expect(await tb.tryAcquire("recherche-entreprises")).toBe(true);
  });
  it("autorise si Redis jette (fail-open)", async () => {
    const broken: RedisEvalClient = {
      async eval() {
        throw new Error("redis down");
      },
    };
    const tb = new RedisTokenBucket(broken, OPTS);
    expect(await tb.tryAcquire("x")).toBe(true);
  });
  it("respecte la décision Lua (1 = autorisé, 0 = refusé)", async () => {
    let ret: number = 1;
    const fake: RedisEvalClient = {
      async eval() {
        return ret;
      },
    };
    const tb = new RedisTokenBucket(fake, OPTS);
    expect(await tb.tryAcquire("x")).toBe(true);
    ret = 0;
    expect(await tb.tryAcquire("x")).toBe(false);
  });
});
