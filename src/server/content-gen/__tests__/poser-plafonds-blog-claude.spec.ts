import { describe, expect, it } from "vitest";
import {
  BORNE_JOUR_USD,
  BORNE_MOIS_USD,
  ErreurUsage,
  construirePlan,
  fusionnerExtraConfig,
  lireArguments,
} from "../../../../scripts/content-gen/poser-plafonds-blog-claude";

// Chiffres FICTIFS : aucun plafond réel dans le dépôt.
const ok = ["--jour", "1", "--mois", "10", "--reserve", "2", "--juge-max", "3"];

describe("poser-plafonds-blog-claude", () => {
  it("est à sec par défaut, réel seulement avec --reel", () => {
    expect(lireArguments(ok).reel).toBe(false);
    expect(lireArguments([...ok, "--reel"]).reel).toBe(true);
  });

  it("construit les 4 clés attendues", () => {
    expect(construirePlan(lireArguments(ok)).extraConfig).toEqual({
      blog_claude_daily_cap_usd: 1,
      blog_claude_monthly_cap_usd: 10,
      blog_claude_reserve_qualiopi_usd: 2,
      blog_claude_juge_max_jour: 3,
    });
  });

  it("accepte les bornes de garde exactes", () => {
    const p = construirePlan(
      lireArguments([
        "--jour",
        String(BORNE_JOUR_USD),
        "--mois",
        String(BORNE_MOIS_USD),
        "--reserve",
        "0",
        "--juge-max",
        "1",
      ]),
    );
    expect(p.extraConfig).not.toBeNull();
  });

  it.each([
    [["--jour", "21", "--mois", "100", "--reserve", "1", "--juge-max", "1"]],
    [["--jour", "5", "--mois", "301", "--reserve", "1", "--juge-max", "1"]],
    [["--jour", "0", "--mois", "100", "--reserve", "1", "--juge-max", "1"]],
    [["--jour", "50", "--mois", "40", "--reserve", "1", "--juge-max", "1"]],
    [["--jour", "5", "--mois", "4", "--reserve", "1", "--juge-max", "1"]],
    [["--jour", "5", "--mois", "40", "--reserve", "1", "--juge-max", "0"]],
    [["--jour", "5", "--mois", "40", "--reserve", "1", "--juge-max", "2.5"]],
  ])("refuse hors bornes : %j", (args) => {
    expect(() => construirePlan(lireArguments(args))).toThrow(ErreurUsage);
  });

  it.each(["abc", "-1", "1e3", "Infinity", "NaN", ""])("refuse la valeur %j", (v) => {
    expect(() => lireArguments(["--jour", v])).toThrow(ErreurUsage);
  });

  it("refuse les plafonds partiels, les arguments inconnus et l'absence d'action", () => {
    expect(() => construirePlan(lireArguments(["--jour", "1", "--mois", "10"]))).toThrow(
      ErreurUsage,
    );
    expect(() => lireArguments(["--force"])).toThrow(ErreurUsage);
    expect(() => construirePlan(lireArguments([]))).toThrow(ErreurUsage);
  });

  it("lever la suspension seule n'écrit aucun plafond", () => {
    expect(construirePlan(lireArguments(["--lever-suspension"]))).toEqual({
      extraConfig: null,
      leverSuspension: true,
    });
  });

  it("fusionne sans perdre les autres clés d'extraConfig", () => {
    expect(fusionnerExtraConfig({ autre: "x" }, { blog_claude_daily_cap_usd: 1 })).toEqual({
      autre: "x",
      blog_claude_daily_cap_usd: 1,
    });
    expect(fusionnerExtraConfig(null, { a: 1 })).toEqual({ a: 1 });
    expect(fusionnerExtraConfig([1], { a: 1 })).toEqual({ a: 1 });
  });
});
