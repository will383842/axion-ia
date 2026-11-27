import { describe, it, expect } from "vitest";
import {
  codeValide,
  empreinteDuCode,
  formaterCode,
  genererCode,
  normaliserCode,
} from "../code-retrait";
import { pourcentageInferieur } from "../comparaison";

describe("code de retrait", () => {
  it("80 bits : 16 caractères de l'alphabet Crockford, jamais deux fois le même", () => {
    const a = genererCode();
    const b = genererCode();
    expect(a).toHaveLength(16);
    expect(codeValide(a)).toBe(true);
    expect(a).not.toBe(b);
  });

  it("s'affiche en 4 groupes de 4 (espaces insécables) et se saisit sans y penser", () => {
    const code = "ABCD0123EFGH4567";
    const affiche = formaterCode(code);
    expect(affiche.split(" ")).toEqual(["ABCD", "0123", "EFGH", "4567"]);
    expect(normaliserCode(affiche.toLowerCase())).toBe(code);
    expect(normaliserCode("abcd-oi23 efgh-4567")).toBe("ABCD0123EFGH4567");
  });

  it("l'empreinte est un SHA-256 hexadécimal de 64 caractères, identique quelle que soit la saisie", async () => {
    const e1 = await empreinteDuCode("ABCD0123EFGH4567");
    const e2 = await empreinteDuCode("abcd 0123 efgh 4567");
    expect(e1).toMatch(/^[0-9a-f]{64}$/);
    expect(e2).toBe(e1);
    expect(e1).not.toContain("ABCD");
  });
});

describe("comparaison", () => {
  const seg = { n: 40, pctParTranche: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10] };

  it("somme des tranches inférieures + moitié de la tranche, arrondie à 5 près", () => {
    expect(pourcentageInferieur(seg, 0)).toBe(5);
    expect(pourcentageInferieur(seg, 55)).toBe(55);
    expect(pourcentageInferieur(seg, 100)).toBe(95);
  });
});
