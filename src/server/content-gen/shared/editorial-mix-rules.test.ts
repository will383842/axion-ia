// Tests règles distribution éditoriale (§ 25.3 — 2026-05-16).
// Pure module — pas de DB, pas de Prisma, pas de Server Action.
import { describe, it, expect } from "vitest";
import {
  assertEditorialKeys,
  assertSum100,
  BANNED_FROM_EDITORIAL_MIX,
  EDITORIAL_CONTENT_TYPES,
  SERVICE_SECTORS,
  SERVICE_SECTOR_LABELS,
} from "./editorial-mix-rules";

describe("editorial-mix-rules — constantes", () => {
  it("3 secteurs cabinet exactement (interventions_formations / audits / implementations)", () => {
    expect(SERVICE_SECTORS).toEqual(["interventions_formations", "audits", "implementations"]);
  });

  it("label fourni pour chaque secteur", () => {
    for (const s of SERVICE_SECTORS) {
      expect(SERVICE_SECTOR_LABELS[s]).toBeTruthy();
      expect(typeof SERVICE_SECTOR_LABELS[s]).toBe("string");
    }
  });

  it("landing_ville et blog_from_rss interdits dans mix éditorial", () => {
    expect(BANNED_FROM_EDITORIAL_MIX).toContain("landing_ville");
    expect(BANNED_FROM_EDITORIAL_MIX).toContain("blog_from_rss");
  });

  it("aucun type éditorial ne chevauche les types bannis", () => {
    const banned = new Set<string>(BANNED_FROM_EDITORIAL_MIX);
    for (const t of EDITORIAL_CONTENT_TYPES) {
      expect(banned.has(t)).toBe(false);
    }
  });
});

describe("assertEditorialKeys — interdire types pipelines indépendants", () => {
  it("passe sans erreur si seules les clés éditoriales sont présentes", () => {
    expect(() =>
      assertEditorialKeys(
        {
          blog_article: 50,
          guide_pilier: 30,
          comparison: 20,
        },
        "test",
      ),
    ).not.toThrow();
  });

  it("rejette landing_ville même mélangé avec des types valides", () => {
    expect(() =>
      assertEditorialKeys(
        {
          blog_article: 50,
          landing_ville: 50,
        },
        "distribution",
      ),
    ).toThrow(/banned_type:landing_ville/);
  });

  it("rejette blog_from_rss", () => {
    expect(() =>
      assertEditorialKeys(
        {
          blog_from_rss: 100,
        },
        "distribution",
      ),
    ).toThrow(/banned_type:blog_from_rss/);
  });

  it("message d'erreur inclut le label fourni (pour distinguer les call-sites)", () => {
    expect(() => assertEditorialKeys({ landing_ville: 100 }, "custom_label")).toThrow(
      /custom_label_banned_type/,
    );
  });
});

describe("assertSum100 — somme ratios = 100", () => {
  it("passe si somme = 100", () => {
    expect(() => assertSum100({ a: 50, b: 50 }, "x")).not.toThrow();
  });

  it("tolère ±0.5 (arithmétique flottante)", () => {
    expect(() => assertSum100({ a: 33.3, b: 33.3, c: 33.4 }, "x")).not.toThrow();
    expect(() => assertSum100({ a: 99.6 }, "x")).not.toThrow();
  });

  it("rejette somme = 99 (sous-100)", () => {
    expect(() => assertSum100({ a: 50, b: 49 }, "test")).toThrow(/test_sum_must_be_100/);
  });

  it("rejette somme = 101 (dépassement)", () => {
    expect(() => assertSum100({ a: 60, b: 41 }, "test")).toThrow(/test_sum_must_be_100/);
  });

  it("message inclut la valeur effective", () => {
    expect(() => assertSum100({ a: 50 }, "x")).toThrow(/50\.00/);
  });
});
