import { describe, expect, it } from "vitest";

import { lireTendance } from "../tendance";

const e = (annee: number, chiffreAffairesEur: number | null) => ({ annee, chiffreAffairesEur });

describe("lireTendance", () => {
  it("croissance : au-dessus de +3 % par an", () => {
    const t = lireTendance([e(2018, 3_000_000), e(2020, 4_100_000)], 2020);
    expect(t.tendance).toBe("croissance");
    expect(t.tauxAnnuelMoyenPct).toBe(16.9);
  });

  it("décroissance : en dessous de −3 % par an", () => {
    const t = lireTendance([e(2021, 2_000_000), e(2023, 1_600_000)], 2024);
    expect(t.tendance).toBe("decroissance");
    expect(t.tauxAnnuelMoyenPct).toBeLessThan(-3);
  });

  it("stabilité : entre −3 % et +3 %", () => {
    expect(lireTendance([e(2021, 1_000_000), e(2023, 1_020_000)], 2024).tendance).toBe("stabilite");
  });

  it("indéterminée avec un seul exercice ou sans chiffre", () => {
    expect(lireTendance([e(2020, 4_100_000)], 2020).tendance).toBe("indeterminee");
    expect(lireTendance([e(2019, null), e(2020, null)], 2020).tendance).toBe("indeterminee");
    expect(lireTendance([], 2026).tauxAnnuelMoyenPct).toBeNull();
  });

  it("signale une donnée ancienne : la tendance décrit le passé", () => {
    const t = lireTendance([e(2019, 3_900_000), e(2020, 4_100_000)], 2026);
    expect(t.limites.join(" ")).toContain("2020");
    expect(t.limites.join(" ")).toContain("passé");
  });

  it("signale les exercices manquants entre deux années", () => {
    const t = lireTendance([e(2016, 3_000_000), e(2020, 4_100_000)], 2020);
    expect(t.limites.some((l) => l.includes("manquent"))).toBe(true);
  });

  it("ne calcule pas un taux à partir d'un chiffre nul", () => {
    expect(lireTendance([e(2019, 0), e(2020, 100)], 2020).tendance).toBe("indeterminee");
  });

  it("ignore l'ordre des exercices", () => {
    expect(lireTendance([e(2020, 4_100_000), e(2018, 3_000_000)], 2020).tendance).toBe(
      "croissance",
    );
  });
});
