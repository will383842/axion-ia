// Tests Sprint X.5 — multi-options simultanées (cap configurable).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMaxConcurrentOptionsPerSlot, ACTIVE_OPTION_STATUSES } from "./option-cap";

describe("option-cap — getMaxConcurrentOptionsPerSlot", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env["BOOKING_MAX_CONCURRENT_OPTIONS_PER_SLOT"];
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("retourne 3 par défaut (ADR 0017)", () => {
    expect(getMaxConcurrentOptionsPerSlot()).toBe(3);
  });

  it("respecte l'override env", () => {
    process.env["BOOKING_MAX_CONCURRENT_OPTIONS_PER_SLOT"] = "5";
    expect(getMaxConcurrentOptionsPerSlot()).toBe(5);
  });

  it("fallback default si env négatif", () => {
    process.env["BOOKING_MAX_CONCURRENT_OPTIONS_PER_SLOT"] = "-1";
    expect(getMaxConcurrentOptionsPerSlot()).toBe(3);
  });

  it("fallback default si env zéro", () => {
    process.env["BOOKING_MAX_CONCURRENT_OPTIONS_PER_SLOT"] = "0";
    expect(getMaxConcurrentOptionsPerSlot()).toBe(3);
  });

  it("fallback default si env non-numérique", () => {
    process.env["BOOKING_MAX_CONCURRENT_OPTIONS_PER_SLOT"] = "abc";
    expect(getMaxConcurrentOptionsPerSlot()).toBe(3);
  });

  it("supporte cap = 1 (legacy single-option mode)", () => {
    process.env["BOOKING_MAX_CONCURRENT_OPTIONS_PER_SLOT"] = "1";
    expect(getMaxConcurrentOptionsPerSlot()).toBe(1);
  });
});

describe("option-cap — ACTIVE_OPTION_STATUSES", () => {
  it("inclut les statuts actifs V0 + V1", () => {
    expect(ACTIVE_OPTION_STATUSES).toContain("pending");
    expect(ACTIVE_OPTION_STATUSES).toContain("pending_validation");
    expect(ACTIVE_OPTION_STATUSES).toContain("validated");
  });

  it("exclut les statuts terminaux", () => {
    expect(ACTIVE_OPTION_STATUSES).not.toContain("expired");
    expect(ACTIVE_OPTION_STATUSES).not.toContain("refused");
    expect(ACTIVE_OPTION_STATUSES).not.toContain("lost_other_won");
    expect(ACTIVE_OPTION_STATUSES).not.toContain("expired_no_response");
    expect(ACTIVE_OPTION_STATUSES).not.toContain("converted");
  });
});
