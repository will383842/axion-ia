// Tests Zod schemas auth (Sprint 15 step 2 / fix audit Phase 1).

import { describe, it, expect } from "vitest";
import { signInSchema, setup2FASchema, disable2FASchema } from "@/lib/schemas/auth";

describe("signInSchema", () => {
  const valid = {
    email: "admin@axion-ia.com",
    password: "AdminAxion2026!",
    totp: "123456",
  };

  it("accepts a valid login with totp", () => {
    expect(signInSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts login without totp (will be required server-side)", () => {
    const { totp: _omit, ...withoutTotp } = valid;
    expect(signInSchema.safeParse(withoutTotp).success).toBe(true);
  });

  it("rejects invalid email format", () => {
    expect(signInSchema.safeParse({ ...valid, email: "broken" }).success).toBe(false);
  });

  it("rejects password under 8 chars", () => {
    expect(signInSchema.safeParse({ ...valid, password: "short" }).success).toBe(false);
  });

  it("rejects totp not exactly 6 digits", () => {
    expect(signInSchema.safeParse({ ...valid, totp: "12345" }).success).toBe(false);
    expect(signInSchema.safeParse({ ...valid, totp: "1234567" }).success).toBe(false);
    expect(signInSchema.safeParse({ ...valid, totp: "12a456" }).success).toBe(false);
  });
});

describe("setup2FASchema", () => {
  it("accepts a 6-digit TOTP code", () => {
    expect(setup2FASchema.safeParse({ code: "654321" }).success).toBe(true);
  });

  it("rejects non-numeric code", () => {
    expect(setup2FASchema.safeParse({ code: "abcdef" }).success).toBe(false);
  });

  it("rejects wrong length", () => {
    expect(setup2FASchema.safeParse({ code: "12345" }).success).toBe(false);
    expect(setup2FASchema.safeParse({ code: "1234567" }).success).toBe(false);
  });
});

describe("disable2FASchema", () => {
  const valid = { password: "MyPassword123", code: "123456" };

  it("accepts password + 6-digit code", () => {
    expect(disable2FASchema.safeParse(valid).success).toBe(true);
  });

  it("rejects password under 8 chars", () => {
    expect(disable2FASchema.safeParse({ ...valid, password: "short" }).success).toBe(false);
  });

  it("rejects malformed code", () => {
    expect(disable2FASchema.safeParse({ ...valid, code: "12345x" }).success).toBe(false);
  });
});
