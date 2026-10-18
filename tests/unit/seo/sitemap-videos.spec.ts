// Sitemap des vidéos (lot W3) : motif de `sitemap-avis.xml`.
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
// eslint-disable-next-line no-restricted-imports
import { uneVideo } from "@/app/[locale]/videos/__tests__/fixture";

const h = vi.hoisted(() => ({ videos: [] as unknown[] }));
vi.mock("@/server/videos/lecture", () => ({ videosPubliees: async () => h.videos }));

// eslint-disable-next-line no-restricted-imports
import { GET } from "@/app/sitemap-videos.xml/route";

beforeEach(() => {
  h.videos = [];
});

const corps = async (): Promise<string> => (await GET()).text();

describe("sitemap-videos.xml", () => {
  it("0 vidéo publiée (ou interrupteur éteint côté lecture) → 404", async () => {
    const r = await GET();
    expect(r.status).toBe(404);
  });

  it("1 vidéo → <video:video> complet et <lastmod> = modifiee_le", async () => {
    h.videos = [uneVideo()];
    const r = await GET();
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/application\/xml/);
    const xml = await r.text();
    expect(xml).toContain('xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"');
    expect(xml).toMatch(/<loc>[^<]*\/fr\/videos\/automatiser-ses-relances<\/loc>/);
    expect(xml).toContain("<lastmod>2026-11-05T09:00:00.000Z</lastmod>");
    expect(xml).toMatch(/<video:thumbnail_loc>[^<]*affiche-16x9\.avif<\/video:thumbnail_loc>/);
    expect(xml).toContain(
      "<video:title>Automatiser ses relances clients en quelques minutes</video:title>",
    );
    expect(xml).toContain("<video:description>");
    expect(xml).toMatch(/<video:content_loc>[^<]*video-1080p\.mp4<\/video:content_loc>/);
    expect(xml).toContain("<video:duration>184</video:duration>");
    expect(xml).toContain(
      "<video:publication_date>2026-11-02T10:00:00+01:00</video:publication_date>",
    );
    expect(xml).toContain("<video:family_friendly>yes</video:family_friendly>");
  });

  it("AUCUNE adresse ?t= et AUCUN player_loc (pas d'intégration)", async () => {
    h.videos = [uneVideo()];
    const xml = await corps();
    expect(xml).not.toContain("?t=");
    expect(xml).not.toContain("player_loc");
  });

  it("la galerie est listée ; la page de thème seulement à 3 vidéos", async () => {
    h.videos = [uneVideo({ slug: "a-1" }), uneVideo({ slug: "a-2" })];
    let xml = await corps();
    expect(xml).toMatch(/<loc>[^<]*\/fr\/videos<\/loc>/);
    expect(xml).not.toContain("/fr/videos/theme/");
    h.videos = [uneVideo({ slug: "a-1" }), uneVideo({ slug: "a-2" }), uneVideo({ slug: "a-3" })];
    xml = await corps();
    expect(xml).toMatch(/<loc>[^<]*\/fr\/videos\/theme\/automatisation<\/loc>/);
  });

  it("la série est listée à 3 épisodes", async () => {
    const ep = (k: number) =>
      uneVideo({ slug: `ep-${k}`, serie: { slug: "ma-serie", titre: "Ma série", rang: k } });
    h.videos = [ep(1), ep(2), ep(3)];
    expect(await corps()).toMatch(/<loc>[^<]*\/fr\/videos\/serie\/ma-serie<\/loc>/);
  });

  it("échappe le XML dans le titre et la description", async () => {
    h.videos = [uneVideo({ titre: 'Relances <b> & "tests" à l\'heure', description: "A & B < C" })];
    const xml = await corps();
    expect(xml).toContain("Relances &lt;b&gt; &amp; &quot;tests&quot; à l&apos;heure");
    expect(xml).not.toMatch(/<video:title>[^<]*<b>/);
  });

  it("la route est dynamique (jamais figée au build stub)", () => {
    const src = readFileSync("src/app/sitemap-videos.xml/route.ts", "utf8");
    expect(src).toMatch(/export const dynamic = "force-dynamic"/);
  });
});

describe("pages.xml n'annonce pas la galerie (elle est dans sitemap-videos.xml)", () => {
  it("/videos est dans EXCLUDED_FROM_INDEX", () => {
    const src = readFileSync("src/app/sitemap.ts", "utf8").replace(/\/\/[^\n]*/g, "");
    const bloc = /EXCLUDED_FROM_INDEX[^=]*=\s*\[([\s\S]*?)\];/.exec(src)?.[1] ?? "";
    expect(bloc).toContain('"/videos"');
  });
});
