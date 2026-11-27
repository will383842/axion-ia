/**
 * Chaîne qualité complète (provider réel, fetch / Redis / Prisma simulés) :
 * photo déjà utilisée jamais reprise, pas de doublon dans un même article,
 * repli générique sans doublon, hors sujet → rien, attribution conservée.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const redisSets = new Set<string>();
vi.mock("@/lib/redis", () => ({
  redis: {
    smembers: async () => [...redisSets],
    sadd: async (_k: string, v: string) => (redisSets.has(v) ? 0 : (redisSets.add(v), 1)),
    expire: async () => 1,
    zremrangebyscore: async () => 0,
    zrange: async () => [],
    zadd: async () => 1,
  },
}));
const prismaState = { heroes: [] as string[], bodyKeys: [] as string[] };
vi.mock("@/lib/prisma", () => ({
  prisma: {
    article: {
      findMany: async () => prismaState.heroes.map((u) => ({ featuredImage: u })),
    },
    $queryRaw: async () => prismaState.bodyKeys.map((key) => ({ key })),
  },
}));
vi.mock("../../lib/config-reader", () => ({
  readProviderConfig: async () => ({ enabled: true, model: "m" }),
}));

import { selectHeroImage } from "../select-hero-image";
import { injectBodyImages } from "../inject-body-images";

function raw(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    width: 3000,
    height: 2000,
    likes: 10,
    description: null,
    alt_description: "people training on artificial intelligence in a business office",
    urls: { regular: `https://images.unsplash.com/photo-${id}-hh?ixid=1` },
    links: { download_location: `https://api.unsplash.com/photos/${id}/download` },
    user: {
      id: "u",
      username: "jane",
      name: "Jane Doe",
      links: { html: "https://unsplash.com/@jane" },
    },
    ...over,
  };
}

let responses: Array<unknown[]>;
const fetchMock = vi.fn();

beforeEach(() => {
  redisSets.clear();
  prismaState.heroes = [];
  prismaState.bodyKeys = [];
  responses = [];
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (u: string) => {
    if (String(u).includes("/download")) return { ok: true };
    const results = responses.shift() ?? [];
    return { ok: true, json: async () => ({ total: results.length, total_pages: 1, results }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  process.env.UNSPLASH_ACCESS_KEY = "k";
  delete process.env.CONTENT_IMAGES_QUALITE;
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.UNSPLASH_ACCESS_KEY;
});

const HERO_IN = {
  jobId: "j1",
  contentType: "blog_article",
  primaryKeyword: "formation ia entreprise",
};

describe("hero qualité", () => {
  it("n'emploie jamais une photo déjà utilisée par un autre article (hero ou corps)", async () => {
    prismaState.heroes = ["https://images.unsplash.com/photo-a-hh?ixid=9"];
    prismaState.bodyKeys = ["photo-b-hh"];
    responses = [[raw("a", { likes: 999 }), raw("b", { likes: 500 }), raw("c", { likes: 1 })]];
    const hero = await selectHeroImage(HERO_IN);
    expect(hero?.url).toContain("photo-c-hh");
  });

  it("conserve l'attribution du photographe", async () => {
    responses = [[raw("a")]];
    const hero = await selectHeroImage(HERO_IN);
    expect(hero).toMatchObject({
      source: "unsplash",
      photographerName: "Jane Doe",
      photographerUrl: expect.stringContaining("utm_source=axion-ia"),
    });
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/photos/a/download"))).toBe(
      true,
    );
  });

  it("deux articles successifs ne reçoivent jamais la même photo (repli générique compris)", async () => {
    const same = [raw("a", { likes: 100 }), raw("b", { likes: 50 })];
    responses = [same, same, same, same, same, same];
    const h1 = await selectHeroImage({ ...HERO_IN, primaryKeyword: "zzz qqq xxx" });
    const h2 = await selectHeroImage({ ...HERO_IN, jobId: "j2", primaryKeyword: "zzz qqq xxx" });
    expect(h1?.url).toBeTruthy();
    expect(h2?.url).toBeTruthy();
    expect(h1?.url).not.toBe(h2?.url);
  });

  it("repli générique : si tout est déjà utilisé → null (image en attente)", async () => {
    prismaState.heroes = ["https://images.unsplash.com/photo-a-hh"];
    responses = [[raw("a")], [raw("a")], [raw("a")]];
    expect(await selectHeroImage(HERO_IN)).toBeNull();
  });

  it("écarte petite photo, portrait et capture d'écran", async () => {
    responses = [
      [
        raw("s", { width: 1200, height: 800 }),
        raw("p", { width: 2000, height: 3000 }),
        raw("c", { alt_description: "screenshot of a dashboard with business text" }),
      ],
      [],
      [],
    ];
    expect(await selectHeroImage(HERO_IN)).toBeNull();
  });

  it("photo hors sujet refusée → null plutôt qu'une photo hors sujet", async () => {
    responses = [
      [raw("d", { alt_description: "a dog running on a beach" })],
      [raw("d", { alt_description: "a dog running on a beach" })],
      [raw("d", { alt_description: "a dog running on a beach" })],
    ];
    expect(await selectHeroImage(HERO_IN)).toBeNull();
  });

  it("base indisponible → null (pas de doublon risqué)", async () => {
    responses = [[raw("a")]];
    const spy = vi.spyOn(prismaState, "heroes", "get").mockImplementation(() => {
      throw new Error("db down");
    });
    expect(await selectHeroImage(HERO_IN)).toBeNull();
    spy.mockRestore();
  });

  it('interrupteur "false" : ancien comportement (aucune mémoire, pas de filtre)', async () => {
    process.env.CONTENT_IMAGES_QUALITE = "false";
    prismaState.heroes = ["https://images.unsplash.com/photo-a-hh"];
    responses = [[raw("a", { width: 800, height: 900, alt_description: "dog" })]];
    const hero = await selectHeroImage(HERO_IN);
    expect(hero?.url).toContain("photo-a-hh"); // photo « déjà utilisée / hors sujet » reprise comme avant
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("per_page=30");
  });
});

describe("images du corps", () => {
  const BODY =
    "<h2>Intro</h2><p>a</p><h2>Former les équipes entreprise</h2><p>b</p>" +
    "<h2>Former les équipes entreprise</h2><p>c</p><h2>Former les équipes entreprise</h2><p>d</p>";

  it("pas de doublon dans un même article, ni avec la hero, ni avec un autre article", async () => {
    prismaState.bodyKeys = ["photo-x-hh"];
    const list = [
      raw("x", { likes: 900 }),
      raw("h", { likes: 800 }),
      raw("a", { likes: 5 }),
      raw("b", { likes: 4 }),
    ];
    responses = [list, list, list, list];
    const out = await injectBodyImages(BODY, {
      jobId: "j",
      contentType: "blog_article",
      topicHint: "formation ia",
      heroImageUrl: "https://images.unsplash.com/photo-h-hh?ixid=2",
    });
    const keys = [...out.matchAll(/photo-([a-z])-hh/g)].map((m) => m[1]);
    expect(keys).toEqual(["a", "b"]);
    expect(out).toContain("Jane Doe"); // attribution conservée
  });

  it("rien de pertinent → image omise, corps inchangé", async () => {
    const dog = [raw("d", { alt_description: "a dog on a beach" })];
    responses = [dog, dog, dog, dog];
    const out = await injectBodyImages(BODY, { jobId: "j", contentType: "blog_article" });
    expect(out).toBe(BODY);
  });
});
