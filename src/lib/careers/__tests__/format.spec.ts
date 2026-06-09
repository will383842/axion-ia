import { describe, it, expect } from "vitest";
import { isNew, workModeLabel, salaryLabel } from "../format";

describe("isNew", () => {
  it("true si < 14 jours, false sinon", () => {
    const now = new Date("2026-06-09T00:00:00.000Z").getTime();
    expect(isNew(new Date("2026-06-08T00:00:00.000Z"), now)).toBe(true);
    expect(isNew(new Date("2026-05-01T00:00:00.000Z"), now)).toBe(false);
  });
});

describe("workModeLabel", () => {
  it("traduit les modes connus", () => {
    expect(workModeLabel("remote", true)).toBe("Remote");
    expect(workModeLabel("on_site", true)).toBe("Sur site");
    expect(workModeLabel("hybrid", false)).toBe("Hybrid");
  });
  it("fallback sur la valeur brute si inconnu", () => {
    expect(workModeLabel("zzz", true)).toBe("zzz");
  });
});

describe("salaryLabel — directive UE 2023/970 (jamais de mention vague)", () => {
  const base = {
    isCommission: false,
    salaryVisible: true,
    salaryMin: 40000,
    salaryMax: 55000,
    salaryPeriod: "YEAR",
    salaryCurrency: "EUR",
  } as const;

  it("fourchette annuelle chiffrée", () => {
    expect(salaryLabel(base, true)).toBe("40k–55k EUR /an");
    expect(salaryLabel({ ...base }, false)).toBe("40k–55k EUR /yr");
  });

  it("commission déplafonnée traitée à part", () => {
    expect(salaryLabel({ ...base, isCommission: true }, true)).toBe("Commission déplafonnée");
  });

  it("null si masqué (jamais « selon profil »)", () => {
    expect(salaryLabel({ ...base, salaryVisible: false }, true)).toBeNull();
  });

  it("null si aucune borne", () => {
    expect(salaryLabel({ ...base, salaryMin: null, salaryMax: null }, true)).toBeNull();
  });

  it("borne unique si une seule valeur", () => {
    expect(salaryLabel({ ...base, salaryMax: null }, true)).toBe("40k EUR /an");
  });
});
