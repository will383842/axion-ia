import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseSitemap } from "../sitemap-parser";

function mockFetchSequence(responses: Array<{ url?: string; xml: string; status?: number }>) {
  let callIndex = 0;
  return vi.fn((url: string) => {
    const resp = responses[callIndex++];
    if (!resp) return Promise.reject(new Error(`Unexpected fetch ${url}`));
    return Promise.resolve({
      ok: (resp.status ?? 200) >= 200 && (resp.status ?? 200) < 300,
      status: resp.status ?? 200,
      headers: new Headers({ "content-type": "application/xml" }),
      text: () => Promise.resolve(resp.xml),
    } as unknown as Response);
  });
}

const SIMPLE_SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/page-1</loc>
    <lastmod>2026-01-15</lastmod>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://example.com/page-2</loc>
    <lastmod>2026-02-01</lastmod>
  </url>
  <url>
    <loc>https://example.com/page-3</loc>
  </url>
</urlset>`;

const SITEMAP_INDEX = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap-1.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap-2.xml</loc>
  </sitemap>
</sitemapindex>`;

describe("parseSitemap", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("parses a simple sitemap with 3 URLs", async () => {
    globalThis.fetch = mockFetchSequence([{ xml: SIMPLE_SITEMAP }]) as never;
    const urls = await parseSitemap("https://example.com/sitemap.xml");
    expect(urls).toHaveLength(3);
    expect(urls[0]?.loc).toBe("https://example.com/page-1");
    expect(urls[0]?.lastmod).toBe("2026-01-15");
    expect(urls[0]?.priority).toBe(0.8);
    expect(urls[1]?.priority).toBeNull();
    expect(urls[2]?.lastmod).toBeNull();
  });

  it("recursively fetches sitemap-index children", async () => {
    globalThis.fetch = mockFetchSequence([
      { xml: SITEMAP_INDEX },
      { xml: SIMPLE_SITEMAP },
      { xml: SIMPLE_SITEMAP.replace(/page-/g, "blog-") },
    ]) as never;

    const urls = await parseSitemap("https://example.com/sitemap.xml");
    expect(urls.length).toBe(6); // 3 + 3
    const locs = urls.map((u) => u.loc);
    expect(locs).toContain("https://example.com/page-1");
    expect(locs).toContain("https://example.com/blog-1");
  });

  it("returns [] when fetch fails", async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error("network"))) as never;
    expect(await parseSitemap("https://example.com/sitemap.xml")).toEqual([]);
  });

  it("returns [] when fetch returns non-2xx", async () => {
    globalThis.fetch = mockFetchSequence([{ xml: "", status: 404 }]) as never;
    expect(await parseSitemap("https://example.com/sitemap.xml")).toEqual([]);
  });

  it("decodes XML entities in <loc>", async () => {
    const xml = `<?xml version="1.0"?>
<urlset><url><loc>https://example.com/page?a=1&amp;b=2</loc></url></urlset>`;
    globalThis.fetch = mockFetchSequence([{ xml }]) as never;
    const urls = await parseSitemap("https://example.com/sitemap.xml");
    expect(urls[0]?.loc).toBe("https://example.com/page?a=1&b=2");
  });

  it("limits to MAX_INDEX_DEPTH (anti-loop)", async () => {
    // Sitemap-index pointing to itself
    const loopXml = `<?xml version="1.0"?>
<sitemapindex><sitemap><loc>https://example.com/sitemap.xml</loc></sitemap></sitemapindex>`;
    globalThis.fetch = mockFetchSequence([
      { xml: loopXml },
      { xml: loopXml },
      { xml: loopXml },
      { xml: loopXml },
    ]) as never;
    const urls = await parseSitemap("https://example.com/sitemap.xml");
    expect(urls).toEqual([]);
  });

  it("handles malformed XML gracefully (returns empty)", async () => {
    globalThis.fetch = mockFetchSequence([{ xml: "<not valid xml" }]) as never;
    const urls = await parseSitemap("https://example.com/sitemap.xml");
    expect(urls).toEqual([]);
  });
});
