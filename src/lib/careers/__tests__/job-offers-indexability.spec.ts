import { describe, it, expect, vi } from "vitest";

// Le module importe le singleton prisma — on le mocke (fonctions testées = pures).
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { isJobOfferIndexable, isOfferOpen } from "../job-offers";

const base = {
  status: "published",
  filledAt: null,
  indexationTier: "tier_1_indexable",
  validThrough: null,
} as const;

describe("isJobOfferIndexable", () => {
  it("true : publiée, tier_1, non pourvue, non expirée", () => {
    expect(isJobOfferIndexable({ ...base })).toBe(true);
  });

  it("false : brouillon / pourvue / tier_2 / expirée", () => {
    expect(isJobOfferIndexable({ ...base, status: "draft" })).toBe(false);
    expect(isJobOfferIndexable({ ...base, filledAt: new Date() })).toBe(false);
    expect(isJobOfferIndexable({ ...base, indexationTier: "tier_2_noindex_follow" })).toBe(false);
    expect(
      isJobOfferIndexable({ ...base, validThrough: new Date("2020-01-01T00:00:00.000Z") }),
    ).toBe(false);
  });
});

describe("isOfferOpen", () => {
  it("ouverte même en tier_2 (publiée, non pourvue, non expirée)", () => {
    expect(isOfferOpen({ status: "published", filledAt: null, validThrough: null })).toBe(true);
  });

  it("fermée si pourvue ou expirée", () => {
    expect(isOfferOpen({ status: "published", filledAt: new Date(), validThrough: null })).toBe(
      false,
    );
    expect(
      isOfferOpen({
        status: "published",
        filledAt: null,
        validThrough: new Date("2020-01-01T00:00:00.000Z"),
      }),
    ).toBe(false);
  });
});
