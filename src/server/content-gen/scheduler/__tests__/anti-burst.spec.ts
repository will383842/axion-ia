import { describe, expect, it } from "vitest";
import {
  computeAntiBurstSchedule,
  computeCampaignTickBudget,
  msSinceStartOfDay,
} from "../anti-burst";

const HOUR = 3_600_000;
const DAY = 86_400_000;

/**
 * Régression 2026-08-15 — budget de tick par campagne.
 *
 * L'ancienne formule `max(1, ceil(dailyArticles / 96))` ignorait totalement ce
 * qui avait déjà été produit dans la journée. Son plancher à 1 faisait enfiler un
 * job à CHACUN des 96 ticks quotidiens : ~96 jobs/jour quelle que soit la cible.
 * Mesuré en production les 23 et 24 juillet : ~88 jobs/jour pour une campagne
 * réglée à 20, soit un crédit provider consommé près de cinq fois trop vite.
 */
describe("computeCampaignTickBudget", () => {
  it("n'enfile rien quand la cible du jour est déjà atteinte", () => {
    expect(
      computeCampaignTickBudget({
        dailyTarget: 20,
        createdToday: 20,
        msSinceStartOfDay: HOUR * 12,
        antiBurstEnabled: true,
      }),
    ).toBe(0);
  });

  it("n'enfile rien quand la production est en avance sur la courbe du jour", () => {
    // À la moitié de la journée, la courbe idéale vaut 10 sur une cible de 20.
    expect(
      computeCampaignTickBudget({
        dailyTarget: 20,
        createdToday: 10,
        msSinceStartOfDay: DAY / 2,
        antiBurstEnabled: true,
      }),
    ).toBe(0);
  });

  it("rattrape exactement le retard sur la courbe du jour", () => {
    expect(
      computeCampaignTickBudget({
        dailyTarget: 20,
        createdToday: 6,
        msSinceStartOfDay: DAY / 2,
        antiBurstEnabled: true,
      }),
    ).toBe(4);
  });

  it("ne dépasse jamais la cible du jour, même en fin de journée", () => {
    expect(
      computeCampaignTickBudget({
        dailyTarget: 20,
        createdToday: 0,
        msSinceStartOfDay: DAY,
        antiBurstEnabled: true,
      }),
    ).toBe(20);
  });

  it("le total d'une journée entière tient la cible (le bug des ~96/jour)", () => {
    // Simulation des 96 ticks : la somme doit valoir la cible, pas 96.
    let created = 0;
    for (let tick = 1; tick <= 96; tick++) {
      created += computeCampaignTickBudget({
        dailyTarget: 20,
        createdToday: created,
        msSinceStartOfDay: (DAY / 96) * tick,
        antiBurstEnabled: true,
      });
    }
    expect(created).toBe(20);
  });

  it("anti-burst désactivé : rattrape tout le reste d'un coup", () => {
    expect(
      computeCampaignTickBudget({
        dailyTarget: 20,
        createdToday: 5,
        msSinceStartOfDay: HOUR,
        antiBurstEnabled: false,
      }),
    ).toBe(15);
  });

  it("cible nulle ou négative : rien à enfiler", () => {
    expect(
      computeCampaignTickBudget({
        dailyTarget: 0,
        createdToday: 0,
        msSinceStartOfDay: HOUR,
        antiBurstEnabled: true,
      }),
    ).toBe(0);
  });
});

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
