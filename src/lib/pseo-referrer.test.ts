// Tests pseo-referrer — Sprint X.18 wiring.

import { describe, it, expect } from "vitest";
import {
  buildPseoReferrerCookies,
  sanitizeSlugValue,
  readPseoReferrer,
  REFERRER_CITY_COOKIE_NAME,
  REFERRER_REGION_COOKIE_NAME,
  REFERRER_PHASE_COOKIE_NAME,
} from "./pseo-referrer";

describe("sanitizeSlugValue", () => {
  it("conserve slug kebab-case clean", () => {
    expect(sanitizeSlugValue("lyon")).toBe("lyon");
    expect(sanitizeSlugValue("clermont-ferrand")).toBe("clermont-ferrand");
    expect(sanitizeSlugValue("auvergne-rhone-alpes")).toBe("auvergne-rhone-alpes");
  });

  it("lowercase + remove special chars", () => {
    expect(sanitizeSlugValue("Paris")).toBe("paris");
    expect(sanitizeSlugValue("Lyon_2!")).toBe("lyon2");
    expect(sanitizeSlugValue("city<script>")).toBe("cityscript");
  });

  it("undefined / null / empty → undefined", () => {
    expect(sanitizeSlugValue(undefined)).toBeUndefined();
    expect(sanitizeSlugValue(null)).toBeUndefined();
    expect(sanitizeSlugValue("")).toBeUndefined();
    expect(sanitizeSlugValue("!!!")).toBeUndefined(); // après strip = ""
  });

  it("decode URI puis sanitize", () => {
    expect(sanitizeSlugValue("clermont%2Dferrand")).toBe("clermont-ferrand");
  });

  it("rejette > 120 chars", () => {
    expect(sanitizeSlugValue("a".repeat(121))).toBeUndefined();
  });
});

describe("buildPseoReferrerCookies", () => {
  it("0 valeurs → array vide", () => {
    expect(buildPseoReferrerCookies({})).toEqual([]);
  });

  it("city seul → 1 cookie", () => {
    const cookies = buildPseoReferrerCookies({ city: "lyon" });
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toContain(REFERRER_CITY_COOKIE_NAME);
    expect(cookies[0]).toContain("lyon");
    expect(cookies[0]).toContain("Max-Age=2592000"); // 30j
    expect(cookies[0]).toContain("SameSite=Lax");
    expect(cookies[0]).toContain("Secure");
    expect(cookies[0]).toContain("HttpOnly");
  });

  it("city + region + phase → 3 cookies", () => {
    const cookies = buildPseoReferrerCookies({
      city: "lyon",
      region: "auvergne-rhone-alpes",
      phase: "paris-pilote",
    });
    expect(cookies).toHaveLength(3);
    expect(cookies.some((c) => c.includes(REFERRER_CITY_COOKIE_NAME))).toBe(true);
    expect(cookies.some((c) => c.includes(REFERRER_REGION_COOKIE_NAME))).toBe(true);
    expect(cookies.some((c) => c.includes(REFERRER_PHASE_COOKIE_NAME))).toBe(true);
  });

  it("encode URI components dans value", () => {
    const cookies = buildPseoReferrerCookies({ city: "saint-étienne" });
    expect(cookies[0]).toContain("saint-%C3%A9tienne");
  });
});

describe("readPseoReferrer", () => {
  it("3 cookies fournis → PseoReferrer complet", () => {
    const ref = readPseoReferrer({
      city: "lyon",
      region: "auvergne-rhone-alpes",
      phase: "paris-pilote",
    });
    expect(ref).toEqual({
      city: "lyon",
      region: "auvergne-rhone-alpes",
      phase: "paris-pilote",
    });
  });

  it("filtre cookies undefined / invalid", () => {
    const ref = readPseoReferrer({
      city: "lyon",
      region: undefined,
      phase: "!!!",
    });
    expect(ref).toEqual({ city: "lyon" });
  });

  it("sanitize avant retour", () => {
    const ref = readPseoReferrer({
      city: "LYON_2",
      region: undefined,
      phase: undefined,
    });
    expect(ref.city).toBe("lyon2");
  });
});
