import { afterEach, describe, expect, it } from "vitest";
import { isQualiopiPublicDisclosureEnabled } from "./flag";

const ORIGINAL = process.env.OF_PUBLIC_DISCLOSURE_ENABLED;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.OF_PUBLIC_DISCLOSURE_ENABLED;
  else process.env.OF_PUBLIC_DISCLOSURE_ENABLED = ORIGINAL;
});

describe("isQualiopiPublicDisclosureEnabled", () => {
  it("est false par défaut (var absente) — Phase A sécurisée", () => {
    delete process.env.OF_PUBLIC_DISCLOSURE_ENABLED;
    expect(isQualiopiPublicDisclosureEnabled()).toBe(false);
  });

  it('est true uniquement pour la valeur exacte "true"', () => {
    process.env.OF_PUBLIC_DISCLOSURE_ENABLED = "true";
    expect(isQualiopiPublicDisclosureEnabled()).toBe(true);
  });

  it.each(["false", "1", "yes", "TRUE", "", "  true  "])(
    "reste false pour la valeur ambiguë %j",
    (val) => {
      process.env.OF_PUBLIC_DISCLOSURE_ENABLED = val;
      expect(isQualiopiPublicDisclosureEnabled()).toBe(false);
    },
  );
});
