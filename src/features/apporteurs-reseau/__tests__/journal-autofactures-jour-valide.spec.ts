import { describe, expect, it } from "vitest";

import { jourValide } from "../journal-autofactures-types";

describe("jourValide", () => {
  it("accepte de vrais jours", () => {
    expect(jourValide("2026-11-30")).toBe(true);
    expect(jourValide("2028-02-29")).toBe(true);
  });
  it("refuse la mauvaise forme et les jours inexistants", () => {
    for (const s of ["hier", "2026-13-01", "2026-02-30", "2027-02-29", "2026-00-10", ""])
      expect(jourValide(s), s).toBe(false);
  });
});
