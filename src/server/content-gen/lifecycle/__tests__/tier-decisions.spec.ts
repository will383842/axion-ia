import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIER_THRESHOLDS,
  computeTierDecision,
  type TierDecisionInput,
} from "../tier-decisions";

const baseTier2: TierDecisionInput = {
  currentTier: "tier_2_noindex_follow",
  ageDays: 45,
  ctr: 0.08,
  impressions: 500,
};

const baseTier1: TierDecisionInput = {
  currentTier: "tier_1_indexable",
  ageDays: 90,
  ctr: 0.005,
  impressions: 500,
};

describe("computeTierDecision — noop conditions", () => {
  it("noop when ctr=null (no data)", () => {
    expect(computeTierDecision({ ...baseTier2, ctr: null }).action).toBe("noop");
  });

  it("noop when impressions=null", () => {
    expect(computeTierDecision({ ...baseTier2, impressions: null }).action).toBe("noop");
  });

  it("noop when impressions below threshold", () => {
    const result = computeTierDecision({ ...baseTier2, impressions: 50 });
    expect(result.action).toBe("noop");
    expect(result.reason).toContain("low_impressions");
  });

  it("noop on tier_3 (excluded from auto-lifecycle)", () => {
    expect(
      computeTierDecision({
        currentTier: "tier_3_noindex_nofollow",
        ageDays: 100,
        ctr: 0.5,
        impressions: 1000,
      }).action,
    ).toBe("noop");
  });
});

describe("computeTierDecision — tier-2 promote logic", () => {
  it("promotes tier-2 when ctr > 5% AND age > 30d AND impressions > 100", () => {
    const result = computeTierDecision(baseTier2);
    expect(result.action).toBe("promote");
    expect(result.nextTier).toBe("tier_1_indexable");
    expect(result.reason).toContain("8.00%");
  });

  it("noop on tier-2 when article is immature (< 30d)", () => {
    const result = computeTierDecision({ ...baseTier2, ageDays: 15 });
    expect(result.action).toBe("noop");
    expect(result.reason).toContain("immature");
  });

  it("noop on tier-2 when ctr exactly at threshold (5%)", () => {
    const result = computeTierDecision({ ...baseTier2, ctr: 0.05 });
    expect(result.action).toBe("noop");
  });

  it("promotes when ctr just above threshold", () => {
    const result = computeTierDecision({ ...baseTier2, ctr: 0.0501 });
    expect(result.action).toBe("promote");
  });

  it("noop on tier-2 when ctr < 5%", () => {
    const result = computeTierDecision({ ...baseTier2, ctr: 0.02 });
    expect(result.action).toBe("noop");
    expect(result.reason).toContain("below promote threshold");
  });
});

describe("computeTierDecision — tier-1 demote logic", () => {
  it("demotes tier-1 when ctr < 1% AND age > 60d", () => {
    const result = computeTierDecision(baseTier1);
    expect(result.action).toBe("demote");
    expect(result.nextTier).toBe("tier_2_noindex_follow");
  });

  it("noop on tier-1 when ctr above demote threshold (ctr=1.5%)", () => {
    const result = computeTierDecision({ ...baseTier1, ctr: 0.015 });
    expect(result.action).toBe("noop");
    expect(result.reason).toContain("above demote threshold");
  });

  it("noop on tier-1 when article recently promoted (< 60d)", () => {
    const result = computeTierDecision({ ...baseTier1, ageDays: 30 });
    expect(result.action).toBe("noop");
    expect(result.reason).toContain("recently promoted");
  });

  it("respects manual promote (protects tier-1 from demote)", () => {
    const result = computeTierDecision({ ...baseTier1, wasManuallyPromoted: true });
    expect(result.action).toBe("noop");
    expect(result.reason).toBe("manual_promote_protected");
  });

  it("demotes manual promote if respectManualPromote=false", () => {
    const result = computeTierDecision(
      { ...baseTier1, wasManuallyPromoted: true },
      { ...DEFAULT_TIER_THRESHOLDS, respectManualPromote: false },
    );
    expect(result.action).toBe("demote");
  });
});

describe("computeTierDecision — custom thresholds", () => {
  it("uses custom promoteCtrMin", () => {
    const result = computeTierDecision(
      { ...baseTier2, ctr: 0.03 },
      { ...DEFAULT_TIER_THRESHOLDS, promoteCtrMin: 0.02 },
    );
    expect(result.action).toBe("promote");
  });

  it("uses custom impressionsMinForDecision", () => {
    const result = computeTierDecision(
      { ...baseTier2, impressions: 50 },
      { ...DEFAULT_TIER_THRESHOLDS, impressionsMinForDecision: 10 },
    );
    expect(result.action).toBe("promote");
  });
});
