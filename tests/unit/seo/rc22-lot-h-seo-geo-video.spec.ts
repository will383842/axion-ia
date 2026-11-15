// RC-22 — Lot H SEO/GEO : llms.txt annonce le sitemap vidéo (seulement quand des vidéos sont
// publiées) et le VideoObject accepte plusieurs miniatures + langue + éditeur.
import { beforeEach, describe, expect, it, vi } from "vitest";
// eslint-disable-next-line no-restricted-imports
import { uneVideo } from "@/app/[locale]/videos/__tests__/fixture";
import { buildVideoObjectJsonLd } from "@/lib/seo/extended-schemas";

const h = vi.hoisted(() => ({ videos: [] as unknown[] }));
vi.mock("@/lib/seo", () => ({ SITE_URL: "https://axion-ia.com" }));
vi.mock("@/server/videos/lecture", () => ({ videosPubliees: async () => h.videos }));

// eslint-disable-next-line no-restricted-imports
import { GET as llms } from "@/app/llms.txt/route";

beforeEach(() => {
  h.videos = [];
});

describe("llms.txt — sitemap vidéo", () => {
  it("0 vidéo → aucune mention du sitemap vidéo", async () => {
    const corps = await (await llms()).text();
    expect(corps).not.toContain("sitemap-videos.xml");
  });

  it("1 vidéo publiée → le sitemap vidéo est annoncé", async () => {
    h.videos = [uneVideo({})];
    const corps = await (await llms()).text();
    expect(corps).toContain("https://axion-ia.com/sitemap-videos.xml");
    expect(corps).toContain("## Vidéos");
  });
});

describe("buildVideoObjectJsonLd — extensions", () => {
  const base = {
    name: "Cas concret",
    description: "Résumé",
    thumbnailUrl: "https://axion-ia.com/a.jpg",
    uploadDate: "2026-11-02T10:00:00+01:00",
  };
  it("accepte un tableau de miniatures", () => {
    const r = buildVideoObjectJsonLd({
      ...base,
      thumbnailUrl: ["https://axion-ia.com/a.jpg", "https://axion-ia.com/b.jpg"],
    });
    expect(r.thumbnailUrl).toEqual(["https://axion-ia.com/a.jpg", "https://axion-ia.com/b.jpg"]);
  });
  it("porte inLanguage et publisher quand fournis, rien sinon", () => {
    const r = buildVideoObjectJsonLd({
      ...base,
      inLanguage: "fr-FR",
      publisherName: "Axion-IA",
    });
    expect(r.inLanguage).toBe("fr-FR");
    expect(r.publisher).toEqual({ "@type": "Organization", name: "Axion-IA" });
    const nu = buildVideoObjectJsonLd(base);
    expect("inLanguage" in nu).toBe(false);
    expect("publisher" in nu).toBe(false);
  });
  it("conserve la forme minimale existante", () => {
    expect(buildVideoObjectJsonLd(base)["@type"]).toBe("VideoObject");
  });
});
