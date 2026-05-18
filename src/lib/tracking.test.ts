// Tests tracking funnel — Sprint X.18.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { priceBucketFromCents, trackFunnel } from "./tracking";

vi.mock("@/lib/analytics/plausible-tracker", () => ({
  trackEvent: vi.fn(),
}));

import { trackEvent } from "@/lib/analytics/plausible-tracker";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("priceBucketFromCents", () => {
  it("buckets 5 plages", () => {
    expect(priceBucketFromCents(0)).toBe("lt-500");
    expect(priceBucketFromCents(49_900)).toBe("lt-500");
    expect(priceBucketFromCents(50_000)).toBe("500-1000");
    expect(priceBucketFromCents(99_900)).toBe("500-1000");
    expect(priceBucketFromCents(100_000)).toBe("1000-2000");
    expect(priceBucketFromCents(199_900)).toBe("1000-2000");
    expect(priceBucketFromCents(200_000)).toBe("2000-5000");
    expect(priceBucketFromCents(499_900)).toBe("2000-5000");
    expect(priceBucketFromCents(500_000)).toBe("gt-5000");
    expect(priceBucketFromCents(2_000_000)).toBe("gt-5000");
  });

  it("undefined/null/negatif → undefined", () => {
    expect(priceBucketFromCents(null)).toBeUndefined();
    expect(priceBucketFromCents(undefined)).toBeUndefined();
    expect(priceBucketFromCents(-100)).toBeUndefined();
  });
});

describe("trackFunnel", () => {
  it("filtre les props undefined/null/empty", () => {
    // exactOptionalPropertyTypes refuse `undefined` explicite ; on simule
    // via cast (cas réel : variable optionnelle qui peut être undefined).
    const variableSource: string | undefined = undefined;
    trackFunnel("Booking Submitted", {
      intervention: "essentielle",
      fromCity: "",
      ...(variableSource ? { utmSource: variableSource } : {}),
    });
    expect(trackEvent).toHaveBeenCalledWith("Booking Submitted", {
      props: { intervention: "essentielle" },
    });
  });

  it("appelle trackEvent sans props si tout est filtré", () => {
    trackFunnel("Audit Started", {});
    expect(trackEvent).toHaveBeenCalledWith("Audit Started", undefined);
  });

  it("transmet tous les types valides", () => {
    trackFunnel("Payment Completed", {
      intervention: "approfondie",
      priceBucket: "1000-2000",
      utmSource: "google",
      requiresQuote: "no",
    });
    expect(trackEvent).toHaveBeenCalledWith("Payment Completed", {
      props: {
        intervention: "approfondie",
        priceBucket: "1000-2000",
        utmSource: "google",
        requiresQuote: "no",
      },
    });
  });
});
