import { describe, it, expect } from "vitest";
import {
  breakerAllows,
  applyResult,
  CircuitBreaker,
  INITIAL_BREAKER,
  type BreakerData,
  type RedisKvClient,
} from "./circuit-breaker";

const OPTS = { failuresToOpen: 3, cooldownMs: 60_000, probeTimeoutMs: 30_000 };

describe("applyResult / breakerAllows (machine à états pure)", () => {
  it("ouvre après K échecs consécutifs", () => {
    let d: BreakerData = { ...INITIAL_BREAKER };
    d = applyResult(d, OPTS, 1000, false); // 1
    expect(d.state).toBe("closed");
    d = applyResult(d, OPTS, 1000, false); // 2
    expect(d.state).toBe("closed");
    d = applyResult(d, OPTS, 1000, false); // 3 → open
    expect(d.state).toBe("open");
    expect(d.openUntilMs).toBe(1000 + OPTS.cooldownMs);
  });

  it("refuse les appels tant que le cooldown n'est pas écoulé", () => {
    const open: BreakerData = { state: "open", failures: 3, openUntilMs: 61_000, probeUntilMs: 0 };
    expect(breakerAllows(open, OPTS, 30_000).allowed).toBe(false);
  });

  it("passe half-open après le cooldown et réclame LA sonde", () => {
    const open: BreakerData = { state: "open", failures: 3, openUntilMs: 61_000, probeUntilMs: 0 };
    const r = breakerAllows(open, OPTS, 61_000);
    expect(r.allowed).toBe(true);
    expect(r.next.state).toBe("half_open");
    expect(r.next.probeUntilMs).toBe(61_000 + OPTS.probeTimeoutMs);
  });

  it("single-probe : une 2e sonde est refusée tant qu'une sonde est en vol", () => {
    const half: BreakerData = {
      state: "half_open",
      failures: 3,
      openUntilMs: 61_000,
      probeUntilMs: 91_000,
    };
    expect(breakerAllows(half, OPTS, 70_000).allowed).toBe(false); // sonde en vol
    expect(breakerAllows(half, OPTS, 92_000).allowed).toBe(true); // sonde expirée → nouvelle sonde
  });

  it("un succès referme et réinitialise", () => {
    const half: BreakerData = {
      state: "half_open",
      failures: 3,
      openUntilMs: 61_000,
      probeUntilMs: 91_000,
    };
    const d = applyResult(half, OPTS, 62_000, true);
    expect(d).toEqual({ state: "closed", failures: 0, openUntilMs: 0, probeUntilMs: 0 });
  });

  it("un échec en half-open ré-ouvre pour un nouveau cooldown", () => {
    const half: BreakerData = {
      state: "half_open",
      failures: 3,
      openUntilMs: 61_000,
      probeUntilMs: 91_000,
    };
    const d = applyResult(half, OPTS, 62_000, false);
    expect(d.state).toBe("open");
    expect(d.openUntilMs).toBe(62_000 + OPTS.cooldownMs);
  });

  it("un succès en closed remet le compteur d'échecs à zéro", () => {
    const d: BreakerData = { state: "closed", failures: 2, openUntilMs: 0, probeUntilMs: 0 };
    expect(applyResult(d, OPTS, 0, true).failures).toBe(0);
  });
});

describe("CircuitBreaker (Redis fake) — cycle complet", () => {
  function fakeRedis(): RedisKvClient {
    const store = new Map<string, string>();
    return {
      async get(k) {
        return store.get(k) ?? null;
      },
      async set(k, v) {
        store.set(k, String(v));
        return "OK";
      },
    };
  }

  it("ouvre puis referme après un succès half-open", async () => {
    let clock = 1000;
    const cb = new CircuitBreaker(fakeRedis(), OPTS, { now: () => clock });
    expect(await cb.canProceed("rne")).toBe(true);
    await cb.record("rne", false);
    await cb.record("rne", false);
    await cb.record("rne", false); // open
    expect(await cb.canProceed("rne")).toBe(false); // cooldown en cours

    clock += OPTS.cooldownMs; // cooldown écoulé
    expect(await cb.canProceed("rne")).toBe(true); // sonde half-open
    await cb.record("rne", true); // succès → referme
    expect((await cb.peek("rne")).state).toBe("closed");
  });

  it("fail-open si Redis get jette", async () => {
    const broken: RedisKvClient = {
      async get() {
        throw new Error("down");
      },
      async set() {
        return "OK";
      },
    };
    const cb = new CircuitBreaker(broken, OPTS);
    expect(await cb.canProceed("x")).toBe(true);
  });
});
