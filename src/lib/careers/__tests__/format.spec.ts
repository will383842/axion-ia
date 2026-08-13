import { describe, it, expect } from "vitest";
import {
  isNew,
  workModeLabel,
  salaryLabel,
  contractTypeLabel,
  normalizeApplicantCountries,
  applicantCountryLabel,
} from "../format";

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

describe("contractTypeLabel — jamais d'enum schema.org brut en façade", () => {
  it("traduit chaque type de contrat connu", () => {
    expect(contractTypeLabel({ contractLabel: null, employmentType: "CONTRACTOR" }, true)).toBe(
      "freelance (prestation indépendante)",
    );
    expect(contractTypeLabel({ contractLabel: null, employmentType: "INTERN" }, true)).toBe(
      "stage",
    );
    expect(contractTypeLabel({ contractLabel: null, employmentType: "PART_TIME" }, true)).toBe(
      "temps partiel",
    );
    expect(contractTypeLabel({ contractLabel: null, employmentType: "FULL_TIME" }, true)).toBe(
      "CDI temps plein",
    );
    expect(contractTypeLabel({ contractLabel: null, employmentType: "FULL_TIME" }, false)).toBe(
      "full-time permanent contract",
    );
  });

  it("affiche « X ou Y » quand un second type est déclaré (façade = JSON-LD)", () => {
    expect(
      contractTypeLabel(
        { contractLabel: null, employmentType: "FULL_TIME", secondaryEmploymentType: "CONTRACTOR" },
        true,
      ),
    ).toBe("CDI temps plein ou freelance (prestation indépendante)");
    expect(
      contractTypeLabel(
        { contractLabel: null, employmentType: "FULL_TIME", secondaryEmploymentType: "CONTRACTOR" },
        false,
      ),
    ).toBe("full-time permanent contract or freelance contract");
  });

  it("le libellé piloté en console prime sur l'enum", () => {
    expect(
      contractTypeLabel({ contractLabel: "Freelance", employmentType: "CONTRACTOR" }, true),
    ).toBe("Freelance");
  });

  it("type inconnu → null (on n'affiche RIEN plutôt que le code technique)", () => {
    expect(contractTypeLabel({ contractLabel: null, employmentType: "ZZZ" }, true)).toBeNull();
  });
});

describe("normalizeApplicantCountries", () => {
  it("majuscules, trim, dédup, ordre conservé", () => {
    expect(normalizeApplicantCountries([" fr ", "be", "FR", "ma"])).toEqual(["FR", "BE", "MA"]);
  });
  it("écarte ce qui n'est pas un code ISO2", () => {
    expect(normalizeApplicantCountries(["FR", "", "FRA", "X"])).toEqual(["FR"]);
  });
  it("null / vide → tableau vide", () => {
    expect(normalizeApplicantCountries(null)).toEqual([]);
    expect(normalizeApplicantCountries([])).toEqual([]);
  });
});

describe("applicantCountryLabel", () => {
  it("traduit les pays francophones", () => {
    expect(applicantCountryLabel("MA", true)).toBe("Maroc");
    expect(applicantCountryLabel("CI", true)).toBe("Côte d'Ivoire");
    expect(applicantCountryLabel("MA", false)).toBe("Morocco");
  });
  it("fallback sur le code si inconnu", () => {
    expect(applicantCountryLabel("ZZ", true)).toBe("ZZ");
  });
});
