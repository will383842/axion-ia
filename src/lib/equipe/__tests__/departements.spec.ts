import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NOMS_DEPARTEMENTS, localiserDansDepartement, nomDepartement } from "../departements";
import { phraseLieu } from "../presence";

describe("noms des départements", () => {
  it("couvre exactement les 101 codes des chefs-lieux (outre-mer compris)", () => {
    expect(Object.keys(NOMS_DEPARTEMENTS)).toHaveLength(101);
    const geo = readFileSync(join(__dirname, "../geo.ts"), "utf8");
    const bloc = /const CHEFS_LIEUX[^=]*=\s*\{([\s\S]*?)\n\};/.exec(geo)?.[1] ?? "";
    const codes = [...bloc.matchAll(/"(\w+)":/g)].map((m) => m[1]);
    expect(codes).toHaveLength(101);
    expect(Object.keys(NOMS_DEPARTEMENTS).sort()).toEqual([...codes].sort());
  });

  it("donne le nom, avec son article", () => {
    expect(nomDepartement("38")).toBe("l'Isère");
    expect(nomDepartement("2a")).toBe("la Corse-du-Sud");
    expect(nomDepartement("974")).toBe("La Réunion");
    expect(nomDepartement("9")).toBe("l'Ariège");
  });

  it("ne devine jamais un code inconnu", () => {
    expect(nomDepartement("99")).toBeNull();
    expect(nomDepartement("")).toBeNull();
    expect(nomDepartement(undefined)).toBeNull();
    expect(localiserDansDepartement("20")).toBeNull();
  });

  it("construit la locution de lieu", () => {
    expect(localiserDansDepartement("38")).toBe("dans l'Isère");
    expect(localiserDansDepartement("73")).toBe("dans la Savoie");
    expect(localiserDansDepartement("40")).toBe("dans les Landes");
    expect(localiserDansDepartement("59")).toBe("dans le Nord");
    expect(localiserDansDepartement("75")).toBe("à Paris");
    expect(localiserDansDepartement("973")).toBe("en Guyane");
  });

  it("la phrase de lieu écrit le nom du département, jamais son numéro", () => {
    const p = phraseLieu("Léa", { departement: "38" });
    expect(p).toBe("Léa travaille dans l'Isère et intervient partout en France.");
    expect(p).not.toMatch(/\d/);
    expect(phraseLieu("Léa", { departement: "99" })).toBeNull();
    expect(phraseLieu("Léa", { ville: "Lyon", departement: "69" })).toContain("Lyon");
  });
});
