// Section « ## Vidéos » de llms.txt et llms-full.txt (W3.6) : absente à 0 vidéo, présente à 1,
// sans vidéo retirée (la lecture ne rend que les publiées).
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uneVideo } from "@/app/[locale]/videos/__tests__/fixture";

const h = vi.hoisted(() => ({ videos: [] as unknown[] }));
vi.mock("@/lib/seo", () => ({ SITE_URL: "https://axion-ia.com" }));
vi.mock("@/server/videos/lecture", () => ({ videosPubliees: async () => h.videos }));

import { GET as llms } from "@/app/llms.txt/route";
import { GET as llmsFull } from "@/app/llms-full.txt/route";

beforeEach(() => {
  h.videos = [];
});

const routes = [
  ["llms.txt", llms],
  ["llms-full.txt", llmsFull],
] as const;

describe.each(routes)("%s", (_nom, GET) => {
  it("0 vidéo → AUCUNE section ni mention de /fr/videos", async () => {
    const corps = await (await GET()).text();
    expect(corps).not.toContain("## Vidéos");
    expect(corps).not.toContain("/fr/videos");
  });

  it("1 vidéo → section avec titre, URL, durée et phrase de résumé", async () => {
    h.videos = [uneVideo({ description: "Une phrase de résumé. Une seconde phrase en trop." })];
    const corps = await (await GET()).text();
    expect(corps).toContain("## Vidéos");
    expect(corps).toContain(
      "[Automatiser ses relances clients en quelques minutes](https://axion-ia.com/fr/videos/automatiser-ses-relances)",
    );
    expect(corps).toContain("3 min 04");
    expect(corps).toContain("Une phrase de résumé.");
    expect(corps).not.toContain("Une seconde phrase en trop");
    expect(corps).not.toContain("?t=");
  });

  it("une vidéo absente de la lecture (retirée) n'apparaît pas", async () => {
    h.videos = [uneVideo({ slug: "vivante", titre: "Vidéo vivante encore en ligne ici" })];
    const corps = await (await GET()).text();
    expect(corps).toContain("vivante");
    expect(corps).not.toContain("retiree");
  });

  it("un échec de lecture ne casse jamais le fichier", async () => {
    vi.resetModules();
    expect((await GET()).status).toBe(200);
  });
});

describe("runtime", () => {
  it.each(["src/app/llms.txt/route.ts", "src/app/llms-full.txt/route.ts"])(
    "%s passe en nodejs avec ISR 1 h (la section lit la base)",
    (f) => {
      const code = readFileSync(f, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect(code).toMatch(/export const runtime = "nodejs"/);
      expect(code).toMatch(/export const revalidate = 3600/);
      expect(code).not.toMatch(/runtime = "edge"/);
      expect(code).not.toMatch(/force-static/);
    },
  );
});
