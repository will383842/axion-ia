/** Tests — types.ts (planning unifié) : construction des liens de fiche. */

import { describe, it, expect } from "vitest";
import { planningDetailHref, PLANNING_STATUT_LABELS, PLANNING_TYPE_LABELS } from "./types";

describe("planningDetailHref", () => {
  it("pointe vers la fiche 360° d'une formation", () => {
    expect(planningDetailHref("adm-x", { type: "formation", id: "f1" })).toBe(
      "/fr/adm-x/planning/formation/f1",
    );
  });

  it("pointe vers la fiche 360° d'un coaching", () => {
    expect(planningDetailHref("adm-x", { type: "coaching", id: "c1" })).toBe(
      "/fr/adm-x/planning/coaching/c1",
    );
  });
});

describe("libellés", () => {
  it("couvre tous les statuts du planning", () => {
    expect(Object.keys(PLANNING_STATUT_LABELS).sort()).toEqual([
      "annulee",
      "en_cours",
      "planifiee",
      "realisee",
      "reportee",
    ]);
  });

  it("couvre les deux types de prestation", () => {
    expect(Object.keys(PLANNING_TYPE_LABELS).sort()).toEqual(["coaching", "formation"]);
  });
});
