import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { siteVideo: { findMany: (...a: unknown[]) => findMany(...a) } },
}));

import { videosPubliees, videoParSlug, videosDuTheme, viderCacheVideos } from "../lecture";

const ligne = (slug: string, theme: string, over: Record<string, unknown> = {}) => ({
  id: slug,
  slug,
  theme,
  statut: "publiee",
  version: 1,
  titre: `Titre ${slug}`,
  description: "d",
  resume: "r",
  aRetenir: ["a", "b", "c"],
  questions: [],
  chapitres: [],
  fichiers: {},
  transcription: null,
  dureeSecondes: 60,
  serieSlug: null,
  serieTitre: null,
  serieRang: null,
  lienType: "service",
  lienChemin: "/fr/implementation",
  iaVoixGeneree: false,
  iaDoubleNumerique: false,
  williamsALImage: false,
  publieeLe: new Date("2026-11-01T10:00:00Z"),
  modifieeLe: new Date("2026-11-02T10:00:00Z"),
  ...over,
});

beforeEach(() => {
  viderCacheVideos();
  findMany.mockReset();
  findMany.mockResolvedValue([ligne("a", "t1"), ligne("b", "t1"), ligne("c", "t2")]);
  vi.stubEnv("VIDEOS_SITE_ENABLED", "true");
  vi.stubEnv("DATABASE_URL", "postgresql://u:p@db.example/x");
});
afterEach(() => vi.unstubAllEnvs());

describe("lecture des vidéos publiées", () => {
  it("drapeau éteint → [] / null SANS appel à la base", async () => {
    vi.stubEnv("VIDEOS_SITE_ENABLED", "");
    expect(await videosPubliees()).toEqual([]);
    expect(await videoParSlug("a")).toBeNull();
    expect(findMany).not.toHaveBeenCalled();
  });

  it("base factice du build (stub.invalid) → [] sans appel", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://stub:stub@stub.invalid:5432/stub");
    expect(await videosPubliees()).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("ne demande que les vidéos `publiee`", async () => {
    await videosPubliees();
    expect(findMany.mock.calls[0]![0]).toMatchObject({ where: { statut: "publiee" } });
  });

  it("par slug et par thème", async () => {
    expect((await videoParSlug("c"))?.slug).toBe("c");
    expect(await videoParSlug("zzz")).toBeNull();
    expect((await videosDuTheme("t1")).map((v) => v.slug)).toEqual(["a", "b"]);
  });

  it("cache 5 min : une seule requête, puis relecture après vidage", async () => {
    await videosPubliees();
    await videosPubliees();
    expect(findMany).toHaveBeenCalledTimes(1);
    viderCacheVideos();
    await videosPubliees();
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it("base en panne → dernière valeur connue, sinon []", async () => {
    findMany.mockRejectedValueOnce(new Error("down"));
    expect(await videosPubliees()).toEqual([]);
  });
});

describe("slugsRetires", () => {
  it("ne lit que les retirées et rend leurs slugs", async () => {
    findMany.mockResolvedValue([{ slug: "a" }, { slug: "b" }]);
    const { slugsRetires } = await import("../lecture");
    expect(await slugsRetires()).toEqual(["a", "b"]);
    expect(findMany.mock.calls.at(-1)![0]).toMatchObject({ where: { statut: "retiree" } });
  });
  it("interrupteur éteint → [] sans appel", async () => {
    vi.stubEnv("VIDEOS_SITE_ENABLED", "");
    findMany.mockClear();
    const { slugsRetires } = await import("../lecture");
    expect(await slugsRetires()).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
