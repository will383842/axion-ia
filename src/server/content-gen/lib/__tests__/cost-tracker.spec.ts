/**
 * Sprint 1 Day 5 — Tests cost-tracker.
 *
 * Vérifie le bypass V0 transitoire (DB pas accessible → no-op).
 * Les tests integration cost cap end-to-end avec DB sont reportés Sprint 1
 * Day 5.5 (mock prisma) ou Sprint 6 (vrai DB de test Postgres).
 */

import { describe, expect, it } from "vitest";
import { assertCostCapAvailable, trackCost } from "../cost-tracker";

describe("cost-tracker — V0 bypass mode", () => {
  it("assertCostCapAvailable returns void in bypass mode (DB inaccessible)", async () => {
    // Sans DB accessible, le helper bypass silencieusement (cf. PrismaClientInitializationError)
    await expect(assertCostCapAvailable("openai", 0.1)).resolves.toBeUndefined();
  });

  it("trackCost is no-op in bypass mode (DB inaccessible)", async () => {
    await expect(
      trackCost({
        provider: "openai",
        model: "gpt-4o",
        tokensInput: 1000,
        tokensOutput: 500,
        costUsd: 0.0075,
      }),
    ).resolves.toBeUndefined();
  });
});
