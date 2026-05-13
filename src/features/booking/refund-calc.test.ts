// Tests refund-calc (Sprint X.15 / X.7 final).

import { describe, it, expect } from "vitest";
import { computeRefundFromCancellation } from "./refund-calc";

describe("computeRefundFromCancellation", () => {
  const fixedNow = new Date("2026-06-01T12:00:00Z");

  it("J-15+ → 50% refund + window more_than_15d", () => {
    const bookingDate = new Date("2026-06-20T12:00:00Z"); // J+19
    const res = computeRefundFromCancellation({ bookingDate, now: fixedNow });
    expect(res.refundPercentage).toBe(50);
    expect(res.cancellationWindow).toBe("more_than_15d");
  });

  it("exactement J-15 → 50% (boundary)", () => {
    const bookingDate = new Date("2026-06-16T12:00:00Z"); // J+15 exact
    const res = computeRefundFromCancellation({ bookingDate, now: fixedNow });
    expect(res.refundPercentage).toBe(50);
    expect(res.cancellationWindow).toBe("more_than_15d");
  });

  it("J-7 (entre 15 et 2) → 0% + window between_15d_and_2d", () => {
    const bookingDate = new Date("2026-06-08T12:00:00Z"); // J+7
    const res = computeRefundFromCancellation({ bookingDate, now: fixedNow });
    expect(res.refundPercentage).toBe(0);
    expect(res.cancellationWindow).toBe("between_15d_and_2d");
  });

  it("J-1 (< J-2) → 0% + window less_than_2d", () => {
    const bookingDate = new Date("2026-06-02T12:00:00Z"); // J+1
    const res = computeRefundFromCancellation({ bookingDate, now: fixedNow });
    expect(res.refundPercentage).toBe(0);
    expect(res.cancellationWindow).toBe("less_than_2d");
  });

  it("booking déjà passé → 0% + less_than_2d", () => {
    const bookingDate = new Date("2026-05-25T12:00:00Z"); // J-7 (passé)
    const res = computeRefundFromCancellation({ bookingDate, now: fixedNow });
    expect(res.refundPercentage).toBe(0);
    expect(res.cancellationWindow).toBe("less_than_2d");
  });
});
