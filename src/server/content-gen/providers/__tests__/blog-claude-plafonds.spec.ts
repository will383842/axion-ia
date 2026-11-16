/** Module commun des plafonds du blog. Chiffres FICTIFS ; seules les bornes de garde sont réelles. */
import { describe, it, expect } from "vitest";

import {
  BORNE_JOUR_USD,
  BORNE_JUGE_MAX_JOUR,
  BORNE_MOIS_USD,
  ErreurPlafondsBlog,
  LIBELLES_ECRAN,
  LIBELLES_SCRIPT,
  fusionnerExtraConfig,
  lireNombreStrict,
  lirePlafondsBlogExistants,
  validerPlafondsBlog,
} from "../blog-claude-plafonds";
import { BORNE_DURE_JOUR_USD, BORNE_DURE_MOIS_USD } from "../blog-claude-ledger";

const base = { jour: 1, mois: 10, reserve: 2, jugeMax: 3 };

describe("lireNombreStrict", () => {
  it("accepte des décimaux simples", () => {
    expect(lireNombreStrict("1.5", "x")).toBe(1.5);
    expect(lireNombreStrict("3", "x")).toBe(3);
  });
  it.each(["abc", "-1", "1e3", "Infinity", "NaN", "", " ", "1.234", "0x10", undefined])(
    "refuse %j",
    (v) => {
      expect(() => lireNombreStrict(v as string | undefined, "x")).toThrow(ErreurPlafondsBlog);
    },
  );
});

describe("validerPlafondsBlog", () => {
  it("rend les 4 clés", () => {
    expect(validerPlafondsBlog(base)).toEqual({
      blog_claude_daily_cap_usd: 1,
      blog_claude_monthly_cap_usd: 10,
      blog_claude_reserve_qualiopi_usd: 2,
      blog_claude_juge_max_jour: 3,
    });
  });
  it("accepte les bornes exactes", () => {
    expect(() =>
      validerPlafondsBlog({
        jour: BORNE_JOUR_USD,
        mois: BORNE_MOIS_USD,
        reserve: 0,
        jugeMax: 1,
      }),
    ).not.toThrow();
    expect(() => validerPlafondsBlog({ ...base, jugeMax: BORNE_JUGE_MAX_JOUR })).not.toThrow();
  });
  it.each([
    ["jour", NaN],
    ["jour", Infinity],
    ["jour", -Infinity],
    ["mois", NaN],
    ["mois", Infinity],
    ["mois", -Infinity],
    ["reserve", NaN],
    ["reserve", Infinity],
    ["reserve", -Infinity],
    ["jugeMax", NaN],
    ["jugeMax", Infinity],
    ["jugeMax", -Infinity],
  ])("refuse %s = %s", (champ, valeur) => {
    expect(() => validerPlafondsBlog({ ...base, [champ]: valeur })).toThrow(ErreurPlafondsBlog);
  });
  it.each([
    [{ jour: 0 }],
    [{ jour: 21 }],
    [{ jour: -1 }],
    [{ mois: 0 }],
    [{ mois: 301 }],
    [{ jour: 9, mois: 7 }],
    [{ reserve: -0.01 }],
    [{ jugeMax: 0 }],
    [{ jugeMax: 3.5 }],
    [{ jugeMax: 501 }],
  ])("refuse %j", (patch) => {
    expect(() => validerPlafondsBlog({ ...base, ...patch })).toThrow(ErreurPlafondsBlog);
  });
  it("messages exacts, libellés du script", () => {
    const m = (p: object) => {
      try {
        validerPlafondsBlog({ ...base, ...p }, LIBELLES_SCRIPT);
      } catch (e) {
        return (e as Error).message;
      }
      return "";
    };
    expect(m({ jour: 21 })).toBe("--jour hors bornes de garde (0 < jour ≤ 20)");
    expect(m({ mois: 301 })).toBe("--mois hors bornes de garde (0 < mois ≤ 300)");
    expect(m({ jour: 9, mois: 7 })).toBe("--jour ne peut pas dépasser --mois");
    expect(m({ reserve: -1 })).toBe("--reserve doit être ≥ 0");
    expect(m({ jugeMax: 0 })).toBe("--juge-max : entier entre 1 et 500");
  });
  it("messages exacts, libellés de l'écran", () => {
    const m = (p: object) => {
      try {
        validerPlafondsBlog({ ...base, ...p }, LIBELLES_ECRAN);
      } catch (e) {
        return (e as Error).message;
      }
      return "";
    };
    expect(m({ jour: 21 })).toBe("Plafond du jour hors bornes de garde (0 < jour ≤ 20)");
    expect(m({ jour: 9, mois: 7 })).toBe(
      "Plafond du jour ne peut pas dépasser Plafond mensuel du blog",
    );
    expect(m({ reserve: -1 })).toBe("Réserve Qualiopi doit être ≥ 0");
    expect(m({ jugeMax: 0 })).toBe("Relectures max par jour : entier entre 1 et 500");
  });
});

describe("fusionnerExtraConfig", () => {
  it("garde les autres clés", () => {
    expect(fusionnerExtraConfig({ autre: 1, disabled_by_cost_cap: true, a: 0 }, { a: 5 })).toEqual({
      autre: 1,
      disabled_by_cost_cap: true,
      a: 5,
    });
  });
  it.each([null, [1], "texte"])("%j → base vide", (v) => {
    expect(fusionnerExtraConfig(v, { a: 1 })).toEqual({ a: 1 });
  });
});

describe("lirePlafondsBlogExistants", () => {
  it("lit les nombres finis, sinon null", () => {
    expect(
      lirePlafondsBlogExistants({
        blog_claude_daily_cap_usd: 1,
        blog_claude_monthly_cap_usd: "10",
        blog_claude_reserve_qualiopi_usd: NaN,
      }),
    ).toEqual({ jour: 1, mois: null, reserve: null, jugeMax: null });
    expect(lirePlafondsBlogExistants(null).jour).toBeNull();
  });
});

describe("cohérence avec le registre", () => {
  it("mêmes bornes que le registre de coût", () => {
    expect(BORNE_JOUR_USD).toBe(BORNE_DURE_JOUR_USD);
    expect(BORNE_MOIS_USD).toBe(BORNE_DURE_MOIS_USD);
  });
});
