import { describe, it, expect, vi } from "vitest";
import { CircuitBreaker, CircuitOpenError } from "./circuit-breaker";

function makeClock(start = 0) {
  const clock = { t: start };
  return { clock, now: () => clock.t };
}

const fail = () => Promise.reject(new Error("boom"));
const succeed = () => Promise.resolve("ok");

describe("CircuitBreaker", () => {
  it("démarre fermé et laisse passer les succès", async () => {
    const { now } = makeClock();
    const cb = new CircuitBreaker({ name: "t", failureThreshold: 3, cooldownMs: 1000, now });
    expect(cb.state).toBe("closed");
    expect(await cb.run(succeed)).toBe("ok");
    expect(cb.state).toBe("closed");
  });

  it("ouvre après N échecs consécutifs", async () => {
    const { now } = makeClock();
    const cb = new CircuitBreaker({ name: "t", failureThreshold: 3, cooldownMs: 1000, now });
    for (let i = 0; i < 3; i++) {
      await expect(cb.run(fail)).rejects.toThrow("boom");
    }
    expect(cb.state).toBe("open");
  });

  it("court-circuite SANS appeler fn quand ouvert", async () => {
    const { now } = makeClock();
    const cb = new CircuitBreaker({ name: "llm", failureThreshold: 1, cooldownMs: 1000, now });
    await expect(cb.run(fail)).rejects.toThrow("boom");
    expect(cb.state).toBe("open");

    const spy = vi.fn(succeed);
    await expect(cb.run(spy)).rejects.toBeInstanceOf(CircuitOpenError);
    expect(spy).not.toHaveBeenCalled();
  });

  it("passe half-open après le refroidissement et referme sur succès", async () => {
    const { clock, now } = makeClock();
    const cb = new CircuitBreaker({ name: "t", failureThreshold: 1, cooldownMs: 1000, now });
    await expect(cb.run(fail)).rejects.toThrow();
    expect(cb.state).toBe("open");

    clock.t += 1000; // cooldown écoulé
    expect(cb.state).toBe("half_open");

    expect(await cb.run(succeed)).toBe("ok"); // essai réussi → referme
    expect(cb.state).toBe("closed");
  });

  it("rouvre si l'essai half-open échoue (cooldown redémarré)", async () => {
    const { clock, now } = makeClock();
    const cb = new CircuitBreaker({ name: "t", failureThreshold: 1, cooldownMs: 1000, now });
    await expect(cb.run(fail)).rejects.toThrow();
    clock.t += 1000;
    expect(cb.state).toBe("half_open");

    await expect(cb.run(fail)).rejects.toThrow("boom"); // essai échoue
    expect(cb.state).toBe("open"); // rouvert immédiatement
    clock.t += 999;
    expect(cb.state).toBe("open"); // cooldown pas encore écoulé
    clock.t += 1;
    expect(cb.state).toBe("half_open");
  });

  it("un succès remet le compteur d'échecs à zéro (pas d'ouverture sur échecs espacés)", async () => {
    const { now } = makeClock();
    const cb = new CircuitBreaker({ name: "t", failureThreshold: 3, cooldownMs: 1000, now });
    await expect(cb.run(fail)).rejects.toThrow();
    await expect(cb.run(fail)).rejects.toThrow();
    await cb.run(succeed); // reset
    await expect(cb.run(fail)).rejects.toThrow();
    await expect(cb.run(fail)).rejects.toThrow();
    expect(cb.state).toBe("closed"); // seulement 2 échecs consécutifs depuis le reset
  });
});
