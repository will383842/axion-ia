// City Domination 2026-05-18 P1-8 (audit A10) — tests requireSameOrigin
// helper defense-in-depth CSRF pour API routes custom.

import { describe, it, expect } from "vitest";
import { requireSameOrigin } from "../same-origin";
import type { NextRequest } from "next/server";

function mockReq(headers: Record<string, string>, url = "https://axion-ia.com/api/x"): NextRequest {
  const h = new Headers(headers);
  return {
    headers: h,
    url,
  } as unknown as NextRequest;
}

describe("requireSameOrigin", () => {
  it("autorise même origin via header Origin", () => {
    const req = mockReq({ origin: "https://axion-ia.com", host: "axion-ia.com" });
    expect(() => requireSameOrigin(req)).not.toThrow();
  });

  it("autorise www same site", () => {
    const req = mockReq({ origin: "https://www.axion-ia.com", host: "axion-ia.com" });
    expect(() => requireSameOrigin(req)).not.toThrow();
  });

  it("refuse cross-origin (attacker.com)", () => {
    const req = mockReq({ origin: "https://attacker.com", host: "axion-ia.com" });
    expect(() => requireSameOrigin(req)).toThrow("cross_origin_forbidden");
  });

  it("fallback Referer si Origin absent", () => {
    const req = mockReq({ referer: "https://axion-ia.com/admin", host: "axion-ia.com" });
    expect(() => requireSameOrigin(req)).not.toThrow();
  });

  it("refuse cross-origin via Referer", () => {
    const req = mockReq({ referer: "https://malicious.example/page", host: "axion-ia.com" });
    expect(() => requireSameOrigin(req)).toThrow("cross_origin_forbidden");
  });

  it("tolère Origin + Referer absents par défaut (allowMissingOrigin=true)", () => {
    const req = mockReq({ host: "axion-ia.com" });
    expect(() => requireSameOrigin(req)).not.toThrow();
  });

  it("refuse Origin + Referer absents si allowMissingOrigin=false", () => {
    const req = mockReq({ host: "axion-ia.com" });
    expect(() => requireSameOrigin(req, { allowMissingOrigin: false })).toThrow(
      "cross_origin_forbidden",
    );
  });

  it("respecte x-forwarded-host (Caddy + Cloudflare)", () => {
    const req = mockReq({
      origin: "https://axion-ia.com",
      "x-forwarded-host": "axion-ia.com",
      "x-forwarded-proto": "https",
      host: "10.0.0.1", // origin interne Hetzner
    });
    expect(() => requireSameOrigin(req)).not.toThrow();
  });

  it("accepte extraTrustedOrigins pour preview deployments", () => {
    const req = mockReq({ origin: "https://preview-branch.coolify.test" });
    expect(() =>
      requireSameOrigin(req, { extraTrustedOrigins: ["https://preview-branch.coolify.test"] }),
    ).not.toThrow();
  });
});
