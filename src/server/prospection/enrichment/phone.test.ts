import { describe, it, expect } from "vitest";
import { normalizePhoneFR, isValidPhoneFR, phoneVerifStatus } from "./phone";

describe("normalizePhoneFR → E.164", () => {
  it("formats variés → même clé", () => {
    expect(normalizePhoneFR("01 23 45 67 89")).toBe("+33123456789");
    expect(normalizePhoneFR("0123456789")).toBe("+33123456789");
    expect(normalizePhoneFR("+33 1 23 45 67 89")).toBe("+33123456789");
    expect(normalizePhoneFR("0033123456789")).toBe("+33123456789");
    expect(normalizePhoneFR("01.23.45.67.89")).toBe("+33123456789");
  });
  it("invalides → null", () => {
    expect(normalizePhoneFR("12345")).toBeNull();
    expect(normalizePhoneFR(null)).toBeNull();
    expect(normalizePhoneFR("00 00 00 00 00")).toBeNull(); // 1er chiffre 0 réservé
  });
});

describe("isValidPhoneFR — surtaxés exclus", () => {
  it("mobile/fixe OK", () => {
    expect(isValidPhoneFR("0612345678")).toBe(true);
    expect(isValidPhoneFR("0123456789")).toBe(true);
  });
  it("08xx surtaxé rejeté", () => {
    expect(isValidPhoneFR("0812345678")).toBe(false);
  });
});

describe("phoneVerifStatus", () => {
  it("e164_ok / invalide", () => {
    expect(phoneVerifStatus("0612345678")).toBe("e164_ok");
    expect(phoneVerifStatus("nope")).toBe("invalide");
  });
});
