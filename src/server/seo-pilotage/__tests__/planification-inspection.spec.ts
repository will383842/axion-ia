import { describe, expect, it } from "vitest";

import {
  PATTERN_SEO_INGESTION,
  PATTERN_SEO_INSPECTION,
  PATTERN_SEO_PURGE,
  PATTERN_SEO_RATTRAPAGE,
} from "../planification";

describe("cadence de l'inspection", () => {
  it("tous les jours à 07 h 00 (Paris), pas sur une minute prise par un autre robot", () => {
    expect(PATTERN_SEO_INSPECTION).toBe("0 7 * * *");
    expect(
      new Set([PATTERN_SEO_INGESTION, PATTERN_SEO_RATTRAPAGE, PATTERN_SEO_PURGE]).has(
        PATTERN_SEO_INSPECTION,
      ),
    ).toBe(false);
  });
});
