// « Nouvel apporteur » : un numéro se retrouve quel que soit son format (relecture de a1, 08/10).
import { describe, expect, it } from "vitest";

import { chiffresTelephone } from "../telephone";

describe("chiffresTelephone", () => {
  it.each([
    ["06 12 34 56 78", "0612345678"],
    ["06.12.34.56.78", "0612345678"],
    ["+33 6 12 34 56 78", "0612345678"],
    ["+33612345678", "0612345678"],
    ["0033 6 12 34 56 78", "0612345678"],
    ["33612345678", "0612345678"],
    ["+33 6 12", "0612"],
  ])("%s → %s", (brut, attendu) => {
    expect(chiffresTelephone(brut)).toBe(attendu);
  });

  it("un numéro saisi en partie se retrouve dans un numéro stocké en international", () => {
    expect(chiffresTelephone("+33 6 12 34 56 78").includes(chiffresTelephone("06 12 34"))).toBe(
      true,
    );
  });
});
