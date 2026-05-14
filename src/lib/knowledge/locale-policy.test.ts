/**
 * KB V4 — Tests politique locale FR-only.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  filterTranslationsByPolicy,
  getActiveLocales,
  getKbLocalePolicy,
  isLocaleActive,
} from "./locale-policy";

describe("KB V4 locale policy", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.KB_LOCALE;
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.KB_LOCALE;
    else process.env.KB_LOCALE = originalEnv;
  });

  it("default = fr_only (sans env)", () => {
    delete process.env.KB_LOCALE;
    expect(getKbLocalePolicy()).toBe("fr_only");
  });

  it("KB_LOCALE=fr_en active EN", () => {
    process.env.KB_LOCALE = "fr_en";
    expect(getKbLocalePolicy()).toBe("fr_en");
  });

  it("KB_LOCALE=foo fallback fr_only", () => {
    process.env.KB_LOCALE = "foo";
    expect(getKbLocalePolicy()).toBe("fr_only");
  });

  it("getActiveLocales fr_only → ['fr']", () => {
    delete process.env.KB_LOCALE;
    expect(getActiveLocales()).toEqual(["fr"]);
  });

  it("getActiveLocales fr_en → ['fr', 'en']", () => {
    process.env.KB_LOCALE = "fr_en";
    expect(getActiveLocales()).toEqual(["fr", "en"]);
  });

  it("isLocaleActive en V1 fr_only refuse EN", () => {
    delete process.env.KB_LOCALE;
    expect(isLocaleActive("fr")).toBe(true);
    expect(isLocaleActive("en")).toBe(false);
  });

  it("filterTranslationsByPolicy garde FR uniquement en V1", () => {
    delete process.env.KB_LOCALE;
    const r = filterTranslationsByPolicy([
      { locale: "fr" as const, title: "FR" },
      { locale: "en" as const, title: "EN" },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]!.title).toBe("FR");
  });

  it("filterTranslationsByPolicy garde les 2 en fr_en", () => {
    process.env.KB_LOCALE = "fr_en";
    const r = filterTranslationsByPolicy([
      { locale: "fr" as const, title: "FR" },
      { locale: "en" as const, title: "EN" },
    ]);
    expect(r).toHaveLength(2);
  });
});
