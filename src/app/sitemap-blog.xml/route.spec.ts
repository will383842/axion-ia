/**
 * Tests de la route `sitemap-blog.xml` : 503 plutôt qu'un plan vide en 200
 * (lot 9 de l'audit blog du 24/10/2026).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { sitemapMock } = vi.hoisted(() => ({ sitemapMock: vi.fn() }));

vi.mock("@/app/sitemap", () => ({
  default: (props: unknown) => sitemapMock(props),
}));

import { GET } from "./route";
import { SitemapDbIndisponibleError } from "@/lib/seo/sitemap-erreur";

beforeEach(() => {
  sitemapMock.mockReset();
});

describe("sitemap-blog.xml · base injoignable", () => {
  it("répond 503 + Retry-After + no-store, sans <url>", async () => {
    sitemapMock.mockRejectedValue(new SitemapDbIndisponibleError("blog"));
    const res = await GET();
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("300");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.text()).not.toContain("<url>");
  });

  it("demande le builder en mode strict", async () => {
    sitemapMock.mockResolvedValue([]);
    await GET();
    expect(sitemapMock.mock.calls[0]?.[0]).toMatchObject({ strict: true });
  });

  it("laisse remonter une autre erreur (pas de 503 déguisé)", async () => {
    sitemapMock.mockRejectedValue(new Error("bug"));
    await expect(GET()).rejects.toThrow("bug");
  });
});

describe("sitemap-blog.xml · cas nominal", () => {
  it("répond 200 avec les URL du builder", async () => {
    sitemapMock.mockResolvedValue([
      {
        url: "https://axion-ia.com/fr/blog/exemple",
        lastModified: new Date("2026-10-01T00:00:00Z"),
        changeFrequency: "monthly",
        priority: 0.5,
      },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<loc>https://axion-ia.com/fr/blog/exemple</loc>");
  });
});
