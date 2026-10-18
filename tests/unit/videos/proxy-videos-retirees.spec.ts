import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  RE_PAGE_VIDEO,
  reponseGoneSiRetiree,
  reinitialiserRetirees,
} from "@/lib/videos/retirees-edge";

const ORIGINE = "https://axion-ia.com";

function liste(corps: string, statut = 200) {
  return vi.fn(async () => new Response(corps, { status: statut }));
}

beforeEach(() => reinitialiserRetirees());

describe("410 des vidéos retirées (D6, vrai 410)", () => {
  it("slug retiré → 410 Gone, mis en cache par Cloudflare", async () => {
    const r = await reponseGoneSiRetiree("/fr/videos/ancienne-video", {
      fetchImpl: liste("ancienne-video\nautre-retiree\n"),
      origine: ORIGINE,
      maintenant: () => 1_000,
    });
    expect(r?.status).toBe(410);
    expect(r?.headers.get("cache-control")).toMatch(/s-maxage/);
  });

  it("slug publié (absent de la liste) → laisse passer", async () => {
    const r = await reponseGoneSiRetiree("/fr/videos/video-vivante", {
      fetchImpl: liste("ancienne-video\n"),
      origine: ORIGINE,
      maintenant: () => 1_000,
    });
    expect(r).toBeNull();
  });

  it("liste INJOIGNABLE → laisse passer (la page rendra son 404 noindex), jamais d'erreur", async () => {
    const hs = vi.fn(async () => {
      throw new Error("réseau");
    });
    const r = await reponseGoneSiRetiree("/fr/videos/ancienne-video", {
      fetchImpl: hs,
      origine: ORIGINE,
      maintenant: () => 1_000,
    });
    expect(r).toBeNull();
  });

  it("liste en erreur HTTP 500 → laisse passer", async () => {
    const r = await reponseGoneSiRetiree("/fr/videos/ancienne-video", {
      fetchImpl: liste("ancienne-video", 500),
      origine: ORIGINE,
      maintenant: () => 1_000,
    });
    expect(r).toBeNull();
  });

  it("n'interroge la liste que toutes les 5 minutes", async () => {
    const f = liste("a-retiree\n");
    let t = 1_000;
    const deps = { fetchImpl: f, origine: ORIGINE, maintenant: () => t };
    await reponseGoneSiRetiree("/fr/videos/a-retiree", deps);
    await reponseGoneSiRetiree("/fr/videos/autre", deps);
    t += 4 * 60_000;
    await reponseGoneSiRetiree("/fr/videos/a-retiree", deps);
    expect(f).toHaveBeenCalledTimes(1);
    t += 2 * 60_000;
    await reponseGoneSiRetiree("/fr/videos/a-retiree", deps);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("une panne APRÈS un succès garde la dernière liste connue", async () => {
    let t = 1_000;
    const ok = liste("a-retiree\n");
    await reponseGoneSiRetiree("/fr/videos/a-retiree", {
      fetchImpl: ok,
      origine: ORIGINE,
      maintenant: () => t,
    });
    t += 6 * 60_000;
    const hs = vi.fn(async () => {
      throw new Error("réseau");
    });
    const r = await reponseGoneSiRetiree("/fr/videos/a-retiree", {
      fetchImpl: hs,
      origine: ORIGINE,
      maintenant: () => t,
    });
    expect(r?.status).toBe(410);
  });

  it("n'interroge PAS la liste pour une autre adresse que /fr|en/videos/<slug>", async () => {
    const f = liste("x\n");
    for (const p of [
      "/fr/a-propos",
      "/fr/videos",
      "/fr/videos/theme/x",
      "/videos/x",
      "/fr/videos/x/y",
    ]) {
      expect(
        await reponseGoneSiRetiree(p, { fetchImpl: f, origine: ORIGINE, maintenant: () => 1 }),
      ).toBeNull();
    }
    expect(f).not.toHaveBeenCalled();
  });

  it("interroge l'adresse publique de la liste", async () => {
    const f = liste("");
    await reponseGoneSiRetiree("/fr/videos/x", {
      fetchImpl: f,
      origine: ORIGINE,
      maintenant: () => 1,
    });
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe(
      `${ORIGINE}/api/interne/videos/retirees`,
    );
  });

  it("le motif d'adresse", () => {
    expect(RE_PAGE_VIDEO.test("/fr/videos/mon-slug/")).toBe(true);
    expect(RE_PAGE_VIDEO.test("/fr/videos/Mon_Slug")).toBe(false);
  });
});

describe("branchement dans le proxy", () => {
  it("src/proxy.ts appelle reponseGoneSiRetiree", () => {
    const source = readFileSync("src/proxy.ts", "utf8");
    expect(source).toMatch(/reponseGoneSiRetiree\(/);
  });
});
