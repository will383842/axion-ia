import { describe, expect, it } from "vitest";

import { departementDeCommune, horsDepartement } from "../departement";

describe("departementDeCommune (L15b)", () => {
  it("métropole, Corse et outre-mer", () => {
    expect(departementDeCommune("17300")).toBe("17");
    expect(departementDeCommune("69123")).toBe("69");
    expect(departementDeCommune("2A004")).toBe("2A");
    expect(departementDeCommune("2b033")).toBe("2B");
    expect(departementDeCommune("97411")).toBe("974");
    expect(departementDeCommune("97101")).toBe("971");
  });

  it("refuse ce qui n'est pas un code INSEE", () => {
    for (const x of ["", null, undefined, "1730", "2C004", "20000x", "abcde"]) {
      expect(departementDeCommune(x)).toBeNull();
    }
  });

  it("hors département : Lyon → Grenoble oui ; même département non ; inconnu = null", () => {
    expect(horsDepartement("69123", "38185")).toBe(true);
    expect(horsDepartement("69123", "69266")).toBe(false);
    expect(horsDepartement("69123", null)).toBeNull();
  });
});
