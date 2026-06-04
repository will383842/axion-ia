// T-28 — token-bucket (régulation débit LLM + backpressure).

import { describe, it, expect } from "vitest";
import { TokenBucket } from "@/server/chatbot/resilience/token-bucket";

describe("TokenBucket", () => {
  it("autorise jusqu'à la capacité puis applique le backpressure", () => {
    const t = 1000;
    const b = new TokenBucket({ capacity: 3, refillPerSec: 1, now: () => t });
    expect(b.tryAcquire()).toBe(true);
    expect(b.tryAcquire()).toBe(true);
    expect(b.tryAcquire()).toBe(true);
    expect(b.tryAcquire()).toBe(false); // vide → backpressure
  });

  it("recharge au prorata du temps écoulé", () => {
    let t = 0;
    const b = new TokenBucket({ capacity: 5, refillPerSec: 2, now: () => t });
    for (let i = 0; i < 5; i++) b.tryAcquire();
    expect(b.tryAcquire()).toBe(false);
    t = 1000; // +1 s → +2 jetons
    expect(b.tryAcquire()).toBe(true);
    expect(b.tryAcquire()).toBe(true);
    expect(b.tryAcquire()).toBe(false);
  });

  it("ne dépasse jamais la capacité au refill", () => {
    let t = 0;
    const b = new TokenBucket({ capacity: 4, refillPerSec: 10, now: () => t });
    t = 100_000; // énorme délai → plafonné à capacity
    expect(b.available()).toBe(4);
  });
});
