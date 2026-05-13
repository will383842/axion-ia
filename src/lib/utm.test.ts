// Tests UTM helpers — Sprint X.18.

import { describe, it, expect } from "vitest";
import {
  parseUtmFromUrl,
  serializeUtmCookie,
  deserializeUtmCookie,
  buildUtmSetCookie,
  readUtmCookie,
  UTM_COOKIE_NAME,
} from "./utm";

describe("parseUtmFromUrl", () => {
  it("extrait 5 keys UTM standard", () => {
    const u = new URL(
      "https://axion-ia.com/fr?utm_source=google&utm_medium=cpc&utm_campaign=brand&utm_term=ia&utm_content=banner",
    );
    const utm = parseUtmFromUrl(u);
    expect(utm).toEqual({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "brand",
      utm_term: "ia",
      utm_content: "banner",
    });
  });

  it("retourne {} si aucun UTM", () => {
    const u = new URL("https://axion-ia.com/fr?foo=bar");
    expect(parseUtmFromUrl(u)).toEqual({});
  });

  it("sanitize les caractères injection (< > supprimés)", () => {
    const params = new URLSearchParams("utm_source=goog<script>le");
    const utm = parseUtmFromUrl(params);
    // `goog` + `script` + `le` après remove `<` et `>`
    expect(utm.utm_source).toBe("googscriptle");
  });

  it("rejette valeurs > 200 chars", () => {
    const long = "a".repeat(201);
    const params = new URLSearchParams(`utm_source=${long}`);
    const utm = parseUtmFromUrl(params);
    expect(utm.utm_source).toBeUndefined();
  });

  it("accepte URLSearchParams directement", () => {
    const params = new URLSearchParams("utm_source=meta&utm_medium=social");
    const utm = parseUtmFromUrl(params);
    expect(utm).toEqual({ utm_source: "meta", utm_medium: "social" });
  });
});

describe("serialize/deserialize round-trip", () => {
  it("preserve les params", () => {
    const orig = {
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "spring-2026",
    };
    const cookie = serializeUtmCookie(orig);
    expect(cookie).toMatch(/^[A-Za-z0-9_-]+$/); // base64url
    const back = deserializeUtmCookie(cookie);
    expect(back).toEqual(orig);
  });

  it("retourne {} si cookie corrompu", () => {
    expect(deserializeUtmCookie("not-a-valid-base64-!!!")).toEqual({});
    expect(deserializeUtmCookie("")).toEqual({});
  });
});

describe("buildUtmSetCookie", () => {
  it("contient nom + value + attributes sécurité", () => {
    const header = buildUtmSetCookie({ utm_source: "google" });
    expect(header).toContain(`${UTM_COOKIE_NAME}=`);
    expect(header).toContain("Max-Age=2592000"); // 30 jours
    expect(header).toContain("Path=/");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Secure");
    expect(header).toContain("HttpOnly");
  });
});

describe("readUtmCookie", () => {
  it("undefined → {}", () => {
    expect(readUtmCookie(undefined)).toEqual({});
  });

  it("valid cookie value → UtmParams", () => {
    const value = serializeUtmCookie({ utm_source: "linkedin" });
    expect(readUtmCookie(value)).toEqual({ utm_source: "linkedin" });
  });
});
