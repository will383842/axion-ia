import { describe, it, expect } from "vitest";
import { buildCspHeader, isEmbedPath } from "../csp";

describe("isEmbedPath — route d'embed widget", () => {
  it("match /<locale>/carrieres/widget (avec ou sans slash)", () => {
    expect(isEmbedPath("/fr/carrieres/widget")).toBe(true);
    expect(isEmbedPath("/en/carrieres/widget")).toBe(true);
    expect(isEmbedPath("/fr/carrieres/widget/")).toBe(true);
  });

  it("NE match PAS widget-builder ni le hub", () => {
    expect(isEmbedPath("/fr/carrieres/widget-builder")).toBe(false);
    expect(isEmbedPath("/fr/carrieres")).toBe(false);
    expect(isEmbedPath("/fr/about")).toBe(false);
    expect(isEmbedPath("/carrieres/widget")).toBe(false); // sans préfixe locale
  });
});

describe("buildCspHeader — frame-ancestors selon embed", () => {
  const nonce = "test-nonce";

  it("frame-ancestors 'none' par défaut (anti-clickjacking)", () => {
    const csp = buildCspHeader({ nonce, strict: false });
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("frame-ancestors *");
  });

  it("frame-ancestors * sur la route d'embed", () => {
    const csp = buildCspHeader({ nonce, strict: false, embed: true });
    expect(csp).toContain("frame-ancestors *");
    expect(csp).not.toContain("frame-ancestors 'none'");
  });

  it("embed=true n'altère pas les autres directives sensibles", () => {
    const csp = buildCspHeader({ nonce, strict: false, embed: true });
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });
});
