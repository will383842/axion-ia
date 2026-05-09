import { describe, expect, it } from "vitest";
import { redactContactLine, redactEmail, redactName, redactPhone } from "./pii-redaction";

describe("redactEmail", () => {
  it("masks the local part keeping first letter and domain", () => {
    expect(redactEmail("john.doe@acme.com")).toBe("j****@acme.com");
  });
  it("handles single-letter local part", () => {
    expect(redactEmail("a@acme.com")).toBe("*@acme.com");
  });
  it("returns (?) for missing or invalid input", () => {
    expect(redactEmail(null)).toBe("(?)");
    expect(redactEmail("not-an-email")).toBe("(?)");
  });
});

describe("redactName", () => {
  it("collapses multi-word names to initials", () => {
    expect(redactName("John Doe")).toBe("J. D.");
    expect(redactName("Anne-Marie Dupont")).toBe("A. D.");
  });
  it("handles single name", () => {
    expect(redactName("Madonna")).toBe("M.");
  });
  it("returns (?) for missing input", () => {
    expect(redactName(null)).toBe("(?)");
    expect(redactName("")).toBe("(?)");
  });
});

describe("redactPhone", () => {
  it("preserves country prefix and last four digits", () => {
    expect(redactPhone("+33 6 12 34 56 78")).toContain("+33");
    expect(redactPhone("+33 6 12 34 56 78")).toContain("56 78");
  });
  it("returns (?) for missing input", () => {
    expect(redactPhone(null)).toBe("(?)");
  });
});

describe("redactContactLine", () => {
  it("composes name and email", () => {
    expect(redactContactLine("John Doe", "john.doe@acme.com")).toBe("J. D. (j****@acme.com)");
  });
});
