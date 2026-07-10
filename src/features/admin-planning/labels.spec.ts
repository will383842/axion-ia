/**
 * Tests — labels.ts (planning unifié). Tout est raisonné en Europe/Paris.
 */

import { describe, it, expect } from "vitest";
import { planningTimeLabel } from "./labels";

describe("planningTimeLabel", () => {
  it("créneau sur un même jour → plage horaire", () => {
    // 07:00Z → 09:00 Paris (été) ; 15:00Z → 17:00 Paris.
    expect(
      planningTimeLabel({
        debut: new Date("2026-07-09T07:00:00Z"),
        fin: new Date("2026-07-09T15:00:00Z"),
      }),
    ).toBe("09:00 – 17:00");
  });

  it("multi-jours → heure de début + nombre de jours", () => {
    expect(
      planningTimeLabel({
        debut: new Date("2026-02-18T08:00:00Z"),
        fin: new Date("2026-02-19T16:00:00Z"),
      }),
    ).toBe("09:00 · 2 jours");
  });

  it("sans fin → heure de début seule", () => {
    expect(planningTimeLabel({ debut: new Date("2026-07-09T07:30:00Z"), fin: null })).toBe("09:30");
  });

  it("séance legacy sans heure (minuit Paris) → journée entière", () => {
    // 2026-07-08T22:00Z = 2026-07-09T00:00 Paris.
    expect(planningTimeLabel({ debut: new Date("2026-07-08T22:00:00Z"), fin: null })).toBe(
      "journée entière",
    );
  });

  it("minuit Paris mais AVEC une fin → plage, pas « journée entière »", () => {
    expect(
      planningTimeLabel({
        debut: new Date("2026-07-08T22:00:00Z"),
        fin: new Date("2026-07-09T10:00:00Z"),
      }),
    ).toBe("00:00 – 12:00");
  });

  it("compte les jours d'une formation à cheval sur deux mois", () => {
    expect(
      planningTimeLabel({
        debut: new Date("2026-07-30T07:00:00Z"),
        fin: new Date("2026-08-01T15:00:00Z"),
      }),
    ).toBe("09:00 · 3 jours");
  });
});
