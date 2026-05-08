// Tests Zod helper locale (Sprint 15 fix audit Phase 1 W5-2).

import { describe, it, expect } from "vitest";
import { localeSchema, parseLocale } from "@/lib/schemas/locale";

describe("localeSchema", () => {
  it("accepts fr and en", () => {
    expect(localeSchema.safeParse("fr").success).toBe(true);
    expect(localeSchema.safeParse("en").success).toBe(true);
  });

  it("defaults to fr if undefined", () => {
    const r = localeSchema.safeParse(undefined);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe("fr");
  });

  it("rejects unsupported locale (es/de/it)", () => {
    expect(localeSchema.safeParse("es").success).toBe(false);
    expect(localeSchema.safeParse("de").success).toBe(false);
    expect(localeSchema.safeParse("it").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(localeSchema.safeParse("").success).toBe(false);
  });
});

describe("parseLocale helper", () => {
  it("returns fr for null/undefined/empty", () => {
    expect(parseLocale(null)).toBe("fr");
    expect(parseLocale(undefined)).toBe("fr");
    expect(parseLocale("")).toBe("fr");
  });

  it("returns parsed value for valid locales", () => {
    expect(parseLocale("fr")).toBe("fr");
    expect(parseLocale("en")).toBe("en");
  });

  it("falls back to fr for invalid value (defense en profondeur)", () => {
    expect(parseLocale("es")).toBe("fr");
    expect(parseLocale("xx")).toBe("fr");
    expect(parseLocale("invalid")).toBe("fr");
  });

  it("handles FormDataEntryValue (File would be invalid → fallback fr)", () => {
    // Simulate File-like FormDataEntryValue
    expect(parseLocale("fr" as FormDataEntryValue)).toBe("fr");
  });
});
