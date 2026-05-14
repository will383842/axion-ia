import { describe, expect, it } from "vitest";
import { computeAntiBurstSchedule, msSinceStartOfDay } from "../anti-burst";

const HOUR = 3_600_000;
const DAY = 86_400_000;

describe("computeAntiBurstSchedule", () => {
  it("returns empty when no target defined", () => {
    expect(
      computeAntiBurstSchedule({
        targetByType: {},
        createdTodayByType: {},
        msSinceStartOfDay: HOUR * 6,
        antiBurstEnabled: true,
      }),
    ).toEqual([]);
  });

  it("returns empty when target=0 (type disabled)", () => {
    expect(
      computeAntiBurstSchedule({
        targetByType: { blog_article: 0 },
        createdTodayByType: {},
        msSinceStartOfDay: HOUR * 12,
        antiBurstEnabled: true,
      }),
    ).toEqual([]);
  });

  it("anti-burst OFF: enqueues full remaining at once", () => {
    expect(
      computeAntiBurstSchedule({
        targetByType: { blog_article: 24 },
        createdTodayByType: { blog_article: 5 },
        msSinceStartOfDay: HOUR * 2,
        antiBurstEnabled: false,
      }),
    ).toEqual([{ contentType: "blog_article", enqueueCount: 19 }]);
  });

  it("anti-burst ON: at midnight (t=0), enqueues 0 jobs", () => {
    expect(
      computeAntiBurstSchedule({
        targetByType: { blog_article: 24 },
        createdTodayByType: {},
        msSinceStartOfDay: 0,
        antiBurstEnabled: true,
      }),
    ).toEqual([]);
  });

  it("anti-burst ON: at midnight + 1ms, expected=1, enqueues 1", () => {
    expect(
      computeAntiBurstSchedule({
        targetByType: { blog_article: 24 },
        createdTodayByType: {},
        msSinceStartOfDay: 1,
        antiBurstEnabled: true,
      }),
    ).toEqual([{ contentType: "blog_article", enqueueCount: 1 }]);
  });

  it("anti-burst ON: at 6am for target=24/day, expected=6 jobs", () => {
    expect(
      computeAntiBurstSchedule({
        targetByType: { blog_article: 24 },
        createdTodayByType: {},
        msSinceStartOfDay: HOUR * 6,
        antiBurstEnabled: true,
      }),
    ).toEqual([{ contentType: "blog_article", enqueueCount: 6 }]);
  });

  it("anti-burst ON: at 6am with 4 already created, enqueues 2 to catch up", () => {
    expect(
      computeAntiBurstSchedule({
        targetByType: { blog_article: 24 },
        createdTodayByType: { blog_article: 4 },
        msSinceStartOfDay: HOUR * 6,
        antiBurstEnabled: true,
      }),
    ).toEqual([{ contentType: "blog_article", enqueueCount: 2 }]);
  });

  it("anti-burst ON: already ahead of schedule, enqueues 0", () => {
    expect(
      computeAntiBurstSchedule({
        targetByType: { blog_article: 24 },
        createdTodayByType: { blog_article: 10 },
        msSinceStartOfDay: HOUR * 6,
        antiBurstEnabled: true,
      }),
    ).toEqual([]);
  });

  it("anti-burst ON: at end-of-day (t=24h), expected=target", () => {
    expect(
      computeAntiBurstSchedule({
        targetByType: { blog_article: 24 },
        createdTodayByType: { blog_article: 20 },
        msSinceStartOfDay: DAY,
        antiBurstEnabled: true,
      }),
    ).toEqual([{ contentType: "blog_article", enqueueCount: 4 }]);
  });

  it("anti-burst ON: target reached, enqueues 0", () => {
    expect(
      computeAntiBurstSchedule({
        targetByType: { blog_article: 24 },
        createdTodayByType: { blog_article: 24 },
        msSinceStartOfDay: HOUR * 23,
        antiBurstEnabled: true,
      }),
    ).toEqual([]);
  });

  it("anti-burst ON: handles multiple types independently", () => {
    const out = computeAntiBurstSchedule({
      targetByType: { blog_article: 24, comparison: 4, faq_standalone: 12 },
      createdTodayByType: { blog_article: 3, comparison: 2 },
      msSinceStartOfDay: HOUR * 12,
      antiBurstEnabled: true,
    });
    // blog_article: expected=12 → enqueue 9
    // comparison: expected=2 → already 2, enqueue 0 (skipped)
    // faq_standalone: expected=6 → enqueue 6
    expect(out).toEqual([
      { contentType: "blog_article", enqueueCount: 9 },
      { contentType: "faq_standalone", enqueueCount: 6 },
    ]);
  });

  it("anti-burst ON: small target (5/day), at hour 1 expected=1", () => {
    const out = computeAntiBurstSchedule({
      targetByType: { comparison: 5 },
      createdTodayByType: {},
      msSinceStartOfDay: HOUR * 1,
      antiBurstEnabled: true,
    });
    expect(out).toEqual([{ contentType: "comparison", enqueueCount: 1 }]);
  });

  it("anti-burst ON: large target (50/day), at hour 2 expected=5", () => {
    const out = computeAntiBurstSchedule({
      targetByType: { blog_from_keywords: 50 },
      createdTodayByType: {},
      msSinceStartOfDay: HOUR * 2,
      antiBurstEnabled: true,
    });
    expect(out).toEqual([{ contentType: "blog_from_keywords", enqueueCount: 5 }]);
  });

  it("clamps msSinceStartOfDay > 24h to 24h", () => {
    const out = computeAntiBurstSchedule({
      targetByType: { blog_article: 10 },
      createdTodayByType: {},
      msSinceStartOfDay: DAY + HOUR,
      antiBurstEnabled: true,
    });
    expect(out).toEqual([{ contentType: "blog_article", enqueueCount: 10 }]);
  });

  it("clamps negative msSinceStartOfDay to 0", () => {
    const out = computeAntiBurstSchedule({
      targetByType: { blog_article: 10 },
      createdTodayByType: {},
      msSinceStartOfDay: -1000,
      antiBurstEnabled: true,
    });
    expect(out).toEqual([]);
  });
});

describe("msSinceStartOfDay", () => {
  it("returns 0 at UTC midnight", () => {
    const midnight = new Date(Date.UTC(2026, 4, 14, 0, 0, 0));
    expect(msSinceStartOfDay(midnight)).toBe(0);
  });

  it("returns 1h at 1am UTC", () => {
    const oneAm = new Date(Date.UTC(2026, 4, 14, 1, 0, 0));
    expect(msSinceStartOfDay(oneAm)).toBe(HOUR);
  });

  it("returns 6h at 6am UTC", () => {
    const sixAm = new Date(Date.UTC(2026, 4, 14, 6, 0, 0));
    expect(msSinceStartOfDay(sixAm)).toBe(HOUR * 6);
  });

  it("returns < 24h just before midnight next day", () => {
    const late = new Date(Date.UTC(2026, 4, 14, 23, 59, 59));
    const result = msSinceStartOfDay(late);
    expect(result).toBeGreaterThan(HOUR * 23);
    expect(result).toBeLessThan(DAY);
  });
});
