// E2E flow — securite headers OWASP (Sprint 21 / M10).
// Verifie que les headers de securite sont bien envoyes par Next.

import { test, expect } from "@playwright/test";

test.describe("Security headers OWASP", () => {
  test("home returns all security headers", async ({ request }) => {
    const response = await request.get("/fr");
    const headers = response.headers();

    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["permissions-policy"]).toContain("microphone=()");
    expect(headers["strict-transport-security"]).toContain("max-age=63072000");
    expect(headers["strict-transport-security"]).toContain("includeSubDomains");
    expect(headers["strict-transport-security"]).toContain("preload");
    expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(headers["cross-origin-resource-policy"]).toBe("same-origin");
    // x-powered-by doit etre absent (poweredByHeader: false)
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("CSP active in production", async ({ request }) => {
    const response = await request.get("/fr");
    const headers = response.headers();
    if (process.env["NODE_ENV"] === "production") {
      expect(headers["content-security-policy"]).toBeDefined();
      expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    } else {
      // En dev, CSP est intentionnellement off (hot-reload Next)
      // On valide juste que les autres headers sont presents
      expect(headers["x-frame-options"]).toBe("DENY");
    }
  });

  test("admin route has same security headers", async ({ request }) => {
    const adminPrefix = process.env["ADMIN_URL_PREFIX"] ?? "admin-dev-x7k2n9";
    const response = await request.get(`/fr/${adminPrefix}/login`);
    const headers = response.headers();
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBeDefined();
  });
});
