// Sprint X.2 — tests skeleton lib Stripe.
//
// Cible : helpers purs (isStripeConfigured, getWebhookSecret throwing).
// Le client Stripe singleton est testé indirectement via les tests d'intégration
// (Sprint X.4+ — workers BullMQ qui invoquent stripe-mock).

import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("lib/stripe", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env["STRIPE_SECRET_KEY"];
    delete process.env["STRIPE_WEBHOOK_SECRET"];
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("isStripeConfigured returns false when STRIPE_SECRET_KEY missing", async () => {
    const { isStripeConfigured } = await import("./stripe");
    expect(isStripeConfigured()).toBe(false);
  });

  it("getWebhookSecret throws when STRIPE_WEBHOOK_SECRET missing", async () => {
    const { getWebhookSecret } = await import("./stripe");
    expect(() => getWebhookSecret()).toThrow(/STRIPE_WEBHOOK_SECRET/);
  });

  it("STRIPE_API_VERSION is pinned (no accidental bump)", async () => {
    const { STRIPE_API_VERSION } = await import("./stripe");
    // Bump = doit passer par ADR explicit + revue webhook event shapes.
    expect(STRIPE_API_VERSION).toBe("2026-04-22.dahlia");
  });
});
