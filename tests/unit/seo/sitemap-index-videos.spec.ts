// L'index des plans du site liste sitemap-videos.xml seulement s'il y a ≥ 1 vidéo publiée (W3.5).
import { beforeEach, describe, expect, it, vi } from "vitest";
// eslint-disable-next-line no-restricted-imports
import { uneVideo } from "@/app/[locale]/videos/__tests__/fixture";

const h = vi.hoisted(() => ({ videos: [] as unknown[] }));

vi.mock("@/app/sitemap", () => ({
  default: async () => [],
  generateSitemaps: async () => [],
  buildExcludeSlugsByType: () => ({}),
  editorialLastmodForSitemapId: () => new Date("2026-06-08T00:00:00Z"),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    article: { findFirst: async () => null },
    knowledgeEntry: { findFirst: async () => null },
  },
}));
vi.mock("@/server/exporters/knowledge-sitemap", () => ({
  listKnowledgeSitemapEntries: async () => [],
}));
vi.mock("@/app/sitemap-news.xml/route", () => ({ listRecentNewsEntries: async () => [] }));
vi.mock("@/app/sitemap-news-evergreen.xml/route", () => ({
  listEvergreenNewsEntries: async () => [],
}));
vi.mock("@/server/reviews/presence", () => ({ avisPublies: async () => false }));
vi.mock("@/server/videos/lecture", () => ({ videosPubliees: async () => h.videos }));

// eslint-disable-next-line no-restricted-imports
import { GET } from "@/app/sitemap-index.xml/route";

beforeEach(() => {
  h.videos = [];
});

describe("sitemap-index.xml et les vidéos", () => {
  it("0 vidéo publiée → sitemap-videos.xml NON listé", async () => {
    expect(await (await GET()).text()).not.toContain("/sitemap-videos.xml");
  });

  it("≥ 1 vidéo publiée → listé, avec <lastmod> = dernière modification", async () => {
    h.videos = [
      uneVideo({ slug: "a", modifieeLe: new Date("2026-11-05T09:00:00Z") }),
      uneVideo({ slug: "b", modifieeLe: new Date("2026-12-01T09:00:00Z") }),
    ];
    const xml = await (await GET()).text();
    expect(xml).toMatch(
      /<loc>[^<]*\/sitemap-videos\.xml<\/loc>\s*<lastmod>2026-12-01T09:00:00\.000Z<\/lastmod>/,
    );
  });
});
