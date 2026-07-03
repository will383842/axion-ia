import { describe, it, expect } from "vitest";
import {
  computeLeadScore,
  deriveContactabilite,
  DEFAULT_SCORING_WEIGHTS,
  type LeadSignals,
} from "./scoring";

const ALL_TRUE: LeadSignals = {
  hasEmailVerified: true,
  hasEmail: true,
  hasPhoneValid: true,
  hasNominativeContact: true,
  hasDirigeant: true,
  isFresh: true,
  isOfficialSource: true,
  matchesTarget: true,
  etablissementActif: true,
};

const ALL_FALSE: LeadSignals = {
  hasEmailVerified: false,
  hasEmail: false,
  hasPhoneValid: false,
  hasNominativeContact: false,
  hasDirigeant: false,
  isFresh: false,
  isOfficialSource: false,
  matchesTarget: false,
  etablissementActif: false,
};

describe("computeLeadScore", () => {
  it("tous signaux ON = 100 (max)", () => {
    expect(computeLeadScore(ALL_TRUE)).toBe(100);
  });
  it("aucun signal = 0", () => {
    expect(computeLeadScore(ALL_FALSE)).toBe(0);
  });
  it("email vérifié > email non vérifié (composante exclusive)", () => {
    const verified = computeLeadScore({ ...ALL_FALSE, hasEmail: true, hasEmailVerified: true });
    const unverified = computeLeadScore({ ...ALL_FALSE, hasEmail: true, hasEmailVerified: false });
    expect(verified).toBe(DEFAULT_SCORING_WEIGHTS.emailVerified);
    expect(unverified).toBe(DEFAULT_SCORING_WEIGHTS.emailUnverified);
    expect(verified).toBeGreaterThan(unverified);
  });
  it("poids surchargeables", () => {
    const w = { ...DEFAULT_SCORING_WEIGHTS, phoneValid: 0 };
    expect(computeLeadScore({ ...ALL_FALSE, hasPhoneValid: true }, w)).toBe(0);
  });
  it("borné 0-100 même avec des poids surdimensionnés", () => {
    const w = { ...DEFAULT_SCORING_WEIGHTS, emailVerified: 9999 };
    expect(computeLeadScore(ALL_TRUE, w)).toBe(100);
  });
});

describe("deriveContactabilite — 07-DECISIONS Q2", () => {
  it("email MX-OK = exploitable (tel non requis)", () => {
    expect(
      deriveContactabilite({
        hasEmailVerified: true,
        hasEmail: true,
        hasPhoneValid: false,
        hasNominativeVerifiedEmail: false,
      }),
    ).toEqual({ contactabilite: "exploitable", nuance: "exploitable_generique" });
  });
  it("email nominatif vérifié = exploitable_nominatif", () => {
    expect(
      deriveContactabilite({
        hasEmailVerified: true,
        hasEmail: true,
        hasPhoneValid: true,
        hasNominativeVerifiedEmail: true,
      }).nuance,
    ).toBe("exploitable_nominatif");
  });
  it("email non vérifié seul = partiel", () => {
    expect(
      deriveContactabilite({
        hasEmailVerified: false,
        hasEmail: true,
        hasPhoneValid: false,
        hasNominativeVerifiedEmail: false,
      }).contactabilite,
    ).toBe("partiel");
  });
  it("téléphone seul = partiel", () => {
    expect(
      deriveContactabilite({
        hasEmailVerified: false,
        hasEmail: false,
        hasPhoneValid: true,
        hasNominativeVerifiedEmail: false,
      }).contactabilite,
    ).toBe("partiel");
  });
  it("rien = non_contactable", () => {
    expect(
      deriveContactabilite({
        hasEmailVerified: false,
        hasEmail: false,
        hasPhoneValid: false,
        hasNominativeVerifiedEmail: false,
      }).contactabilite,
    ).toBe("non_contactable");
  });
});
